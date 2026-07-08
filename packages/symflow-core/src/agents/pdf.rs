//! PDF Agent: pdf_extract_text, pdf_metadata, pdf_search.

use crate::error::ToolError;
use crate::protocol::{Agent, Tool, ToolContext, ToolOutput};
use async_trait::async_trait;
use lopdf::Document;
use serde_json::{json, Value};

pub struct PdfAgent;
impl Agent for PdfAgent {
    fn id(&self) -> &str { "pdf" }
    fn name(&self) -> &str { "PDF Agent" }
    fn description(&self) -> &str { "Trích xuất và tìm kiếm nội dung trong file PDF." }
    fn tools(&self) -> Vec<Box<dyn Tool>> {
        vec![Box::new(PdfExtractText), Box::new(PdfMetadata), Box::new(PdfSearch)]
    }
}

fn load_pdf(ctx: &ToolContext, filename: &str) -> Result<Document, ToolError> {
    let path = crate::sandbox::safe_path(&ctx.sandbox_dir, filename)?;
    Document::load(&path).map_err(|e| ToolError::Io(e.to_string()))
}

fn all_text(doc: &Document) -> String {
    doc.page_iter()
        .filter_map(|pid| doc.extract_text(&[pid.0]).ok())
        .collect::<Vec<_>>().join("\n")
}

pub struct PdfExtractText;
#[async_trait]
impl Tool for PdfExtractText {
    fn name(&self) -> &str { "pdf_extract_text" }
    fn description(&self) -> &str { "Trích xuất toàn bộ text từ file PDF trong sandbox." }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "filename": { "type": "string" } }, "required": ["filename"] })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?
            .to_string();
        let ctx2 = ctx.clone();
        let doc = tokio::task::spawn_blocking(move || load_pdf(&ctx2, &filename))
            .await.map_err(|e| ToolError::Io(e.to_string()))??;
        Ok(ToolOutput::text(all_text(&doc)))
    }
}

pub struct PdfMetadata;
#[async_trait]
impl Tool for PdfMetadata {
    fn name(&self) -> &str { "pdf_metadata" }
    fn description(&self) -> &str { "Lấy metadata (số trang) từ PDF." }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "filename": { "type": "string" } }, "required": ["filename"] })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?
            .to_string();
        let ctx2 = ctx.clone();
        let doc = tokio::task::spawn_blocking(move || load_pdf(&ctx2, &filename))
            .await.map_err(|e| ToolError::Io(e.to_string()))??;
        Ok(ToolOutput::text(format!("pages={}", doc.get_pages().len())))
    }
}

pub struct PdfSearch;
#[async_trait]
impl Tool for PdfSearch {
    fn name(&self) -> &str { "pdf_search" }
    fn description(&self) -> &str { "Tìm kiếm từ khoá trong PDF." }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "filename": { "type": "string" }, "keyword": { "type": "string" } }, "required": ["filename","keyword"] })
    }
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let filename = args["filename"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'filename'".into()))?.to_string();
        let keyword = args["keyword"].as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'keyword'".into()))?.to_lowercase();
        let ctx2 = ctx.clone();
        let doc = tokio::task::spawn_blocking(move || load_pdf(&ctx2, &filename))
            .await.map_err(|e| ToolError::Io(e.to_string()))??;
        let text = all_text(&doc);
        let matches: Vec<&str> = text.lines()
            .filter(|l| l.to_lowercase().contains(&keyword)).take(20).collect();
        if matches.is_empty() {
            Ok(ToolOutput::text(format!("Không tìm thấy '{keyword}' trong PDF.")))
        } else {
            Ok(ToolOutput::text(matches.join("\n")))
        }
    }
}
