# Hermes Connector — Rust Microservice

> Version: 1.0
> Status: Draft
> Scope: Rust microservice bridging Symflow ↔ Hermes VLM/LLM

---

## 1. Context & Position in the Architecture

Symflow currently calls LLMs directly from `packages/symflow-core/src/agent/llm.rs` via
`LLM_BASE_URL` (OpenAI-compatible). Hermes is a VPS running a VLM (vision + text) served
by vllm at `http://HERMES_VPS_IP:8000/v1`. A dedicated connector is needed because:

1. Hermes handles both **text chat** and **vision/document extraction** (multimodal payloads).
2. Symflow needs **structured JSON** back from extraction calls, not raw markdown.
3. The OCR pipeline (`id-card-ocr-extraction.md`) needs a server-side fallback (Layer 3B)
   when Tesseract.js confidence is too low.
4. Isolating the connector as a microservice keeps `symflow-core` clean and lets the
   connector have its own timeout config, auth, and scaling knobs.

### Data flow

```
┌───────────────────────────────────────────┐
│  Symflow Flow DSL                         │
│  (ai_agent step / id_card_ocr node)       │
└──────────────────┬────────────────────────┘
                   │ HTTP POST (JSON)
                   ▼
┌───────────────────────────────────────────┐
│  hermes-connector  :3100                  │
│  (Rust · axum · reqwest)                  │
│                                           │
│  POST /v1/chat      → LLM text            │
│  POST /v1/extract   → VLM doc/image       │
└──────────────────┬────────────────────────┘
                   │ HTTP POST  OpenAI-compatible
                   ▼
┌───────────────────────────────────────────┐
│  Hermes VPS  http://HERMES_VPS_IP:8000    │
│  vllm serve <any model>                   │
│  /v1/chat/completions                     │
└───────────────────────────────────────────┘
```

---

## 2. Project Structure

```
services/hermes-connector/
├── Cargo.toml
├── Makefile
├── .env.example
└── src/
    ├── main.rs           ← Server startup, config load
    ├── config.rs         ← Read environment variables
    ├── routes.rs         ← axum router registration
    ├── handlers/
    │   ├── mod.rs
    │   ├── chat.rs       ← POST /v1/chat
    │   └── extract.rs    ← POST /v1/extract
    ├── hermes_client.rs  ← Call Hermes /v1/chat/completions
    ├── models.rs         ← Request/Response types
    └── error.rs          ← AppError → HTTP response mapping
```

---

## 3. Cargo.toml

```toml
[package]
name    = "hermes-connector"
version = "0.1.0"
edition = "2021"

[[bin]]
name = "hermes-connector"
path = "src/main.rs"

[dependencies]
axum               = { version = "0.7.9",  features = ["multipart"] }
tokio              = { version = "1.44.2", features = ["full"] }
reqwest            = { version = "0.12.15", features = ["json", "multipart"] }
serde              = { version = "1.0",    features = ["derive"] }
serde_json         = "1.0"
tower-http         = { version = "0.5.2",  features = ["trace", "cors"] }
tracing            = "0.1"
tracing-subscriber = { version = "0.3",    features = ["env-filter"] }
dotenvy            = "0.15"
thiserror          = "2.0"
base64             = "0.22"
```

---

## 4. Standalone Makefile

For running the connector in isolation (e.g. from `services/hermes-connector/`):

```makefile
.PHONY: build run test fmt check

SERVICE_DIR = services/hermes-connector

build:
	cargo build --manifest-path $(SERVICE_DIR)/Cargo.toml --release

run:
	cargo run --manifest-path $(SERVICE_DIR)/Cargo.toml

test:
	cargo test --manifest-path $(SERVICE_DIR)/Cargo.toml -- --nocapture

fmt:
	cargo fmt --manifest-path $(SERVICE_DIR)/Cargo.toml

check:
	cargo clippy --manifest-path $(SERVICE_DIR)/Cargo.toml -- -D warnings
```

---

## 5. Environment Variables — `.env.example`

```dotenv
# Hermes VPS endpoint (vllm OpenAI-compatible base URL)
HERMES_BASE_URL=http://HERMES_VPS_IP:8000/v1

# Model to request. If unset, the connector asks Hermes which model is loaded
# via GET /v1/models and picks the first one automatically.
# HERMES_MODEL=

# API key for Hermes, if required. Leave unset if the VPS has no auth.
# HERMES_API_KEY=

# Hermes call timeout in seconds
HERMES_TIMEOUT_SECS=60

# Port this connector listens on
CONNECTOR_PORT=3100
```

**Model resolution order:**
1. `HERMES_MODEL` env var (explicit override)
2. First model returned by `GET {HERMES_BASE_URL}/models` (auto-discovery)

This means the connector works regardless of what model Hermes is currently serving —
swapping models on the VPS requires no config change on the connector side.

**API key:**
`HERMES_API_KEY` is optional. If set, it is forwarded as `Authorization: Bearer <key>` to
every Hermes request. Whether Hermes actually requires a key is the VPS operator's decision.

---

## 6. Integration with `api-dev` (Makefile.toml)

`api-dev` in `services/symflow-api/Makefile.toml` currently starts Postgres then runs
`symflow-api`. It should also start `hermes-connector` as a background process so that
OCR fallback and VLM-backed flows work during local development without any extra manual step.

**Changes to `services/symflow-api/Makefile.toml`:**

```toml
[tasks.hermes-connector]
description = "Start hermes-connector in the background."
script = '''
set -eu

HERMES_BASE_URL="${HERMES_BASE_URL:-http://localhost:8000/v1}"
CONNECTOR_PORT="${CONNECTOR_PORT:-3100}"
RUST_LOG="${RUST_LOG:-info}"

export HERMES_BASE_URL
export CONNECTOR_PORT
export RUST_LOG

# Run detached; log to /tmp/hermes-connector.log for easy tailing.
cargo run --bin hermes-connector \
  --manifest-path ../../services/hermes-connector/Cargo.toml \
  > /tmp/hermes-connector.log 2>&1 &

echo "hermes-connector started (PID $!), logs: /tmp/hermes-connector.log"
'''

[tasks.api-dev]
description = "Start Postgres + hermes-connector, then run symflow-api locally."
dependencies = ["postgres", "postgres-wait", "hermes-connector"]
script = '''
set -eu

DATABASE_URL="${SYMFLOW_API_DEV_DATABASE_URL:-postgres://${POSTGRES_USER:-symflow}:${POSTGRES_PASSWORD:-symflow}@127.0.0.1:${POSTGRES_PORT:-5432}/${POSTGRES_DB:-symflow}?sslmode=disable}"
SYMFLOW_API_ADDR="${SYMFLOW_API_DEV_ADDR:-127.0.0.1:8787}"
RUST_LOG="${RUST_LOG:-info}"

export DATABASE_URL
export SYMFLOW_API_ADDR
export RUST_LOG

cargo run --bin symflow-api
'''
```

The `hermes-connector` task runs in the background (detached `&`) before `symflow-api`
takes over the foreground. Logs go to `/tmp/hermes-connector.log` for easy inspection
with `tail -f /tmp/hermes-connector.log` in a second terminal.

---

## 7. Source Code

### 7.1 `error.rs` — Unified error type

```rust
// src/error.rs
use axum::{http::StatusCode, response::{IntoResponse, Response}, Json};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("hermes request failed: {0}")]
    HermesRequest(#[from] reqwest::Error),

    #[error("hermes returned HTTP {status}: {body}")]
    HermesHttp { status: u16, body: String },

    #[error("invalid request: {0}")]
    BadRequest(String),

    #[error("internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (code, message) = match &self {
            AppError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::HermesRequest(e) if e.is_timeout() => (
                StatusCode::GATEWAY_TIMEOUT,
                "Hermes request timed out".to_string(),
            ),
            AppError::HermesHttp { status, body } => (
                StatusCode::BAD_GATEWAY,
                format!("Hermes HTTP {status}: {body}"),
            ),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, self.to_string()),
        };

        (code, Json(json!({ "error": message }))).into_response()
    }
}
```

---

### 7.2 `config.rs` — Configuration from environment

```rust
// src/config.rs
use std::time::Duration;

pub struct Config {
    pub hermes_base_url: String,
    /// None means: auto-discover from GET /v1/models at startup.
    pub hermes_model:    Option<String>,
    /// None means: no Authorization header is sent.
    pub hermes_api_key:  Option<String>,
    pub hermes_timeout:  Duration,
    pub port:            u16,
}

impl Config {
    pub fn from_env() -> Self {
        let base_url = std::env::var("HERMES_BASE_URL")
            .expect("HERMES_BASE_URL must be set");

        let hermes_base_url = base_url.trim_end_matches('/').to_string();

        // Explicit model override — optional.
        let hermes_model = std::env::var("HERMES_MODEL").ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());

        // API key — optional.
        let hermes_api_key = std::env::var("HERMES_API_KEY").ok()
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());

        let timeout_secs: u64 = std::env::var("HERMES_TIMEOUT_SECS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(60);

        let port: u16 = std::env::var("CONNECTOR_PORT")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(3100);

        Config {
            hermes_base_url,
            hermes_model,
            hermes_api_key,
            hermes_timeout: Duration::from_secs(timeout_secs),
            port,
        }
    }
}
```

---

### 7.3 `models.rs` — Request / Response types

```rust
// src/models.rs
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ── Inbound from Symflow ──────────────────────────────────────────────────────

/// POST /v1/chat — text or multimodal prompt
#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages:    Vec<ChatMessage>,
    /// Per-request model override. Falls back to HERMES_MODEL env, then auto-discovery.
    pub model:       Option<String>,
    pub max_tokens:  Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role:    String,        // "system" | "user" | "assistant"
    pub content: MessageContent,
}

/// Content can be plain text or an array of typed parts (text + image).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum MessageContent {
    Text(String),
    Parts(Vec<ContentPart>),
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ContentPart {
    Text     { text: String },
    ImageUrl { image_url: ImageUrl },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImageUrl {
    /// "https://..." or "data:image/jpeg;base64,..."
    pub url: String,
}

/// POST /v1/extract — document / image field extraction
#[derive(Debug, Deserialize)]
pub struct ExtractRequest {
    /// Fields to extract, e.g. ["full_name", "dob", "id_number"]
    pub fields:      Vec<String>,
    /// Optional additional instruction for the model
    pub instruction: Option<String>,
    /// Image as a public URL or inline base64
    pub image:       ImageSource,
    pub model:       Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum ImageSource {
    /// Public URL: "https://..."
    Url    { url: String },
    /// Inline: { "base64": "...", "mime_type": "image/jpeg" }
    Base64 { base64: String, mime_type: String },
}

// ── Outbound to Symflow ───────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ChatResponse {
    pub content: String,
    pub model:   String,
    pub usage:   Option<UsageStats>,
}

#[derive(Debug, Serialize)]
pub struct ExtractResponse {
    /// Structured JSON object with the requested keys
    pub fields:      Value,
    /// Raw model output, useful for debugging
    pub raw_content: String,
    pub model:       String,
    pub usage:       Option<UsageStats>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UsageStats {
    pub prompt_tokens:     u32,
    pub completion_tokens: u32,
    pub total_tokens:      u32,
}

// ── OpenAI-compatible payload sent to Hermes ─────────────────────────────────

#[derive(Debug, Serialize)]
pub struct HermesChatRequest<'a> {
    pub model:       &'a str,
    pub messages:    Vec<HermesMessage>,
    pub max_tokens:  u32,
    pub temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,
}

#[derive(Debug, Serialize)]
pub struct HermesMessage {
    pub role:    String,
    /// String for text-only; Array<ContentPart> for multimodal
    pub content: Value,
}

#[derive(Debug, Serialize)]
pub struct ResponseFormat {
    pub r#type: &'static str, // "json_object"
}

#[derive(Debug, Deserialize)]
pub struct HermesChatResponse {
    pub choices: Vec<HermesChoice>,
    pub model:   Option<String>,
    pub usage:   Option<UsageStats>,
}

#[derive(Debug, Deserialize)]
pub struct HermesChoice {
    pub message: HermesChoiceMessage,
}

#[derive(Debug, Deserialize)]
pub struct HermesChoiceMessage {
    pub content: Option<String>,
}

/// Response shape from GET /v1/models (used for auto-discovery)
#[derive(Debug, Deserialize)]
pub struct ModelsResponse {
    pub data: Vec<ModelEntry>,
}

#[derive(Debug, Deserialize)]
pub struct ModelEntry {
    pub id: String,
}
```

---

### 7.4 `hermes_client.rs` — HTTP client

```rust
// src/hermes_client.rs
//
// Wraps all communication with the Hermes VPS.
// Mirrors the pattern from `symflow-core/src/agent/llm.rs` but adds:
//   - multimodal content construction (vision spec)
//   - model auto-discovery when HERMES_MODEL is not set

use crate::{
    config::Config,
    error::AppError,
    models::{
        HermesChatRequest, HermesChatResponse, HermesMessage,
        ModelsResponse, ResponseFormat, UsageStats,
    },
};
use once_cell::sync::OnceCell;
use reqwest::Client;
use serde_json::Value;
use std::sync::Arc;

static HTTP: OnceCell<Client> = OnceCell::new();

pub fn init_http_client(cfg: &Config) {
    HTTP.set(
        Client::builder()
            .timeout(cfg.hermes_timeout)
            .build()
            .expect("failed to build HTTP client"),
    )
    .ok();
}

fn client() -> &'static Client {
    HTTP.get().expect("HTTP client not initialized — call init_http_client first")
}

/// Discover which model Hermes is currently serving.
/// Called once at startup when HERMES_MODEL is not set.
pub async fn discover_model(cfg: &Config) -> Result<String, AppError> {
    let url = format!("{}/models", cfg.hermes_base_url);
    let mut req = client().get(&url);
    if let Some(key) = &cfg.hermes_api_key {
        req = req.bearer_auth(key);
    }

    let resp = req.send().await.map_err(AppError::HermesRequest)?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::HermesHttp { status, body });
    }

    let parsed: ModelsResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("parse /v1/models response: {e}")))?;

    parsed
        .data
        .into_iter()
        .next()
        .map(|m| m.id)
        .ok_or_else(|| AppError::Internal("Hermes /v1/models returned empty list".into()))
}

/// Send a text or multimodal request to Hermes and return (content, model, usage).
///
/// `messages` content can be:
/// - `Value::String("...")` for text-only
/// - `Value::Array([{type:text,...},{type:image_url,...}])` for vision
pub async fn call_hermes(
    cfg: Arc<Config>,
    model: &str,
    messages: Vec<HermesMessage>,
    json_mode: bool,
    max_tokens: u32,
    temperature: f32,
) -> Result<(String, String, Option<UsageStats>), AppError> {
    let url = format!("{}/chat/completions", cfg.hermes_base_url);

    let payload = HermesChatRequest {
        model,
        messages,
        max_tokens,
        temperature,
        response_format: json_mode.then_some(ResponseFormat { r#type: "json_object" }),
    };

    let mut req = client()
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&payload);

    if let Some(key) = &cfg.hermes_api_key {
        req = req.bearer_auth(key);
    }

    let resp = req.send().await.map_err(AppError::HermesRequest)?;

    if !resp.status().is_success() {
        let status = resp.status().as_u16();
        let body = resp.text().await.unwrap_or_default();
        return Err(AppError::HermesHttp { status, body });
    }

    let parsed: HermesChatResponse = resp
        .json()
        .await
        .map_err(|e| AppError::Internal(format!("parse hermes response: {e}")))?;

    let content = parsed
        .choices
        .into_iter()
        .next()
        .and_then(|c| c.message.content)
        .ok_or_else(|| AppError::Internal("no choices in hermes response".into()))?;

    let model_name = parsed.model.unwrap_or_else(|| model.to_string());

    Ok((content, model_name, parsed.usage))
}

/// Build a multimodal `content` value for a VLM message.
///
/// Produces the OpenAI vision spec array:
/// ```json
/// [
///   { "type": "text",      "text": "..." },
///   { "type": "image_url", "image_url": { "url": "..." } }
/// ]
/// ```
pub fn build_vision_content(text: &str, image_url: &str) -> Value {
    serde_json::json!([
        { "type": "text",      "text": text },
        { "type": "image_url", "image_url": { "url": image_url } }
    ])
}

/// Convert a raw base64 string + MIME type into a data URI.
pub fn to_data_uri(base64: &str, mime_type: &str) -> String {
    format!("data:{mime_type};base64,{base64}")
}
```

---

### 7.5 `handlers/chat.rs` — LLM text endpoint

```rust
// src/handlers/chat.rs
use axum::{extract::State, Json};
use serde_json::Value;
use std::sync::Arc;

use crate::{
    config::Config,
    error::AppError,
    hermes_client::call_hermes,
    models::{ChatMessage, ChatRequest, ChatResponse, HermesMessage, MessageContent},
    state::AppState,
};

const DEFAULT_MAX_TOKENS: u32  = 1024;
const DEFAULT_TEMPERATURE: f32 = 0.2;

/// POST /v1/chat
///
/// Accepts messages from Symflow (text or multimodal), forwards to Hermes,
/// and returns { content, model, usage }.
pub async fn chat_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ChatRequest>,
) -> Result<Json<ChatResponse>, AppError> {
    if req.messages.is_empty() {
        return Err(AppError::BadRequest("messages must not be empty".into()));
    }

    // Per-request model override → HERMES_MODEL env → auto-discovered model
    let model = req.model
        .as_deref()
        .filter(|m| !m.is_empty())
        .unwrap_or(&state.resolved_model);

    let hermes_messages = req.messages.iter().map(to_hermes_message).collect();

    let (content, model_name, usage) = call_hermes(
        Arc::clone(&state.cfg),
        model,
        hermes_messages,
        false,
        req.max_tokens.unwrap_or(DEFAULT_MAX_TOKENS),
        req.temperature.unwrap_or(DEFAULT_TEMPERATURE),
    )
    .await?;

    Ok(Json(ChatResponse { content, model: model_name, usage }))
}

fn to_hermes_message(msg: &ChatMessage) -> HermesMessage {
    let content = match &msg.content {
        MessageContent::Text(s) => Value::String(s.clone()),
        MessageContent::Parts(parts) => serde_json::to_value(parts)
            .unwrap_or(Value::String(String::new())),
    };
    HermesMessage { role: msg.role.clone(), content }
}
```

---

### 7.6 `handlers/extract.rs` — VLM document extraction endpoint

```rust
// src/handlers/extract.rs
//
// Key steps:
// 1. Receive image (URL or base64) + list of fields to extract
// 2. Auto-build a system prompt instructing the model to return JSON
// 3. Call Hermes with a multimodal payload (text + image) in json_mode
// 4. Parse and validate the JSON response before returning it to Symflow

use axum::{extract::State, Json};
use serde_json::Value;
use std::sync::Arc;

use crate::{
    error::AppError,
    hermes_client::{build_vision_content, call_hermes, to_data_uri},
    models::{ExtractRequest, ExtractResponse, HermesMessage, ImageSource},
    state::AppState,
};

const EXTRACT_MAX_TOKENS: u32  = 1024;
const EXTRACT_TEMPERATURE: f32 = 0.1; // low temp for stable JSON output

/// POST /v1/extract
///
/// Example payload from Symflow:
/// ```json
/// {
///   "fields": ["full_name", "dob", "id_number", "address"],
///   "instruction": "Vietnamese CCCD card.",
///   "image": { "url": "https://example.com/card.jpg" }
/// }
/// ```
pub async fn extract_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ExtractRequest>,
) -> Result<Json<ExtractResponse>, AppError> {
    if req.fields.is_empty() {
        return Err(AppError::BadRequest("fields must not be empty".into()));
    }

    let image_url = resolve_image_url(&req.image)?;

    // Build system prompt: tell the model exactly which keys to return
    let fields_list = req.fields.join(", ");
    let system_prompt = format!(
        "You are a document extraction assistant. \
         Extract information from the provided image and return ONLY a valid JSON object \
         with these exact keys: {fields_list}. \
         Use null for any field you cannot determine. \
         Do not include explanations or markdown fences — raw JSON only."
    );

    let user_text = req.instruction
        .as_deref()
        .unwrap_or("Extract all requested fields from this document.");

    // OpenAI vision spec: array of typed content parts
    let vision_content = build_vision_content(user_text, &image_url);

    let model = req.model
        .as_deref()
        .filter(|m| !m.is_empty())
        .unwrap_or(&state.resolved_model);

    let messages = vec![
        HermesMessage {
            role:    "system".to_string(),
            content: Value::String(system_prompt),
        },
        HermesMessage {
            role:    "user".to_string(),
            content: vision_content,
        },
    ];

    // json_mode=true: vllm enforces the response is a JSON object
    let (raw_content, model_name, usage) = call_hermes(
        Arc::clone(&state.cfg),
        model,
        messages,
        true,
        EXTRACT_MAX_TOKENS,
        EXTRACT_TEMPERATURE,
    )
    .await?;

    let fields: Value = serde_json::from_str(&raw_content).map_err(|e| {
        AppError::Internal(format!(
            "model did not return valid JSON: {e}. raw={raw_content}"
        ))
    })?;

    if !fields.is_object() {
        return Err(AppError::Internal(format!(
            "model returned non-object JSON: {raw_content}"
        )));
    }

    Ok(Json(ExtractResponse { fields, raw_content, model: model_name, usage }))
}

fn resolve_image_url(source: &ImageSource) -> Result<String, AppError> {
    match source {
        ImageSource::Url { url } => {
            if url.starts_with("http://") || url.starts_with("https://") {
                Ok(url.clone())
            } else {
                Err(AppError::BadRequest(format!("invalid image URL: {url}")))
            }
        }
        ImageSource::Base64 { base64, mime_type } => {
            if !mime_type.starts_with("image/") {
                return Err(AppError::BadRequest(format!(
                    "unsupported mime_type: {mime_type}"
                )));
            }
            Ok(to_data_uri(base64, mime_type))
        }
    }
}
```

---

### 7.7 `state.rs` — Shared application state

```rust
// src/state.rs
//
// Holds config + the resolved model name (set once at startup).
// Handlers borrow it via Arc<AppState> so they never need to call
// the /v1/models discovery endpoint themselves.

use std::sync::Arc;
use crate::config::Config;

pub struct AppState {
    pub cfg:            Arc<Config>,
    /// The model name actually used in Hermes requests.
    /// Resolved at startup: HERMES_MODEL env → GET /v1/models → first entry.
    pub resolved_model: String,
}
```

---

### 7.8 `routes.rs` — Router

```rust
// src/routes.rs
use axum::{routing::post, Router};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::{
    handlers::{chat::chat_handler, extract::extract_handler},
    state::AppState,
};

pub fn build_router(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/chat",    post(chat_handler))
        .route("/v1/extract", post(extract_handler))
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive()) // tighten in production
        .with_state(state)
}
```

---

### 7.9 `main.rs` — Entry point

```rust
// src/main.rs
mod config;
mod error;
mod handlers;
mod hermes_client;
mod models;
mod routes;
mod state;

use std::sync::Arc;
use tracing_subscriber::{fmt, EnvFilter};

use crate::state::AppState;

#[tokio::main]
async fn main() {
    dotenvy::dotenv().ok();

    fmt()
        .with_env_filter(
            EnvFilter::from_default_env()
                .add_directive("hermes_connector=info".parse().unwrap()),
        )
        .init();

    let cfg = Arc::new(config::Config::from_env());
    hermes_client::init_http_client(&cfg);

    // Resolve which model to use:
    //   1. Explicit HERMES_MODEL env var
    //   2. Auto-discover from GET /v1/models
    let resolved_model = match &cfg.hermes_model {
        Some(m) => {
            tracing::info!("using configured model: {m}");
            m.clone()
        }
        None => {
            tracing::info!("HERMES_MODEL not set — discovering from {}/models", cfg.hermes_base_url);
            match hermes_client::discover_model(&cfg).await {
                Ok(m) => {
                    tracing::info!("auto-discovered model: {m}");
                    m
                }
                Err(e) => {
                    // Non-fatal at startup: connector still boots, but extraction
                    // calls will fail until Hermes is reachable. Log a clear warning.
                    tracing::warn!("could not discover model from Hermes: {e}");
                    tracing::warn!("set HERMES_MODEL to silence this warning");
                    String::new()
                }
            }
        }
    };

    let state = Arc::new(AppState {
        cfg: Arc::clone(&cfg),
        resolved_model,
    });

    let addr = format!("0.0.0.0:{}", cfg.port);
    let router = routes::build_router(state);

    tracing::info!("hermes-connector listening on {addr}");
    tracing::info!("Hermes endpoint: {}", cfg.hermes_base_url);

    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind port");

    axum::serve(listener, router)
        .await
        .expect("server error");
}
```

---

### 7.10 `handlers/mod.rs`

```rust
// src/handlers/mod.rs
pub mod chat;
pub mod extract;
```

---

## 8. cURL Examples

### 8.1 Text chat

```bash
curl -X POST http://localhost:3100/v1/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      { "role": "system", "content": "You are a concise summarizer." },
      { "role": "user",   "content": "Summarize the Symflow architecture in two sentences." }
    ]
  }'
```

```json
{
  "content": "Symflow is a workflow orchestrator with three layers: symflow-core (domain logic + DAG executor), symflow-store (PostgreSQL persistence), and symflow-api (HTTP + WebSocket). Flows are defined in YAML/JSON DSL; steps run in topological order and emit real-time events.",
  "model": "Qwen2.5-VL-3B-Instruct",
  "usage": { "prompt_tokens": 38, "completion_tokens": 52, "total_tokens": 90 }
}
```

### 8.2 VLM extraction — public URL

```bash
curl -X POST http://localhost:3100/v1/extract \
  -H "Content-Type: application/json" \
  -d '{
    "fields": ["full_name", "dob", "id_number", "address", "expiry_date"],
    "instruction": "Vietnamese CCCD card. Extract all fields.",
    "image": { "url": "https://example.com/cccd.jpg" }
  }'
```

```json
{
  "fields": {
    "full_name":   "NGUYEN VAN AN",
    "dob":         "1990-01-01",
    "id_number":   "012345678901",
    "address":     "123 ABC Street, District 1, HCMC",
    "expiry_date": "2031-01-01"
  },
  "raw_content": "{...}",
  "model": "Qwen2.5-VL-3B-Instruct",
  "usage": { "prompt_tokens": 120, "completion_tokens": 64, "total_tokens": 184 }
}
```

### 8.3 VLM extraction — base64

```bash
BASE64=$(base64 -w0 /path/to/card.jpg)

curl -X POST http://localhost:3100/v1/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"fields\": [\"full_name\", \"id_number\"],
    \"image\": { \"base64\": \"$BASE64\", \"mime_type\": \"image/jpeg\" }
  }"
```

---

## 9. Symflow Integration

### 9.1 OCR pipeline — Layer 3B server fallback

Add `providers/hermes.ts` to `packages/symflow-runtime/src/ocr/providers/`:

```typescript
// providers/hermes.ts
import type { OcrProvider, OcrResult } from '../types';

export class HermesVlmProvider implements OcrProvider {
  readonly engineName = 'hermes-vlm' as const;
  private endpoint: string;

  constructor(endpoint = 'http://localhost:3100') {
    this.endpoint = endpoint;
  }

  async recognize(image: Blob): Promise<OcrResult> {
    const base64   = await blobToBase64(image);
    const mimeType = image.type || 'image/jpeg';

    const resp = await fetch(`${this.endpoint}/v1/extract`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields:      ['full_name', 'dob', 'id_number', 'address', 'expiry_date', 'gender'],
        instruction: 'Vietnamese ID card. Extract all fields.',
        image:       { base64, mime_type: mimeType },
      }),
    });

    if (!resp.ok) throw new Error(`hermes-connector ${resp.status}: ${await resp.text()}`);

    const data = await resp.json();
    return {
      rawText:           JSON.stringify(data.fields),
      words:             [],
      averageConfidence: 0.95, // server-side VLM is more reliable than local Tesseract
      engine:            'hermes-vlm' as const,
    };
  }
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader     = new FileReader();
    reader.onload    = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror   = reject;
    reader.readAsDataURL(blob);
  });
}
```

Wire it into `pipeline.ts` as the `serverFallbackProvider`:

```typescript
import { HermesVlmProvider } from './providers/hermes';

const serverFallback = new HermesVlmProvider(
  import.meta.env.VITE_HERMES_CONNECTOR_URL ?? 'http://localhost:3100'
);

// Pass to runIdCardOcrPipeline({ ..., serverFallbackProvider: serverFallback })
```

### 9.2 Direct use in a Symflow DSL flow

When Symflow adds an `http_request` node type (P3 roadmap):

```yaml
id: cccd_extraction_flow
name: CCCD Extraction

steps:
  - id: upload_trigger
    type: manual_trigger

  - id: extract_fields
    needs: [upload_trigger]
    type: http_request
    with:
      url: http://hermes-connector:3100/v1/extract
      method: POST
      body:
        fields: ["full_name", "dob", "id_number", "address"]
        image:
          url: "{{steps.upload_trigger.output.image_url}}"

  - id: validate_result
    needs: [extract_fields]
    type: ai_agent
    with:
      model: "{{env.LLM_MODEL}}"
      system: "Validate the extracted fields and flag any anomalies."
      input:  "{{steps.extract_fields.output.fields}}"
```

---

## 10. Implementation Checklist

### Phase 1 — Scaffold
- [ ] Create `services/hermes-connector/` with `Cargo.toml`
- [ ] Write `error.rs`, `config.rs`, `models.rs`, `state.rs`
- [ ] Write `hermes_client.rs` — `init_http_client`, `discover_model`, `call_hermes`, `build_vision_content`
- [ ] Write `handlers/chat.rs` and `handlers/extract.rs`
- [ ] Write `routes.rs` and `main.rs`
- [ ] Create standalone `Makefile`
- [ ] Create `.env.example`

### Phase 2 — Manual testing
- [ ] `make run` pointing at a real Hermes VPS
- [ ] Test `/v1/chat` via cURL
- [ ] Test `/v1/extract` with a synthetic ID card image
- [ ] Verify error handling: Hermes timeout, Hermes down, model not found

### Phase 3 — `api-dev` integration
- [ ] Add `[tasks.hermes-connector]` and update `[tasks.api-dev]` in `services/symflow-api/Makefile.toml`
- [ ] Add `VITE_HERMES_CONNECTOR_URL` to `services/symflow-web/.env`
- [ ] Add `HermesVlmProvider` to `packages/symflow-runtime/src/ocr/providers/`
- [ ] Update `pipeline.ts` to use Hermes as Layer 3B fallback

### Phase 4 — Production hardening
- [ ] Add auth middleware (Bearer token) to protect the connector itself
- [ ] Tighten CORS to Symflow's domain only
- [ ] Add `GET /health` endpoint
- [ ] Write `Dockerfile` for hermes-connector
- [ ] Add to `docker-compose.yml` alongside `symflow-api`

---

## 11. Future Extensions

| Feature | Description |
|---|---|
| Streaming | Forward `text/event-stream` from Hermes to Symflow for long-form generation |
| Receipt parsing | Dedicated `/v1/extract/receipt` endpoint with a receipt-specific field schema |
| Batch extraction | Accept an array of images, process in parallel with `tokio::JoinSet` |
| Retry with backoff | Exponential backoff when Hermes returns 503 (model still loading) |
| Prometheus metrics | `/metrics` endpoint — request latency, token counts, error rates |
| Response caching | Cache extraction results by image hash to save inference cost |
