use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::Value;
use std::sync::Arc;
use symflow_core::{
    compiler,
    dsl::Flow,
    events::{emit, RunEvent},
    executor::{run_flow, RunContext},
    state::RunStatus,
    tools,
};
use uuid::Uuid;

use crate::{
    app::AppState,
    auth::extractor::AuthUser,
    compat::parse_flow_script,
    dto::{
        CreateFlowResponse, CreateRunResponse, FlowDetail, FlowRunListItem, FlowSummaryDto,
        FlowUpsertRequest, HealthResponse, RunCreateRequest, RunDetail, StepDetail,
    },
    error::ApiError,
    realtime::run_logs_ws,
};

pub fn router(state: AppState) -> axum::Router {
    axum::Router::new()
        .route("/health", axum::routing::get(health))
        .route(
            "/api/flows",
            axum::routing::get(list_flows).post(create_flow),
        )
        .route(
            "/api/flows/:id",
            axum::routing::get(get_flow)
                .put(update_flow)
                .delete(delete_flow),
        )
        .route("/api/flows/:id/runs", axum::routing::post(trigger_run))
        .route("/api/runs", axum::routing::get(list_runs))
        .route("/api/runs/:id", axum::routing::get(get_run))
        .route("/api/runs/:id/steps/:step_id", axum::routing::get(get_step))
        .route("/api/runs/:id/logs", axum::routing::get(run_logs_ws))
        .route("/api/agents", axum::routing::get(list_agents))
        .route("/api/agents/:id", axum::routing::get(get_agent))
        .merge(crate::auth::routes::router())
        .with_state(state)
}

pub async fn health() -> impl IntoResponse {
    Json(HealthResponse {
        ok: true,
        service: "symflow-api",
    })
}

pub async fn list_flows(
    _auth: AuthUser,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let flows = state
        .store
        .list_flows()
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;
    Ok(Json(
        flows
            .into_iter()
            .map(FlowSummaryDto::from)
            .collect::<Vec<_>>(),
    ))
}

pub async fn get_flow(
    _auth: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let mut flow = state
        .store
        .get_flow(&id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::not_found(format!("Flow '{id}' not found")))?;

    let stored_payload = FlowUpsertRequest {
        id: Some(flow.id.clone()),
        name: Some(flow.name.clone()),
        dsl_script: flow.dsl_script.clone(),
    };
    if let Ok(definition) = parse_flow_script(&stored_payload, Some(&flow.id)) {
        if let Ok(normalized) = serde_json::to_string_pretty(&definition) {
            flow.dsl_script = normalized;
        }
    }

    Ok(Json(FlowDetail::from(flow)))
}

pub async fn create_flow(
    _auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<FlowUpsertRequest>,
) -> Result<impl IntoResponse, ApiError> {
    persist_flow(state, None, payload).await
}

pub async fn update_flow(
    _auth: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<FlowUpsertRequest>,
) -> Result<impl IntoResponse, ApiError> {
    persist_flow(state, Some(id), payload).await
}

pub async fn delete_flow(
    _auth: AuthUser,
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let deleted = state
        .store
        .delete_flow(&id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    if !deleted {
        return Err(ApiError::not_found(format!("Flow '{id}' not found")));
    }

    Ok(StatusCode::NO_CONTENT)
}

async fn persist_flow(
    state: AppState,
    path_id: Option<String>,
    payload: FlowUpsertRequest,
) -> Result<impl IntoResponse, ApiError> {
    let FlowUpsertRequest {
        id,
        name,
        dsl_script,
    } = payload;
    let payload_for_parse = FlowUpsertRequest {
        id: id.clone(),
        name: name.clone(),
        dsl_script: dsl_script.clone(),
    };

    let fallback_id = path_id.as_deref().or(id.as_deref());
    let flow = parse_flow_script(&payload_for_parse, fallback_id)
        .map_err(|err| ApiError::unprocessable(err.to_string()))?;

    flow.validate()
        .map_err(|err| ApiError::unprocessable(err.to_string()))?;
    compiler::compile(&flow).map_err(|err| ApiError::unprocessable(err.to_string()))?;
    let normalized_dsl_script = serde_json::to_string_pretty(&flow)
        .map_err(|err| ApiError::internal(format!("Could not serialize JSON DSL: {err}")))?;

    let final_id = path_id
        .or(id)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| flow.flow_id.clone());

    let final_name = name
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            if flow.name.trim().is_empty() {
                None
            } else {
                Some(flow.name.clone())
            }
        })
        .unwrap_or_else(|| final_id.clone());

    state
        .store
        .upsert_flow(&final_id, &final_name, &normalized_dsl_script)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    let saved = state
        .store
        .get_flow(&final_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::internal(format!("Flow '{final_id}' could not be read back")))?;

    Ok((StatusCode::OK, Json(CreateFlowResponse::new(saved))))
}

pub async fn trigger_run(
    _auth: AuthUser,
    Path(flow_id): Path<String>,
    State(state): State<AppState>,
    Json(payload): Json<RunCreateRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let flow = state
        .store
        .get_flow(&flow_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::not_found(format!("Flow '{flow_id}' not found")))?;

    let flow_definition: Flow = parse_flow_script(
        &FlowUpsertRequest {
            id: Some(flow_id.clone()),
            name: Some(flow.name.clone()),
            dsl_script: flow.dsl_script.clone(),
        },
        Some(&flow_id),
    )
    .map_err(|err| ApiError::unprocessable(err.to_string()))?;

    let initial_inputs = payload.into_initial_inputs();
    let run_id = state
        .store
        .create_run(&flow_id, initial_inputs.clone())
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    let sandbox_dir = state.sandbox_dir.clone();
    let store = Arc::clone(&state.store);
    let bus = state.bus.clone();
    tokio::spawn(async move {
        let bus_for_ctx = bus.clone();
        let ctx = RunContext {
            run_id,
            sandbox_dir,
            initial_inputs: initial_inputs.unwrap_or_else(|| Value::Object(serde_json::Map::new())),
            bus: Some(bus_for_ctx),
        };

        if let Err(err) = run_flow(&flow_definition, &ctx, store.as_ref()).await {
            tracing::error!(run_id = %run_id, error = %err, "background run failed");
            let _ = store.set_run_status(run_id, RunStatus::Failed).await;
            emit(
                ctx.bus.as_ref(),
                RunEvent::run_status(run_id, RunStatus::Failed.as_db_str()),
            );
        }
    });

    let run = state
        .store
        .get_run(run_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::internal(format!("Run '{run_id}' could not be read back")))?;

    let steps = state
        .store
        .list_steps(run_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    Ok((
        StatusCode::ACCEPTED,
        Json(CreateRunResponse::new(run, steps)),
    ))
}

pub async fn get_run(
    _auth: AuthUser,
    Path(id): Path<Uuid>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let run = state
        .store
        .get_run(id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::not_found(format!("Run '{id}' not found")))?;

    let steps = state
        .store
        .list_steps(id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    Ok(Json(RunDetail::new(run, steps)))
}

pub async fn get_step(
    _auth: AuthUser,
    Path((run_id, step_id)): Path<(Uuid, String)>,
    State(state): State<AppState>,
) -> Result<impl IntoResponse, ApiError> {
    let step = state
        .store
        .get_step(run_id, &step_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| {
            ApiError::not_found(format!("Step '{step_id}' not found for run '{run_id}'"))
        })?;

    Ok(Json(StepDetail::from(step)))
}

#[derive(Debug, Default, serde::Deserialize)]
pub struct ListRunsQuery {
    pub flow_id: Option<String>,
}

pub async fn list_runs(
    _auth: AuthUser,
    State(state): State<AppState>,
    Query(query): Query<ListRunsQuery>,
) -> Result<impl IntoResponse, ApiError> {
    let mut runs = state
        .store
        .list_runs()
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    if let Some(flow_id) = query
        .flow_id
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        runs.retain(|run| run.flow_id == flow_id);
    }

    let items = runs
        .into_iter()
        .map(|run| FlowRunListItem {
            id: run.id.to_string(),
            flow_id: run.flow_id,
            status: run.status,
            initial_inputs: run.initial_inputs,
            created_at: run.created_at,
            finished_at: run.finished_at,
        })
        .collect::<Vec<_>>();

    Ok(Json(items))
}

pub async fn list_agents() -> Result<impl IntoResponse, ApiError> {
    let agents = tools::catalog();
    Ok(Json(agents))
}

pub async fn get_agent(Path(id): Path<String>) -> Result<impl IntoResponse, ApiError> {
    let agent = tools::agent_catalog(&id)
        .ok_or_else(|| ApiError::not_found(format!("Agent '{id}' not found")))?;
    Ok(Json(agent))
}

#[cfg(test)]
mod tests {
    use super::router;
    use crate::app::AppState;
    use axum::{
        body::{to_bytes, Body},
        http::{Request, StatusCode},
    };
    use serde_json::{json, Value};
    use tower::ServiceExt;

    fn test_state() -> AppState {
        AppState::new(std::env::temp_dir().join("symflow-api-tests"))
    }

    async fn send_json(
        app: axum::Router,
        method: &str,
        uri: &str,
        payload: Value,
    ) -> (StatusCode, String) {
        let response = app
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .header("content-type", "application/json")
                    .body(Body::from(payload.to_string()))
                    .expect("request"),
            )
            .await
            .expect("router response");
        let status = response.status();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body");
        (
            status,
            String::from_utf8(body.to_vec()).expect("UTF-8 body"),
        )
    }

    #[tokio::test]
    async fn post_json_persists_and_returns_pretty_json() {
        let payload = json!({
            "name": "JSON flow",
            "dsl_script": "{\"flow_id\":\"json-flow\",\"name\":\"JSON flow\",\"steps\":[{\"id\":\"start\",\"type\":\"manual_trigger\"}]}"
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::OK);
        let response: Value = serde_json::from_str(&body).expect("JSON response");
        let script = response["dsl_script"].as_str().expect("DSL string");
        assert!(script.contains("\n  \"flow_id\": \"json-flow\""));
        assert_eq!(
            serde_json::from_str::<Value>(script).expect("normalized JSON")["flow_id"],
            "json-flow"
        );
    }

    #[tokio::test]
    async fn malformed_json_returns_unprocessable_entity() {
        let payload = json!({
            "name": "Broken",
            "dsl_script": "{\"flow_id\":\"broken\",]"
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert!(body.contains("invalid JSON DSL"));
    }

    #[tokio::test]
    async fn legacy_json_gets_flow_id_from_request_id() {
        let payload = json!({
            "id": "request-flow-id",
            "name": "Legacy JSON",
            "dsl_script": "{\"name\":\"Legacy JSON\",\"steps\":[{\"id\":\"start\",\"type\":\"manual_trigger\"}]}"
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::OK);
        let response: Value = serde_json::from_str(&body).expect("JSON response");
        let script = response["dsl_script"].as_str().expect("DSL string");
        assert_eq!(
            serde_json::from_str::<Value>(script).expect("normalized JSON")["flow_id"],
            "request-flow-id"
        );
    }

    #[tokio::test]
    async fn legacy_yaml_is_saved_as_json_and_can_trigger() {
        let state = test_state();
        let app = router(state.clone());
        let payload = json!({
            "id": "legacy-yaml",
            "name": "Legacy YAML",
            "dsl_script": "name: Legacy YAML\nsteps:\n  - id: start\n    type: manual_trigger\n"
        });

        let (save_status, save_body) = send_json(app.clone(), "POST", "/api/flows", payload).await;
        assert_eq!(save_status, StatusCode::OK);
        let saved: Value = serde_json::from_str(&save_body).expect("save response");
        serde_json::from_str::<Value>(saved["dsl_script"].as_str().expect("DSL string"))
            .expect("saved script is JSON");

        let (run_status, _) = send_json(
            app,
            "POST",
            "/api/flows/legacy-yaml/runs",
            json!({"inputs": {}}),
        )
        .await;
        assert_eq!(run_status, StatusCode::ACCEPTED);

        state
            .store
            .upsert_flow(
                "stored-yaml",
                "Stored YAML",
                "name: Stored YAML\nsteps:\n  - id: start\n    type: manual_trigger\n",
            )
            .await
            .expect("seed legacy stored flow");
        let (get_status, get_body) =
            send_json(router(state), "GET", "/api/flows/stored-yaml", Value::Null).await;
        assert_eq!(get_status, StatusCode::OK);
        let fetched: Value = serde_json::from_str(&get_body).expect("get response");
        let fetched_script = fetched["dsl_script"].as_str().expect("fetched DSL");
        assert_eq!(
            serde_json::from_str::<Value>(fetched_script).expect("GET returns JSON")["flow_id"],
            "stored-yaml"
        );
    }
}
