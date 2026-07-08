//! RunEvent phát realtime qua broadcast; symflow-api subscribe và forward xuống FE.

use serde::Serialize;
use serde_json::{json, Value};
use uuid::Uuid;

pub type EventBus = tokio::sync::broadcast::Sender<RunEvent>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum EventKind {
    Thought,
    Action,
    Observation,
    FinalAnswer,
    StepStatus,
    RunStatus,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunEvent {
    pub run_id: Uuid,
    #[serde(rename = "type")]
    pub kind: EventKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub step_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub iter: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub arguments: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
}

impl RunEvent {
    fn base(run_id: Uuid, kind: EventKind) -> Self {
        RunEvent { run_id, kind, step_id: None, iter: None, text: None,
                   tool: None, arguments: None, status: None }
    }

    pub fn thought(run_id: Uuid, step_id: &str, iter: u32, text: impl Into<String>) -> Self {
        RunEvent { step_id: Some(step_id.into()), iter: Some(iter), text: Some(text.into()),
                   ..Self::base(run_id, EventKind::Thought) }
    }
    pub fn action(run_id: Uuid, step_id: &str, iter: u32, tool: impl Into<String>, arguments: Value) -> Self {
        RunEvent { step_id: Some(step_id.into()), iter: Some(iter),
                   tool: Some(tool.into()), arguments: Some(arguments),
                   ..Self::base(run_id, EventKind::Action) }
    }
    pub fn observation(run_id: Uuid, step_id: &str, iter: u32, text: impl Into<String>) -> Self {
        RunEvent { step_id: Some(step_id.into()), iter: Some(iter), text: Some(text.into()),
                   ..Self::base(run_id, EventKind::Observation) }
    }
    pub fn final_answer(run_id: Uuid, step_id: &str, iter: u32, text: impl Into<String>) -> Self {
        RunEvent { step_id: Some(step_id.into()), iter: Some(iter), text: Some(text.into()),
                   ..Self::base(run_id, EventKind::FinalAnswer) }
    }
    pub fn step_status(run_id: Uuid, step_id: &str, status: impl Into<String>) -> Self {
        RunEvent { step_id: Some(step_id.into()), status: Some(status.into()),
                   ..Self::base(run_id, EventKind::StepStatus) }
    }
    pub fn run_status(run_id: Uuid, status: impl Into<String>) -> Self {
        RunEvent { status: Some(status.into()), ..Self::base(run_id, EventKind::RunStatus) }
    }

    /// Bản ghi rút gọn lưu vào `step_executions.agent_logs`.
    pub fn log_entry(&self) -> Value {
        let mut m = serde_json::Map::new();
        if let Some(i) = self.iter { m.insert("iter".into(), json!(i)); }
        m.insert("runId".into(), json!(self.run_id));
        if let Some(step_id) = &self.step_id {
            m.insert("stepId".into(), json!(step_id));
        }
        m.insert("type".into(), json!(self.kind));
        if let Some(t) = &self.text      { m.insert("text".into(), json!(t)); }
        if let Some(t) = &self.tool      { m.insert("tool".into(), json!(t)); }
        if let Some(a) = &self.arguments { m.insert("arguments".into(), a.clone()); }
        Value::Object(m)
    }

    pub fn from_log_entry(run_id: Uuid, step_id: &str, entry: &Value) -> Option<Self> {
        let Value::Object(map) = entry else {
            return None;
        };

        let kind = map
            .get("type")
            .and_then(Value::as_str)
            .and_then(parse_kind)?;
        let iter = map
            .get("iter")
            .and_then(Value::as_u64)
            .and_then(|value| u32::try_from(value).ok());
        let text = map.get("text").and_then(Value::as_str).map(ToOwned::to_owned);
        let tool = map.get("tool").and_then(Value::as_str).map(ToOwned::to_owned);
        let arguments = map.get("arguments").cloned();

        Some(match kind {
            EventKind::Thought => Self::thought(run_id, step_id, iter.unwrap_or_default(), text.unwrap_or_default()),
            EventKind::Action => Self::action(
                run_id,
                step_id,
                iter.unwrap_or_default(),
                tool.unwrap_or_default(),
                arguments.unwrap_or(Value::Object(serde_json::Map::new())),
            ),
            EventKind::Observation => Self::observation(run_id, step_id, iter.unwrap_or_default(), text.unwrap_or_default()),
            EventKind::FinalAnswer => Self::final_answer(run_id, step_id, iter.unwrap_or_default(), text.unwrap_or_default()),
            EventKind::StepStatus => Self::step_status(
                run_id,
                step_id,
                map.get("status").and_then(Value::as_str).unwrap_or_default(),
            ),
            EventKind::RunStatus => Self::run_status(
                run_id,
                map.get("status").and_then(Value::as_str).unwrap_or_default(),
            ),
        })
    }
}

pub fn emit(bus: Option<&EventBus>, event: RunEvent) {
    if let Some(tx) = bus { let _ = tx.send(event); }
}

fn parse_kind(raw: &str) -> Option<EventKind> {
    match raw {
        "thought" => Some(EventKind::Thought),
        "action" => Some(EventKind::Action),
        "observation" => Some(EventKind::Observation),
        "final" | "finalAnswer" => Some(EventKind::FinalAnswer),
        "step_status" | "stepStatus" => Some(EventKind::StepStatus),
        "run_status" | "runStatus" => Some(EventKind::RunStatus),
        _ => None,
    }
}
