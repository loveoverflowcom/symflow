use chrono::{DateTime, Utc};
use symflow_core::state::{RunStatus, StepStatus};
use symflow_core::store::{FlowRecord, FlowSummary, RunRecord, StepRecord};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, sqlx::FromRow)]
pub struct FlowRow { pub id: String, pub name: String, pub dsl_script: String, pub created_at: DateTime<Utc> }
impl FlowRow {
    pub fn into_record(self) -> FlowRecord {
        FlowRecord { id: self.id, name: self.name, dsl_script: self.dsl_script, created_at: self.created_at }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct FlowSummaryRow { pub id: String, pub name: String, pub created_at: DateTime<Utc> }
impl FlowSummaryRow {
    pub fn into_summary(self) -> FlowSummary {
        FlowSummary { id: self.id, name: self.name, created_at: self.created_at }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct FlowRunRow {
    pub id: Uuid, pub flow_id: String, pub status: String,
    pub initial_inputs: Option<Value>, pub created_at: DateTime<Utc>, pub finished_at: Option<DateTime<Utc>>,
}
impl FlowRunRow {
    pub fn into_record(self) -> RunRecord {
        RunRecord {
            id: self.id, flow_id: self.flow_id,
            status: RunStatus::from_db_str(&self.status).unwrap_or(RunStatus::Pending),
            initial_inputs: self.initial_inputs, created_at: self.created_at, finished_at: self.finished_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub struct StepExecRow {
    pub run_id: Uuid, pub step_id: String, pub status: String,
    pub resolved_inputs: Option<Value>, pub outputs: Option<Value>,
    pub agent_logs: Option<Value>, pub error: Option<String>, pub executed_at: DateTime<Utc>,
}
impl StepExecRow {
    pub fn into_record(self) -> StepRecord {
        StepRecord {
            run_id: self.run_id, step_id: self.step_id,
            status: StepStatus::from_db_str(&self.status).unwrap_or(StepStatus::Pending),
            resolved_inputs: self.resolved_inputs, outputs: self.outputs,
            agent_logs: self.agent_logs, error: self.error, executed_at: self.executed_at,
        }
    }
}
