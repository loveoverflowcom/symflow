//! Client gọi LLM API (OpenAI-compatible).

use crate::error::AgentError;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;

static HTTP: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build().expect("HTTP client")
});

#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: &'a [Message],
    temperature: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Message {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse { choices: Vec<Choice> }
#[derive(Debug, Deserialize)]
struct Choice { message: Message }

pub async fn chat(model: &str, messages: &[Message]) -> Result<String, AgentError> {
    let api_key  = std::env::var("LLM_API_KEY").unwrap_or_default();
    let base_url = std::env::var("LLM_BASE_URL")
        .unwrap_or_else(|_| "https://api.openai.com/v1".into());

    let resp = HTTP.post(format!("{base_url}/chat/completions"))
        .bearer_auth(&api_key)
        .json(&ChatRequest { model, messages, temperature: 0.2 })
        .send().await
        .map_err(|e| AgentError::Llm(e.to_string()))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(AgentError::Llm(format!("HTTP {status}: {text}")));
    }

    let parsed: ChatResponse = resp.json().await
        .map_err(|e| AgentError::Llm(format!("parse response: {e}")))?;

    parsed.choices.into_iter().next()
        .map(|c| c.message.content)
        .ok_or_else(|| AgentError::Llm("no choices in response".into()))
}

pub fn msg(role: impl Into<String>, content: impl Into<String>) -> Message {
    Message { role: role.into(), content: content.into() }
}
