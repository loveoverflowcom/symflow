//! Store in-memory: CLI/test không cần CSDL.

use crate::error::StoreError;
use crate::state::RunStatus;
use crate::store::{FlowRecord, FlowSummary, RunRecord, Store};
use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Default)]
struct Inner {
    flows: HashMap<String, FlowRecord>,
    runs: HashMap<Uuid, RunRecord>,
}

pub struct MemoryStore {
    inner: Mutex<Inner>,
}
impl MemoryStore {
    pub fn new() -> Self {
        MemoryStore {
            inner: Mutex::new(Inner::default()),
        }
    }
}
impl Default for MemoryStore {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl Store for MemoryStore {
    async fn upsert_flow(
        &self,
        id: &str,
        name: &str,
        dsl_script: &str,
        graph: Option<&Value>,
    ) -> Result<(), StoreError> {
        let mut inner = self.inner.lock().unwrap();
        let created_at = inner
            .flows
            .get(id)
            .map(|flow| flow.created_at)
            .unwrap_or_else(Utc::now);

        inner.flows.insert(
            id.to_string(),
            FlowRecord {
                id: id.into(),
                name: name.into(),
                dsl_script: dsl_script.into(),
                graph: graph.cloned(),
                created_at,
            },
        );
        Ok(())
    }
    async fn get_flow(&self, id: &str) -> Result<Option<FlowRecord>, StoreError> {
        Ok(self.inner.lock().unwrap().flows.get(id).cloned())
    }
    async fn list_flows(&self) -> Result<Vec<FlowSummary>, StoreError> {
        let mut flows: Vec<_> = self.inner.lock().unwrap().flows.values().cloned().collect();
        flows.sort_by(|a, b| {
            b.created_at
                .cmp(&a.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(flows
            .into_iter()
            .map(|f| FlowSummary {
                id: f.id.clone(),
                name: f.name.clone(),
                created_at: f.created_at,
            })
            .collect())
    }
    async fn delete_flow(&self, id: &str) -> Result<bool, StoreError> {
        let mut inner = self.inner.lock().unwrap();
        let existed = inner.flows.remove(id).is_some();
        if existed {
            inner.runs.retain(|_, run| run.flow_id != id);
        }
        Ok(existed)
    }
    async fn create_run(
        &self,
        flow_id: &str,
        initial_inputs: Option<Value>,
    ) -> Result<Uuid, StoreError> {
        let id = Uuid::new_v4();
        self.inner.lock().unwrap().runs.insert(
            id,
            RunRecord {
                id,
                flow_id: flow_id.into(),
                status: RunStatus::Pending,
                initial_inputs,
                output: None,
                execution_logs: None,
                error: None,
                created_at: Utc::now(),
                finished_at: None,
            },
        );
        Ok(id)
    }
    async fn set_run_status(&self, run_id: Uuid, status: RunStatus) -> Result<(), StoreError> {
        if let Some(r) = self.inner.lock().unwrap().runs.get_mut(&run_id) {
            r.status = status;
            if matches!(status, RunStatus::Success | RunStatus::Failed) {
                r.finished_at = Some(Utc::now());
            }
        }
        Ok(())
    }
    async fn save_run_result(
        &self,
        run_id: Uuid,
        status: RunStatus,
        output: Option<Value>,
        execution_logs: Value,
        error: Option<String>,
    ) -> Result<(), StoreError> {
        if let Some(run) = self.inner.lock().unwrap().runs.get_mut(&run_id) {
            run.status = status;
            run.output = output;
            run.execution_logs = Some(execution_logs);
            run.error = error;
            run.finished_at = Some(Utc::now());
        }
        Ok(())
    }
    async fn get_run(&self, run_id: Uuid) -> Result<Option<RunRecord>, StoreError> {
        Ok(self.inner.lock().unwrap().runs.get(&run_id).cloned())
    }
    async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError> {
        let mut runs: Vec<_> = self.inner.lock().unwrap().runs.values().cloned().collect();
        runs.sort_by(|a, b| {
            b.created_at
                .cmp(&a.created_at)
                .then_with(|| a.id.cmp(&b.id))
        });
        Ok(runs)
    }
}
