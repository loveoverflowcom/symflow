use super::llm::{msg, Message};
use serde_json::Value;

pub fn init_history(goal: &str, context: &str, tool_schemas: &[Value]) -> Vec<Message> {
    let tools_text = if tool_schemas.is_empty() {
        String::new()
    } else {
        let schemas: Vec<String> = tool_schemas
            .iter()
            .map(|t| serde_json::to_string_pretty(t).unwrap_or_default())
            .collect();
        format!("\n\nCác tool bạn có thể gọi:\n{}", schemas.join("\n\n"))
    };

    let system = format!(
        "Bạn là AI Agent thực hiện công việc theo vòng lặp Thought → Action → Observation.\n\n\
         Định dạng phản hồi:\n\
         - Suy nghĩ: `Thought: <suy nghĩ>`\n\
         - Gọi tool: `Action: <tên_tool>\\nArguments: <JSON>`\n\
         - Kết thúc: `Final Answer: <câu trả lời>`{tools_text}"
    );
    let user = format!("Mục tiêu: {goal}\n\nNgữ cảnh:\n{context}");
    vec![msg("system", system), msg("user", user)]
}

pub fn push_observation(history: &mut Vec<Message>, assistant_reply: &str, observation: &str) {
    history.push(msg("assistant", assistant_reply));
    history.push(msg(
        "user",
        format!("Observation: {observation}\n\nTiếp tục."),
    ));
}
