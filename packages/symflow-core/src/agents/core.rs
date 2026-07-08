//! Core Agent: local_file_writer, string_analyzer.

use crate::error::ToolError;
use crate::protocol::{Agent, Tool, ToolContext, ToolOutput};
use async_trait::async_trait;
use serde_json::{json, Value};

pub struct CoreAgent;
impl Agent for CoreAgent {
    fn id(&self) -> &str { "core" }
    fn name(&self) -> &str { "Core Agent" }
    fn description(&self) -> &str { "Công cụ nền tảng: ghi file và phân tích chuỗi." }
    fn tools(&self) -> Vec<Box<dyn Tool>> {
        vec![Box::new(LocalFileWriter), Box::new(StringAnalyzer)]
    }
}

pub struct LocalFileWriter;
#[async_trait]
impl Tool for LocalFileWriter {
    fn name(&self) -> &str { "local_file_writer" }
    fn description(&self) -> &str { "Ghi nội dung văn bản vào file trong sandbox." }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "filename": { "type": "string" },
                "content":  { "type": "string" }
            },
            "required": ["filename", "content"]
        })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?;
        let content = args["content"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'content'".into()))?;
        let path = crate::sandbox::safe_path(&ctx.sandbox_dir, filename)?;
        tokio::fs::write(&path, content).await
            .map_err(|e| ToolError::Io(e.to_string()))?;
        Ok(ToolOutput::text(format!("Đã ghi file '{filename}' ({} bytes).", content.len())))
    }
}

pub struct StringAnalyzer;
#[async_trait]
impl Tool for StringAnalyzer {
    fn name(&self) -> &str { "string_analyzer" }
    fn description(&self) -> &str { "Đếm từ và tìm từ khoá trong chuỗi." }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "text":    { "type": "string" },
                "keyword": { "type": "string" }
            },
            "required": ["text"]
        })
    }
    async fn call(&self, args: Value, _ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let text = args["text"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'text'".into()))?;
        let word_count = text.split_whitespace().count();
        let char_count = text.chars().count();
        let mut result = format!("word_count={word_count}, char_count={char_count}");
        if let Some(kw) = args["keyword"].as_str() {
            let occ = text.to_lowercase().matches(&kw.to_lowercase()).count();
            result.push_str(&format!(", keyword_'{kw}'_count={occ}"));
        }
        Ok(ToolOutput::text(result))
    }
}
