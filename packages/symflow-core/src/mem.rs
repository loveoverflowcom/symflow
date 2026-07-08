//! Store in-memory: CLI/test không cần CSDL.

use crate::error::StoreError;
use crate::state::{RunStatus, StepStatus};
use crate::store::{FlowRecord, FlowSummary, RunRecord, StepRecord, Store};
use async_trait::async_trait;
use chrono::Utc;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use uuid::Uuid;

#[derive(Default)]
struct Inner {
    flows: HashMap<String, FlowRecord>,
    runs:  HashMap<Uuid, RunRecord>,
    steps: HashMap<(Uuid, String), StepRecord>,
}

pub struct MemoryStore { inner: Mutex<Inner> }
impl MemoryStore { pub fn new() -> Self { MemoryStore { inner: Mutex::new(Inner::default()) } } }
impl Default for MemoryStore { fn default() -> Self { Self::new() } }

#[async_trait]
impl Store for MemoryStore {
    async fn upsert_flow(&self, id: &str, name: &str, dsl_script: &str) -> Result<(), StoreError> {
        let mut inner = self.inner.lock().unwrap();
        let created_at = inner
            .flows
            .get(id)
            .map(|flow| flow.created_at)
            .unwrap_or_else(Utc::now);

        inner.flows.insert(id.to_string(), FlowRecord {
            id: id.into(),
            name: name.into(),
            dsl_script: dsl_script.into(),
            created_at,
        });
        Ok(())
    }
    async fn get_flow(&self, id: &str) -> Result<Option<FlowRecord>, StoreError> {
        Ok(self.inner.lock().unwrap().flows.get(id).cloned())
    }
    async fn list_flows(&self) -> Result<Vec<FlowSummary>, StoreError> {
        let mut flows: Vec<_> = self.inner.lock().unwrap().flows.values().cloned().collect();
        flows.sort_by(|a, b| b.created_at.cmp(&a.created_at).then_with(|| a.id.cmp(&b.id)));
        Ok(flows
            .into_iter()
            .map(|f| FlowSummary { id: f.id.clone(), name: f.name.clone(), created_at: f.created_at })
            .collect())
    }
    async fn delete_flow(&self, id: &str) -> Result<bool, StoreError> {
        let mut inner = self.inner.lock().unwrap();
        let existed = inner.flows.remove(id).is_some();
        if existed {
            let mut removed_run_ids = Vec::new();
            inner.runs.retain(|run_id, run| {
                let keep = run.flow_id != id;
                if !keep {
                    removed_run_ids.push(*run_id);
                }
                keep
            });
            inner.steps.retain(|(run_id, _), _| !removed_run_ids.contains(run_id));
        }
        Ok(existed)
    }
    async fn create_run(&self, flow_id: &str, initial_inputs: Option<Value>) -> Result<Uuid, StoreError> {
        let id = Uuid::new_v4();
        self.inner.lock().unwrap().runs.insert(id, RunRecord {
            id, flow_id: flow_id.into(), status: RunStatus::Pending,
            initial_inputs, created_at: Utc::now(), finished_at: None,
        });
        Ok(id)
    }
    async fn set_run_status(&self, run_id: Uuid, status: RunStatus) -> Result<(), StoreError> {
        if let Some(r) = self.inner.lock().unwrap().runs.get_mut(&run_id) {
            r.status = status;
            if matches!(status, RunStatus::Success | RunStatus::Failed) { r.finished_at = Some(Utc::now()); }
        }
        Ok(())
    }
    async fn get_run(&self, run_id: Uuid) -> Result<Option<RunRecord>, StoreError> {
        Ok(self.inner.lock().unwrap().runs.get(&run_id).cloned())
    }
    async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError> {
        let mut runs: Vec<_> = self.inner.lock().unwrap().runs.values().cloned().collect();
        runs.sort_by(|a, b| b.created_at.cmp(&a.created_at).then_with(|| a.id.cmp(&b.id)));
        Ok(runs)
    }
    async fn upsert_step(&self, run_id: Uuid, step_id: &str, status: StepStatus) -> Result<(), StoreError> {
        self.inner.lock().unwrap().steps
            .entry((run_id, step_id.to_string()))
            .or_insert_with(|| StepRecord {
                run_id, step_id: step_id.into(), status,
                resolved_inputs: None, outputs: None, agent_logs: None, error: None, executed_at: Utc::now(),
            });
        Ok(())
    }
    async fn set_step_status(&self, run_id: Uuid, step_id: &str, status: StepStatus) -> Result<(), StoreError> {
        if let Some(s) = self.inner.lock().unwrap().steps.get_mut(&(run_id, step_id.to_string())) {
            s.status = status;
            if matches!(status, StepStatus::Running) {
                s.executed_at = Utc::now();
            }
        }
        Ok(())
    }
    async fn set_step_resolved_inputs(&self, run_id: Uuid, step_id: &str, inputs: &Value) -> Result<(), StoreError> {
        if let Some(s) = self.inner.lock().unwrap().steps.get_mut(&(run_id, step_id.to_string())) { s.resolved_inputs = Some(inputs.clone()); }
        Ok(())
    }
    async fn complete_step(&self, run_id: Uuid, step_id: &str, outputs: &Value) -> Result<(), StoreError> {
        if let Some(s) = self.inner.lock().unwrap().steps.get_mut(&(run_id, step_id.to_string())) {
            s.status = StepStatus::Completed; s.outputs = Some(outputs.clone());
        }
        Ok(())
    }
    async fn fail_step(&self, run_id: Uuid, step_id: &str, error: &str) -> Result<(), StoreError> {
        if let Some(s) = self.inner.lock().unwrap().steps.get_mut(&(run_id, step_id.to_string())) {
            s.status = StepStatus::Failed; s.error = Some(error.to_string());
        }
        Ok(())
    }
    async fn get_step_outputs(&self, run_id: Uuid, step_id: &str) -> Result<Option<Value>, StoreError> {
        Ok(self.inner.lock().unwrap().steps.get(&(run_id, step_id.to_string())).and_then(|s| s.outputs.clone()))
    }
    async fn append_agent_log(&self, run_id: Uuid, step_id: &str, entry: Value) -> Result<(), StoreError> {
        if let Some(s) = self.inner.lock().unwrap().steps.get_mut(&(run_id, step_id.to_string())) {
            let arr = s.agent_logs.get_or_insert(Value::Array(Vec::new()));
            if let Value::Array(ref mut v) = arr { v.push(entry); }
        }
        Ok(())
    }
    async fn list_steps(&self, run_id: Uuid) -> Result<Vec<StepRecord>, StoreError> {
        let mut steps: Vec<_> = self.inner.lock().unwrap().steps.iter()
            .filter(|((rid, _), _)| *rid == run_id)
            .map(|(_, v)| v.clone())
            .collect();
        steps.sort_by(|a, b| a.executed_at.cmp(&b.executed_at).then_with(|| a.step_id.cmp(&b.step_id)));
        Ok(steps)
    }
    async fn get_step(&self, run_id: Uuid, step_id: &str) -> Result<Option<StepRecord>, StoreError> {
        Ok(self.inner.lock().unwrap().steps.get(&(run_id, step_id.to_string())).cloned())
    }
}
