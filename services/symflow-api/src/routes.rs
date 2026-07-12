use axum::{
    extract::{Path, Query, State},
    http::{header::CONTENT_TYPE, HeaderValue, StatusCode},
    response::IntoResponse,
    Json,
};
use serde_json::Value;
use symflow_core::{state::RunStatus, tools};
use uuid::Uuid;

use crate::{
    app::AppState,
    auth::extractor::AuthUser,
    dto::{
        CreateFlowResponse, CreateRunResponse, FlowDetail, FlowRunListItem, FlowSummaryDto,
        FlowUpsertRequest, HealthResponse, RunCreateRequest, RunDetail,
    },
    error::ApiError,
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
        .route("/api/runs", axum::routing::get(list_runs).post(save_run))
        .route("/api/runs/:id", axum::routing::get(get_run))
        .route("/api/agents", axum::routing::get(list_agents))
        .route("/api/agents/:id", axum::routing::get(get_agent))
        .route("/api/tasks", axum::routing::get(list_tasks))
        .route("/api/tasks/:name", axum::routing::post(run_task))
        .route("/api/ocr/proxy", axum::routing::post(proxy_gemini_vision_ocr))
        .route("/api/files/proxy", axum::routing::get(proxy_file))
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
    let flow = state
        .store
        .get_flow(&id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::not_found(format!("Flow '{id}' not found")))?;

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
        graph,
    } = payload;
    if dsl_script.trim().is_empty() {
        return Err(ApiError::unprocessable("TypeScript source cannot be empty"));
    }

    // `id` is optional for creates. The web client normally sends a slug, but
    // the API must also accept a new flow with no client-generated id.
    let final_id = path_id
        .or(id)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let final_name = name
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| final_id.clone());

    state
        .store
        .upsert_flow(&final_id, &final_name, &dsl_script, graph.as_ref())
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

pub async fn save_run(
    _auth: AuthUser,
    State(state): State<AppState>,
    Json(payload): Json<RunCreateRequest>,
) -> Result<impl IntoResponse, ApiError> {
    if !matches!(payload.status, RunStatus::Success | RunStatus::Failed) {
        return Err(ApiError::unprocessable(
            "Browser-submitted run status must be SUCCESS or FAILED",
        ));
    }
    state
        .store
        .get_flow(&payload.flow_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::not_found(format!("Flow '{}' not found", payload.flow_id)))?;
    let run_id = state
        .store
        .create_run(&payload.flow_id, payload.initial_input)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;
    state
        .store
        .save_run_result(
            run_id,
            payload.status,
            payload.output,
            Value::Array(payload.logs),
            payload.error,
        )
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?;

    let run = state
        .store
        .get_run(run_id)
        .await
        .map_err(|err| ApiError::internal(err.to_string()))?
        .ok_or_else(|| ApiError::internal(format!("Run '{run_id}' could not be read back")))?;

    Ok((StatusCode::CREATED, Json(CreateRunResponse::new(run))))
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

    Ok(Json(RunDetail::new(run)))
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

pub async fn list_tasks(
    _auth: AuthUser,
    State(state): State<AppState>,
) -> Json<Vec<crate::task_registry::TaskMeta>> {
    Json(state.tasks.list())
}

pub async fn run_task(
    _auth: AuthUser,
    Path(name): Path<String>,
    State(state): State<AppState>,
    Json(input): Json<Value>,
) -> Result<Json<Value>, ApiError> {
    state
        .tasks
        .execute(&name, input, &state.sandbox_dir)
        .await
        .map(Json)
}

pub async fn proxy_gemini_vision_ocr(
    _auth: AuthUser,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, ApiError> {
    let api_key = std::env::var("GEMINI_API_KEY")
        .or_else(|_| std::env::var("GOOGLE_API_KEY"))
        .map(|value| value.trim().to_owned())
        .unwrap_or_default();
    if api_key.is_empty() {
        return Err(ApiError::internal(
            "GEMINI_API_KEY is required for Gemini vision OCR proxy",
        ));
    }

    let endpoint = std::env::var("GEMINI_VISION_ENDPOINT").unwrap_or_else(|_| {
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent"
            .to_string()
    });
    let response = reqwest::Client::new()
        .post(&endpoint)
        .header("x-goog-api-key", api_key)
        .json(&payload)
        .send()
        .await
        .map_err(|error| ApiError::bad_gateway(format!("Gemini OCR request failed: {error}")))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| ApiError::bad_gateway(format!("Could not read Gemini OCR response: {error}")))?;

    if !status.is_success() {
        return Err(ApiError::bad_gateway(format!(
            "Gemini OCR failed ({}): {}",
            status.as_u16(),
            body.trim()
        )));
    }

    let json_body: Value = serde_json::from_str(&body)
        .map_err(|error| ApiError::bad_gateway(format!("Gemini OCR returned invalid JSON: {error}")))?;
    Ok(Json(json_body))
}

#[derive(Debug, serde::Deserialize)]
pub struct FileProxyQuery {
    url: String,
}

pub async fn proxy_file(
    _auth: AuthUser,
    Query(query): Query<FileProxyQuery>,
) -> Result<impl IntoResponse, ApiError> {
    const MAX_FILE_BYTES: usize = 25 * 1024 * 1024;

    let url = reqwest::Url::parse(query.url.trim())
        .map_err(|error| ApiError::bad_request(format!("Invalid file URL: {error}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(ApiError::bad_request("Only http and https file URLs are supported"));
    }

    let response = reqwest::Client::new()
        .get(url)
        .header(
            reqwest::header::USER_AGENT,
            "Symflow file proxy/0.1 (+http://localhost)",
        )
        .send()
        .await
        .map_err(|error| ApiError::bad_gateway(format!("File proxy request failed: {error}")))?;

    let status = response.status();
    if !status.is_success() {
        return Err(ApiError::bad_gateway(format!(
            "File proxy failed ({}): {}",
            status.as_u16(),
            status.canonical_reason().unwrap_or("upstream error")
        )));
    }

    if response.content_length().is_some_and(|length| length > MAX_FILE_BYTES as u64) {
        return Err(ApiError::unprocessable("File is too large to proxy"));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| HeaderValue::from_str(value).ok())
        .unwrap_or_else(|| HeaderValue::from_static("application/octet-stream"));
    let bytes = response
        .bytes()
        .await
        .map_err(|error| ApiError::bad_gateway(format!("Could not read proxied file: {error}")))?;
    if bytes.len() > MAX_FILE_BYTES {
        return Err(ApiError::unprocessable("File is too large to proxy"));
    }

    Ok(([(CONTENT_TYPE, content_type)], bytes))
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
    async fn post_typescript_persists_source_verbatim() {
        let source = "export async function main(input: unknown) {\n  return input;\n}\n";
        let payload = json!({
            "id": "typescript-flow",
            "name": "TypeScript flow",
            "dsl_script": source,
            "graph": {
                "nodes": [{"id": "task_1", "type": "task", "name": "web_scraper"}],
                "inputs": []
            }
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::OK);
        let response: Value = serde_json::from_str(&body).expect("JSON response");
        assert_eq!(response["dsl_script"], source);
        assert_eq!(response["graph"]["nodes"][0]["id"], "task_1");
    }

    #[tokio::test]
    async fn task_registry_endpoint_lists_editor_tasks() {
        let (status, body) =
            send_json(router(test_state()), "GET", "/api/tasks", Value::Null).await;

        assert_eq!(status, StatusCode::OK);
        let tasks: Vec<Value> = serde_json::from_str(&body).expect("task list");
        assert!(tasks.iter().any(|task| task["name"] == "web_scraper"));
        assert!(tasks.iter().any(|task| task["name"] == "ai_agent"));
        assert!(tasks.iter().any(|task| task["name"] == "pdf_report"));
        assert!(tasks.iter().all(|task| task["runtime"] == "remote"));
    }

    #[tokio::test]
    async fn empty_typescript_returns_unprocessable_entity() {
        let payload = json!({
            "id": "broken",
            "name": "Broken",
            "dsl_script": "   "
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
        assert!(body.contains("TypeScript source cannot be empty"));
    }

    #[tokio::test]
    async fn request_id_is_used_as_storage_id() {
        let payload = json!({
            "id": "request-flow-id",
            "name": "Stored TypeScript",
            "dsl_script": "export async function main() { return 42; }"
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::OK);
        let response: Value = serde_json::from_str(&body).expect("JSON response");
        assert_eq!(response["id"], "request-flow-id");
    }

    #[tokio::test]
    async fn create_flow_generates_id_when_request_omits_id() {
        let payload = json!({
            "name": "Generated id flow",
            "dsl_script": "export async function main() { return 42; }"
        });

        let (status, body) = send_json(router(test_state()), "POST", "/api/flows", payload).await;

        assert_eq!(status, StatusCode::OK);
        let response: Value = serde_json::from_str(&body).expect("JSON response");
        assert!(response["id"].as_str().is_some_and(|id| !id.is_empty()));
        assert_eq!(response["name"], "Generated id flow");
    }

    #[tokio::test]
    async fn browser_result_is_saved_as_a_terminal_run() {
        let state = test_state();
        let app = router(state.clone());
        let payload = json!({
            "id": "browser-flow",
            "name": "Browser flow",
            "dsl_script": "export async function main() { return { ok: true }; }"
        });

        let (save_status, _) = send_json(app.clone(), "POST", "/api/flows", payload).await;
        assert_eq!(save_status, StatusCode::OK);
        let (run_status, run_body) = send_json(
            app.clone(),
            "POST",
            "/api/runs",
            json!({
                "flow_id": "browser-flow",
                "initial_input": {},
                "status": "SUCCESS",
                "output": {"ok": true},
                "logs": [{"type": "success", "timestamp": 1}]
            }),
        )
        .await;
        assert_eq!(run_status, StatusCode::CREATED);
        let saved_run: Value = serde_json::from_str(&run_body).expect("run response");
        let run_id = saved_run["id"].as_str().expect("run id");
        let (get_status, get_body) =
            send_json(app, "GET", &format!("/api/runs/{run_id}"), Value::Null).await;
        assert_eq!(get_status, StatusCode::OK);
        let fetched: Value = serde_json::from_str(&get_body).expect("get response");
        assert_eq!(fetched["output"], json!({"ok": true}));
        assert_eq!(fetched["execution_logs"][0]["type"], "success");
    }
}
