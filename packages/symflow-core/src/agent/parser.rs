use crate::error::AgentError;
use serde_json::Value;

pub enum ReAct {
    Action { tool: String, arguments: Value },
    Final(String),
}

pub fn parse_react(raw: &str) -> Result<ReAct, AgentError> {
    let lower = raw.to_lowercase();

    if let Some(pos) = lower.find("final answer:") {
        let answer = raw[pos + "final answer:".len()..].trim().to_string();
        return Ok(ReAct::Final(answer));
    }
    if let Some(action_pos) = lower.find("action:") {
        let after = &raw[action_pos + "action:".len()..];
        let tool = after.lines().next().unwrap_or("").trim().to_string();
        let arguments = lower
            .find("arguments:")
            .map(|p| {
                let args_text = raw[p + "arguments:".len()..].trim();
                serde_json::from_str(extract_json(args_text))
                    .unwrap_or(Value::Object(serde_json::Map::new()))
            })
            .unwrap_or(Value::Object(serde_json::Map::new()));

        if !tool.is_empty() {
            return Ok(ReAct::Action { tool, arguments });
        }
    }
    Ok(ReAct::Final(raw.trim().to_string()))
}

fn extract_json(text: &str) -> &str {
    if let Some(start) = text.find('{') {
        let mut depth = 0usize;
        for (i, c) in text[start..].char_indices() {
            match c {
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        return &text[start..start + i + 1];
                    }
                }
                _ => {}
            }
        }
    }
    text
}
