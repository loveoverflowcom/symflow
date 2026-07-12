pub mod auth;

use chrono::{DateTime, Utc};
use serde_json::Value;
use symflow_core::state::RunStatus;
use symflow_core::store::{FlowRecord, FlowSummary, RunRecord};
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct FlowRow {
    pub id: String,
    pub name: String,
    pub dsl_script: String,
    pub graph: Option<Value>,
    pub created_at: DateTime<Utc>,
}
impl FlowRow {
    pub fn into_record(self) -> FlowRecord {
        FlowRecord {
            id: self.id,
            name: self.name,
            dsl_script: self.dsl_script,
            graph: self.graph,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct FlowSummaryRow {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}
impl FlowSummaryRow {
    pub fn into_summary(self) -> FlowSummary {
        FlowSummary {
            id: self.id,
            name: self.name,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct FlowRunRow {
    pub id: Uuid,
    pub flow_id: String,
    pub status: String,
    pub initial_inputs: Option<Value>,
    pub output: Option<Value>,
    pub execution_logs: Option<Value>,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}
impl FlowRunRow {
    pub fn into_record(self) -> RunRecord {
        RunRecord {
            id: self.id,
            flow_id: self.flow_id,
            status: RunStatus::from_db_str(&self.status).unwrap_or(RunStatus::Pending),
            initial_inputs: self.initial_inputs,
            output: self.output,
            execution_logs: self.execution_logs,
            error: self.error,
            created_at: self.created_at,
            finished_at: self.finished_at,
        }
    }
}
