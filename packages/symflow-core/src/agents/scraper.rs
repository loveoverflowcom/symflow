//! Scraper Agent: scrape_text, scrape_links, scrape_metadata.

use crate::error::ToolError;
use crate::protocol::{Agent, Tool, ToolContext, ToolOutput};
use async_trait::async_trait;
use scraper::{Html, Selector};
use serde_json::{json, Value};

pub struct ScraperAgent;
impl Agent for ScraperAgent {
    fn id(&self) -> &str {
        "scraper"
    }
    fn name(&self) -> &str {
        "Scraper Agent"
    }
    fn description(&self) -> &str {
        "Thu thập nội dung web: text, links, metadata."
    }
    fn tools(&self) -> Vec<Box<dyn Tool>> {
        vec![
            Box::new(ScrapeText),
            Box::new(ScrapeLinks),
            Box::new(ScrapeMetadata),
        ]
    }
}

async fn fetch_html(url: &str) -> Result<String, ToolError> {
    reqwest::get(url)
        .await
        .map_err(|e| ToolError::Io(e.to_string()))?
        .text()
        .await
        .map_err(|e| ToolError::Io(e.to_string()))
}

pub struct ScrapeText;
#[async_trait]
impl Tool for ScrapeText {
    fn name(&self) -> &str {
        "scrape_text"
    }
    fn description(&self) -> &str {
        "Trích xuất text thô từ trang web."
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] })
    }
    async fn call(&self, args: Value, _ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let url = args["url"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'url'".into()))?;
        let html = fetch_html(url).await?;
        let doc = Html::parse_document(&html);
        let text = doc
            .select(&Selector::parse("body").unwrap())
            .next()
            .map(|b| b.text().collect::<Vec<_>>().join(" "))
            .unwrap_or_default();
        Ok(ToolOutput::text(
            text.split_whitespace().collect::<Vec<_>>().join(" "),
        ))
    }
}

pub struct ScrapeLinks;
#[async_trait]
impl Tool for ScrapeLinks {
    fn name(&self) -> &str {
        "scrape_links"
    }
    fn description(&self) -> &str {
        "Lấy danh sách link từ trang web."
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] })
    }
    async fn call(&self, args: Value, _ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let url = args["url"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'url'".into()))?;
        let html = fetch_html(url).await?;
        let doc = Html::parse_document(&html);
        let links: Vec<String> = doc
            .select(&Selector::parse("a[href]").unwrap())
            .filter_map(|el| el.value().attr("href"))
            .take(50)
            .map(|s| s.to_string())
            .collect();
        Ok(ToolOutput::text(links.join("\n")))
    }
}

pub struct ScrapeMetadata;
#[async_trait]
impl Tool for ScrapeMetadata {
    fn name(&self) -> &str {
        "scrape_metadata"
    }
    fn description(&self) -> &str {
        "Lấy title, description từ trang web."
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": { "url": { "type": "string" } }, "required": ["url"] })
    }
    async fn call(&self, args: Value, _ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
        let url = args["url"]
            .as_str()
            .ok_or_else(|| ToolError::InvalidArgs("thiếu 'url'".into()))?;
        let html = fetch_html(url).await?;
        let doc = Html::parse_document(&html);
        let title = doc
            .select(&Selector::parse("title").unwrap())
            .next()
            .map(|el| el.text().collect::<String>())
            .unwrap_or_default();
        let desc = doc
            .select(&Selector::parse("meta[name='description']").unwrap())
            .next()
            .and_then(|el| el.value().attr("content"))
            .unwrap_or("")
            .to_string();
        Ok(ToolOutput::text(format!(
            "title={title}\ndescription={desc}"
        )))
    }
}
