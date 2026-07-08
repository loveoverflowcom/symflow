//! Step Executor / Scheduler: chạy step theo thứ tự topo, cô lập lỗi.

use crate::agent::runtime::run_agent;
use crate::compiler;
use crate::dsl::{AiAgentArgs, Flow, StepType};
use crate::error::EngineError;
use crate::events::{emit, EventBus, RunEvent};
use crate::nodes::{build_node, StepCtx};
use crate::resolver;
use crate::state::{RunStatus, StepStatus};
use crate::store::Store;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use uuid::Uuid;

pub struct RunContext {
    pub run_id: Uuid,
    pub sandbox_dir: PathBuf,
    pub initial_inputs: Value,
    pub bus: Option<EventBus>,
}

pub async fn run_flow(
    flow: &Flow,
    ctx: &RunContext,
    store: &dyn Store,
) -> Result<RunStatus, EngineError> {
    let compiled = compiler::compile(flow)?;
    let run_id   = ctx.run_id;

    let step_map: HashMap<&str, &crate::dsl::Step> =
        flow.steps.iter().map(|s| (s.id.as_str(), s)).collect();

    for step_id in &compiled.order {
        store.upsert_step(run_id, step_id, StepStatus::Pending).await?;
    }
    store.set_run_status(run_id, RunStatus::Running).await?;
    emit(ctx.bus.as_ref(), RunEvent::run_status(run_id, RunStatus::Running.as_db_str()));

    let mut statuses: HashMap<String, StepStatus> = HashMap::new();
    let mut any_failed = false;

    for step_id in &compiled.order {
        let step = step_map[step_id.as_str()];

        // Cô lập lỗi: dependency chưa COMPLETED → SKIPPED.
        let skip = step.needs.iter()
            .any(|dep| statuses.get(dep) != Some(&StepStatus::Completed));
        if skip {
            set_status(store, ctx, &mut statuses, step_id, StepStatus::Skipped, None).await?;
            continue;
        }

        set_status(store, ctx, &mut statuses, step_id, StepStatus::Running, None).await?;

        // Resolve token.
        let resolved = match resolver::resolve_value(&step.with, run_id, store).await {
            Ok(v)  => v,
            Err(e) => { any_failed = true; fail(store, ctx, &mut statuses, step_id, &e.to_string()).await?; continue; }
        };
        store.set_step_resolved_inputs(run_id, step_id, &resolved).await?;

        let Some(step_type) = step.step_type() else {
            any_failed = true;
            fail(store, ctx, &mut statuses, step_id, &format!("loại bước không hợp lệ: '{}'", step.kind)).await?;
            continue;
        };

        let outcome: Result<Value, String> = if step_type == StepType::AiAgent {
            run_ai_agent(&resolved, store, ctx, step_id).await
        } else {
            run_linear_node(step_type, &resolved, ctx, step_id).await
        };

        match outcome {
            Ok(outputs) => { store.complete_step(run_id, step_id, &outputs).await?; record(&mut statuses, ctx, step_id, StepStatus::Completed); }
            Err(err)    => { any_failed = true; fail(store, ctx, &mut statuses, step_id, &err).await?; }
        }
    }

    let final_status = if any_failed { RunStatus::Failed } else { RunStatus::Success };
    store.set_run_status(run_id, final_status).await?;
    emit(ctx.bus.as_ref(), RunEvent::run_status(run_id, final_status.as_db_str()));
    Ok(final_status)
}

async fn run_ai_agent(resolved: &Value, store: &dyn Store, ctx: &RunContext, step_id: &str) -> Result<Value, String> {
    let args: AiAgentArgs = serde_json::from_value(resolved.clone())
        .map_err(|e| format!("tham số ai_agent không hợp lệ: {e}"))?;
    run_agent(&args, store, ctx.run_id, step_id, &ctx.sandbox_dir, ctx.bus.as_ref())
        .await.map_err(|e| e.to_string())
}

async fn run_linear_node(step_type: StepType, resolved: &Value, ctx: &RunContext, step_id: &str) -> Result<Value, String> {
    let node = build_node(step_type).ok_or_else(|| "không dựng được node".to_string())?;
    node.run(&StepCtx {
        run_id: ctx.run_id,
        step_id: step_id.to_string(),
        resolved_with: resolved.clone(),
        initial_inputs: ctx.initial_inputs.clone(),
        sandbox_dir: ctx.sandbox_dir.clone(),
    }).await.map_err(|e| e.to_string())
}

fn record(statuses: &mut HashMap<String, StepStatus>, ctx: &RunContext, step_id: &str, status: StepStatus) {
    statuses.insert(step_id.to_string(), status);
    emit(ctx.bus.as_ref(), RunEvent::step_status(ctx.run_id, step_id, status.as_db_str()));
}

async fn set_status(store: &dyn Store, ctx: &RunContext, statuses: &mut HashMap<String, StepStatus>, step_id: &str, status: StepStatus, _error: Option<&str>) -> Result<(), EngineError> {
    store.set_step_status(ctx.run_id, step_id, status).await?;
    record(statuses, ctx, step_id, status);
    Ok(())
}

async fn fail(store: &dyn Store, ctx: &RunContext, statuses: &mut HashMap<String, StepStatus>, step_id: &str, error: &str) -> Result<(), EngineError> {
    tracing::warn!(run_id = %ctx.run_id, step = step_id, %error, "step FAILED");
    store.fail_step(ctx.run_id, step_id, error).await?;
    record(statuses, ctx, step_id, StepStatus::Failed);
    Ok(())
}
