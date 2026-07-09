pub mod local_file_reader;
pub mod manual_trigger;
pub mod web_scraper;

use crate::dsl::StepType;
use crate::error::NodeError;
use async_trait::async_trait;
use serde_json::Value;
use std::path::PathBuf;
use uuid::Uuid;

pub struct StepCtx {
    pub run_id: Uuid,
    pub step_id: String,
    pub resolved_with: Value,
    pub initial_inputs: Value,
    pub sandbox_dir: PathBuf,
}

#[async_trait]
pub trait NodeExec: Send + Sync {
    async fn run(&self, ctx: &StepCtx) -> Result<Value, NodeError>;
}

pub fn build_node(step_type: StepType) -> Option<Box<dyn NodeExec>> {
    match step_type {
        StepType::ManualTrigger => Some(Box::new(manual_trigger::ManualTriggerNode)),
        StepType::WebScraper => Some(Box::new(web_scraper::WebScraperNode)),
        StepType::LocalFileReader => Some(Box::new(local_file_reader::LocalFileReaderNode)),
        StepType::AiAgent => None,
    }
}
