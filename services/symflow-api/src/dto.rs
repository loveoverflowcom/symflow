use serde::{Deserialize, Serialize};
use serde_json::Value;
use symflow_core::state::RunStatus;
use symflow_core::store::{FlowRecord, FlowSummary, RunRecord, StepRecord};

#[derive(Debug, Clone, Deserialize)]
pub struct FlowUpsertRequest {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    pub dsl_script: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct RunCreateRequest {
    #[serde(default)]
    pub inputs: Option<Value>,
    #[serde(default)]
    pub initial_inputs: Option<Value>,
}

impl RunCreateRequest {
    pub fn into_initial_inputs(self) -> Option<Value> {
        self.inputs.or(self.initial_inputs)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct FlowDetail {
    #[serde(flatten)]
    pub flow: FlowRecord,
}

impl From<FlowRecord> for FlowDetail {
    fn from(flow: FlowRecord) -> Self {
        Self { flow }
    }
}

impl From<FlowSummary> for FlowSummaryDto {
    fn from(flow: FlowSummary) -> Self {
        Self { id: flow.id, name: flow.name, created_at: flow.created_at }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct FlowSummaryDto {
    pub id: String,
    pub name: String,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub struct FlowRunListItem {
    pub id: String,
    pub flow_id: String,
    pub status: RunStatus,
    pub initial_inputs: Option<Value>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub finished_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunDetail {
    #[serde(flatten)]
    pub run: RunRecord,
    pub steps: Vec<StepRecord>,
}

impl RunDetail {
    pub fn new(run: RunRecord, steps: Vec<StepRecord>) -> Self {
        Self { run, steps }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct StepDetail {
    #[serde(flatten)]
    pub step: StepRecord,
}

impl From<StepRecord> for StepDetail {
    fn from(step: StepRecord) -> Self {
        Self { step }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct HealthResponse {
    pub ok: bool,
    pub service: &'static str,
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateFlowResponse {
    #[serde(flatten)]
    pub flow: FlowDetail,
}

impl CreateFlowResponse {
    pub fn new(flow: FlowRecord) -> Self {
        Self { flow: FlowDetail::from(flow) }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct CreateRunResponse {
    #[serde(flatten)]
    pub run: RunDetail,
}

impl CreateRunResponse {
    pub fn new(run: RunRecord, steps: Vec<StepRecord>) -> Self {
        Self { run: RunDetail::new(run, steps) }
    }
}
