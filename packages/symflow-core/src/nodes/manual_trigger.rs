use super::{NodeExec, StepCtx};
use crate::error::NodeError;
use async_trait::async_trait;
use serde_json::Value;

pub struct ManualTriggerNode;

#[async_trait]
impl NodeExec for ManualTriggerNode {
    async fn run(&self, ctx: &StepCtx) -> Result<Value, NodeError> {
        let mut out = ctx.resolved_with.clone();
        if let (Some(obj), Some(init)) = (out.as_object_mut(), ctx.initial_inputs.as_object()) {
            for (k, v) in init { obj.entry(k).or_insert_with(|| v.clone()); }
        }
        Ok(out)
    }
}
