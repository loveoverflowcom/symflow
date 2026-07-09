use super::{NodeExec, StepCtx};
use crate::dsl::WebScraperArgs;
use crate::error::NodeError;
use async_trait::async_trait;
use scraper::{Html, Selector};
use serde_json::{json, Value};

pub struct WebScraperNode;

#[async_trait]
impl NodeExec for WebScraperNode {
    async fn run(&self, ctx: &StepCtx) -> Result<Value, NodeError> {
        let args: WebScraperArgs = serde_json::from_value(ctx.resolved_with.clone())
            .map_err(|e| NodeError::Scraper(format!("tham số không hợp lệ: {e}")))?;

        let html = reqwest::get(&args.url)
            .await
            .map_err(|e| NodeError::Scraper(format!("HTTP lỗi: {e}")))?
            .text()
            .await
            .map_err(|e| NodeError::Scraper(format!("đọc body lỗi: {e}")))?;

        let raw_text = extract_text(&html);
        Ok(json!({ "raw_text": raw_text, "url": args.url, "char_count": raw_text.len() }))
    }
}

fn extract_text(html: &str) -> String {
    let doc = Html::parse_document(html);
    let sel_body = Selector::parse("body").unwrap();
    let iter = doc
        .select(&sel_body)
        .next()
        .map(|b| b.text().collect::<Vec<_>>().join(" "))
        .unwrap_or_else(|| doc.root_element().text().collect::<Vec<_>>().join(" "));
    iter.split_whitespace().collect::<Vec<_>>().join(" ")
}
