//! Client gọi LLM API (OpenAI-compatible).

use crate::error::AgentError;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MAX_TOKENS: u32 = 100;
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
    let api_key = required_env("LLM_API_KEY")?;
    let model = selected_model(model)?;
    let base_url = env_or_default("LLM_BASE_URL", DEFAULT_BASE_URL);
    let max_tokens = env_u32_or_default("LLM_MAX_TOKENS", DEFAULT_MAX_TOKENS)?;
    let temperature = env_f32_or_default("LLM_TEMPERATURE", DEFAULT_TEMPERATURE)?;

    let resp = HTTP
        .post(format!("{base_url}/chat/completions"))
        .bearer_auth(api_key)
        .header(reqwest::header::CONTENT_TYPE, "application/json")
        .json(&ChatRequest {
            model: &model,
            messages,
            max_tokens,
            temperature,
        })
        .send()
        .await
        .map_err(|e| AgentError::Llm(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AgentError::Llm(format!("HTTP {status}: {text}")));
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
