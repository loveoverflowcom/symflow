//! Trait `Store` — ranh giới lưu trữ giữa symflow-core và symflow-store.

use crate::error::StoreError;
use crate::state::RunStatus;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use serde::Serialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct FlowRecord {
    pub id: String,
    pub name: String,
    pub dsl_script: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FlowSummary {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunRecord {
    pub id: Uuid,
    pub flow_id: String,
    pub status: RunStatus,
    pub initial_inputs: Option<Value>,
    pub output: Option<Value>,
    pub execution_logs: Option<Value>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

#[async_trait]
pub trait Store: Send + Sync {
    // ---- flows ---
    async fn upsert_flow(&self, id: &str, name: &str, dsl_script: &str) -> Result<(), StoreError>;
    async fn get_flow(&self, id: &str) -> Result<Option<FlowRecord>, StoreError>;
    async fn list_flows(&self) -> Result<Vec<FlowSummary>, StoreError>;
    async fn delete_flow(&self, id: &str) -> Result<bool, StoreError>;

    // ---- runs ---
    async fn create_run(
        &self,
        flow_id: &str,
        initial_inputs: Option<Value>,
    ) -> Result<Uuid, StoreError>;
    async fn set_run_status(&self, run_id: Uuid, status: RunStatus) -> Result<(), StoreError>;
    async fn save_run_result(
        &self,
        run_id: Uuid,
        status: RunStatus,
        output: Option<Value>,
        execution_logs: Value,
        error: Option<String>,
    ) -> Result<(), StoreError>;
    async fn get_run(&self, run_id: Uuid) -> Result<Option<RunRecord>, StoreError>;
    async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError>;
}
