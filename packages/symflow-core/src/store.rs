//! Trait `Store` — ranh giới lưu trữ giữa symflow-core và symflow-store.

use crate::error::StoreError;
use crate::state::{RunStatus, StepStatus};
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
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StepRecord {
    pub run_id: Uuid,
    pub step_id: String,
    pub status: StepStatus,
    pub resolved_inputs: Option<Value>,
    pub outputs: Option<Value>,
    pub agent_logs: Option<Value>,
    pub error: Option<String>,
    pub executed_at: DateTime<Utc>,
}

#[async_trait]
pub trait Store: Send + Sync {
    // ---- flows ---
    async fn upsert_flow(&self, id: &str, name: &str, dsl_script: &str) -> Result<(), StoreError>;
    async fn get_flow(&self, id: &str) -> Result<Option<FlowRecord>, StoreError>;
    async fn list_flows(&self) -> Result<Vec<FlowSummary>, StoreError>;
    async fn delete_flow(&self, id: &str) -> Result<bool, StoreError>;

    // ---- runs ---
    async fn create_run(&self, flow_id: &str, initial_inputs: Option<Value>) -> Result<Uuid, StoreError>;
    async fn set_run_status(&self, run_id: Uuid, status: RunStatus) -> Result<(), StoreError>;
    async fn get_run(&self, run_id: Uuid) -> Result<Option<RunRecord>, StoreError>;
    async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError>;

    // ---- steps ---
    async fn upsert_step(&self, run_id: Uuid, step_id: &str, status: StepStatus) -> Result<(), StoreError>;
    async fn set_step_status(&self, run_id: Uuid, step_id: &str, status: StepStatus) -> Result<(), StoreError>;
    async fn set_step_resolved_inputs(&self, run_id: Uuid, step_id: &str, inputs: &Value) -> Result<(), StoreError>;
    async fn complete_step(&self, run_id: Uuid, step_id: &str, outputs: &Value) -> Result<(), StoreError>;
    async fn fail_step(&self, run_id: Uuid, step_id: &str, error: &str) -> Result<(), StoreError>;
    async fn get_step_outputs(&self, run_id: Uuid, step_id: &str) -> Result<Option<Value>, StoreError>;
    async fn append_agent_log(&self, run_id: Uuid, step_id: &str, entry: Value) -> Result<(), StoreError>;
    async fn list_steps(&self, run_id: Uuid) -> Result<Vec<StepRecord>, StoreError>;
    async fn get_step(&self, run_id: Uuid, step_id: &str) -> Result<Option<StepRecord>, StoreError>;
}
