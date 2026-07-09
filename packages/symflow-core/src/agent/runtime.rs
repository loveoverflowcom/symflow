//! Vòng lặp Agent ReAct: Thought → Action → Observation → Final Answer.

use super::llm;
use super::parser::{parse_react, ReAct};
use super::prompt;
use crate::dsl::AiAgentArgs;
use crate::error::AgentError;
use crate::events::{emit, EventBus, RunEvent};
use crate::store::Store;
use std::path::PathBuf;
use uuid::Uuid;

pub async fn run_agent(
    args: &AiAgentArgs,
    store: &dyn Store,
    run_id: Uuid,
    step_id: &str,
    sandbox_dir: &PathBuf,
    bus: Option<&EventBus>,
) -> Result<serde_json::Value, AgentError> {
    let tool_schemas = crate::tools::schemas_for(&args.allowed_tools);
    let mut history = prompt::init_history(&args.goal, &args.context, &tool_schemas);

    for iter in 0..args.max_iterations {
        let raw = llm::chat(&args.model, &history).await?;

        emit(bus, RunEvent::thought(run_id, step_id, iter, &raw));
        let _ = store
            .append_agent_log(
                run_id,
                step_id,
                RunEvent::thought(run_id, step_id, iter, &raw).log_entry(),
            )
            .await;

        match parse_react(&raw)? {
            ReAct::Final(answer) => {
                emit(bus, RunEvent::final_answer(run_id, step_id, iter, &answer));
                let _ = store
                    .append_agent_log(
                        run_id,
                        step_id,
                        RunEvent::final_answer(run_id, step_id, iter, &answer).log_entry(),
                    )
                    .await;
                return Ok(serde_json::json!({ "result": answer }));
            }
            ReAct::Action { tool, arguments } => {
                emit(
                    bus,
                    RunEvent::action(run_id, step_id, iter, &tool, arguments.clone()),
                );
                let _ = store
                    .append_agent_log(
                        run_id,
                        step_id,
                        RunEvent::action(run_id, step_id, iter, &tool, arguments.clone())
                            .log_entry(),
                    )
                    .await;

                let observation = if crate::tools::is_allowed(&tool, &args.allowed_tools) {
                    let ctx = crate::protocol::ToolContext {
                        sandbox_dir: sandbox_dir.clone(),
                    };
                    match crate::tools::dispatch(&tool, arguments, &ctx).await {
                        Ok(output) => output.to_text(),
                        Err(e) => format!("Tool error: {e}"),
                    }
                } else {
                    format!("Tool '{tool}' không được phép.")
                };

                emit(
                    bus,
                    RunEvent::observation(run_id, step_id, iter, &observation),
                );
                let _ = store
                    .append_agent_log(
                        run_id,
                        step_id,
                        RunEvent::observation(run_id, step_id, iter, &observation).log_entry(),
                    )
                    .await;

                prompt::push_observation(&mut history, &raw, &observation);
            }
        }
    }
    Err(AgentError::MaxIterations(args.max_iterations))
}
