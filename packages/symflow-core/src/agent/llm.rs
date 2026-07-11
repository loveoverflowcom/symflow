//! Client gọi LLM API (OpenAI-compatible).

use crate::error::AgentError;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MAX_TOKENS: u32 = 512;
const DEFAULT_TEMPERATURE: f32 = 0.2;

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()
        .expect("HTTP client")
});

#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: &'a [Message],
    max_tokens: u32,
    temperature: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    response_format: Option<ResponseFormat>,
    #[serde(skip_serializing_if = "Option::is_none")]
    chat_template_kwargs: Option<ChatTemplateKwargs>,
}

#[derive(Debug, Serialize)]
struct ResponseFormat {
    r#type: &'static str,
}

#[derive(Debug, Serialize)]
struct ChatTemplateKwargs {
    enable_thinking: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<Choice>,
}
#[derive(Debug, Deserialize)]
struct Choice {
    message: Message,
}

pub async fn chat(model: &str, messages: &[Message]) -> Result<String, AgentError> {
    chat_with_options(model, messages, false).await
}

/// Request a JSON object from an OpenAI-compatible chat endpoint.
///
/// Qwen3 models enable thinking by default. With a small completion budget that
/// can consume every token before the model emits its answer, so JSON requests
/// explicitly disable thinking.
pub async fn chat_json(model: &str, messages: &[Message]) -> Result<String, AgentError> {
    chat_with_options(model, messages, true).await
}

async fn chat_with_options(
    model: &str,
    messages: &[Message],
    json_mode: bool,
) -> Result<String, AgentError> {
    let api_key = required_env("LLM_API_KEY")?;
    let model = selected_model(model)?;
    let base_url = env_or_default("LLM_BASE_URL", DEFAULT_BASE_URL);
    let max_tokens = env_u32_or_default("LLM_MAX_TOKENS", DEFAULT_MAX_TOKENS)?;
    let temperature = env_f32_or_default("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)?;
    let disable_qwen_thinking = json_mode && model.starts_with("Qwen/");

    let resp = HTTP
        .post(format!("{base_url}/chat/completions"))
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&ChatRequest {
            model: &model,
            messages,
            max_tokens,
            temperature,
            response_format: json_mode.then_some(ResponseFormat {
                r#type: "json_object",
            }),
            chat_template_kwargs: disable_qwen_thinking.then_some(ChatTemplateKwargs {
                enable_thinking: false,
            }),
        })
        .send()
        .await
        .map_err(|e| AgentError::Llm(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AgentError::Llm(format!(
            "HTTP {status}: {}",
            summarize_error_body(&text)
        )));
    }

    let parsed: ChatResponse = resp
        .json()
        .await
        .map_err(|e| AgentError::Llm(format!("parse response: {e}")))?;

    parsed
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or_else(|| AgentError::Llm("no choices in response".into()))
}

pub fn msg(role: impl Into<String>, content: impl Into<String>) -> Message {
    Message {
        role: role.into(),
        content: content.into(),
    }
}

fn selected_model(step_model: &str) -> Result<String, AgentError> {
    if let Some(model) = env_nonempty("LLM_MODEL") {
        return Ok(model);
    }

    let step_model = step_model.trim();
    if !step_model.is_empty() {
        return Ok(step_model.to_string());
    }

    Err(AgentError::Llm(
        "missing LLM_MODEL or ai_agent.with.model".into(),
    ))
}

fn required_env(name: &str) -> Result<String, AgentError> {
    env_nonempty(name).ok_or_else(|| AgentError::Llm(format!("missing {name}")))
}

fn env_or_default(name: &str, default: &str) -> String {
    env_nonempty(name)
        .unwrap_or_else(|| default.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn env_nonempty(name: &str) -> Option<String> {
    std::env::var(name)
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

fn env_u32_or_default(name: &str, default: u32) -> Result<u32, AgentError> {
    match env_nonempty(name) {
        Some(value) => value
            .parse::<u32>()
            .map_err(|e| AgentError::Llm(format!("{name} must be an unsigned integer: {e}"))),
        None => Ok(default),
    }
}

fn env_f32_or_default(name: &str, default: f32) -> Result<f32, AgentError> {
    match env_nonempty(name) {
        Some(value) => value
            .parse::<f32>()
            .map_err(|e| AgentError::Llm(format!("{name} must be a number: {e}"))),
        None => Ok(default),
    }
}

fn summarize_error_body(body: &str) -> String {
    let trimmed = body.trim();
    if trimmed.is_empty() {
        return "empty response body".to_string();
    }

    if let Ok(json) = serde_json::from_str::<Value>(trimmed) {
        if let Some(summary) = summarize_json_error(&json) {
            return summary;
        }
        return preview_text(trimmed, 600);
    }

    preview_text(trimmed, 600)
}

fn summarize_json_error(value: &Value) -> Option<String> {
    if let Some(error) = value.get("error") {
        if let Some(summary) = summarize_json_error_entry(error) {
            return Some(summary);
        }
    }

    summarize_json_error_entry(value)
}

fn summarize_json_error_entry(value: &Value) -> Option<String> {
    match value {
        Value::String(text) => Some(text.clone()),
        Value::Object(map) => {
            let mut parts = Vec::new();

            if let Some(message) = map.get("message").and_then(json_text) {
                parts.push(message);
            } else if let Some(message) = map.get("error").and_then(json_text) {
                parts.push(message);
            }

            if let Some(kind) = map.get("type").and_then(json_text) {
                parts.push(format!("type={kind}"));
            }
            if let Some(code) = map.get("code").and_then(json_text) {
                parts.push(format!("code={code}"));
            }
            if let Some(param) = map.get("param").and_then(json_text) {
                parts.push(format!("param={param}"));
            }

            if parts.is_empty() {
                Some(value.to_string())
            } else {
                Some(parts.join(", "))
            }
        }
        _ => json_text(value),
    }
}

fn json_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => Some("null".to_string()),
        Value::Bool(value) => Some(value.to_string()),
        Value::Number(value) => Some(value.to_string()),
        Value::String(value) => Some(value.clone()),
        _ => Some(value.to_string()),
    }
}

fn preview_text(text: &str, limit: usize) -> String {
    let compact = text.split_whitespace().collect::<Vec<_>>().join(" ");
    let total = compact.chars().count();
    let mut preview = String::new();
    for ch in compact.chars().take(limit) {
        preview.push(ch);
    }
    if total > limit {
        preview.push_str("...");
    }
    preview
}
