use super::{NodeExec, StepCtx};
use crate::error::NodeError;
use async_trait::async_trait;
use serde_json::Value;

pub struct ManualTriggerNode;

#[async_trait]
impl NodeExec for ManualTriggerNode {
    async fn run(&self, ctx: &StepCtx) -> Result<Value, NodeError> {
        Ok(apply_initial_inputs(
            ctx.resolved_with.clone(),
            &ctx.initial_inputs,
        ))
    }
}

pub fn apply_initial_inputs(mut defaults: Value, initial_inputs: &Value) -> Value {
    if let (Some(defaults), Some(inputs)) = (defaults.as_object_mut(), initial_inputs.as_object()) {
        for (key, value) in inputs {
            defaults.insert(key.clone(), value.clone());
        }
    }
    defaults
}
