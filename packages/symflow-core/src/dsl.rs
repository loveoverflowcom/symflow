//! DSL: `Flow` + `Step` + typed args cho từng loại nút.

use crate::error::CompileError;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const DEFAULT_MAX_ITERATIONS: u32 = 10;
fn default_max_iterations() -> u32 { DEFAULT_MAX_ITERATIONS }
fn empty_object() -> Value { Value::Object(serde_json::Map::new()) }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Flow {
    pub flow_id: String,
    #[serde(default)]
    pub name: String,
    pub steps: Vec<Step>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Step {
    pub id: String,
    #[serde(default)]
    pub needs: Vec<String>,
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default = "empty_object")]
    pub with: Value,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StepType {
    ManualTrigger,
    WebScraper,
    LocalFileReader,
    AiAgent,
}

impl StepType {
    pub fn parse(kind: &str) -> Option<Self> {
        match kind {
            "manual_trigger"   => Some(StepType::ManualTrigger),
            "web_scraper"      => Some(StepType::WebScraper),
            "local_file_reader"=> Some(StepType::LocalFileReader),
            "ai_agent"         => Some(StepType::AiAgent),
            _ => None,
        }
    }
}

impl Step {
    pub fn step_type(&self) -> Option<StepType> { StepType::parse(&self.kind) }
}

// ---- typed args --------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct WebScraperArgs { pub url: String }

#[derive(Debug, Clone, Deserialize)]
pub struct FileReaderArgs {
    #[serde(alias = "filename")]
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiAgentArgs {
    pub model: String,
    pub goal: String,
    #[serde(default)]
    pub context: String,
    #[serde(default = "default_max_iterations")]
    pub max_iterations: u32,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
}

// ---- parse & validate -------------------------------------------------------

pub fn parse_yaml(src: &str) -> Result<Flow, CompileError> {
    serde_yaml::from_str(src).map_err(|e| CompileError::Parse(e.to_string()))
}
pub fn parse_json(src: &str) -> Result<Flow, CompileError> {
    serde_json::from_str(src).map_err(|e| CompileError::Parse(e.to_string()))
}
pub fn parse(src: &str) -> Result<Flow, CompileError> {
    if src.trim_start().starts_with('{') { parse_json(src) } else { parse_yaml(src) }
}

impl Flow {
    pub fn display_name(&self) -> &str {
        if self.name.is_empty() { &self.flow_id } else { &self.name }
    }

    pub fn validate(&self) -> Result<(), CompileError> {
        for step in &self.steps {
            let st = step.step_type().ok_or_else(|| CompileError::UnknownStepType {
                step: step.id.clone(), kind: step.kind.clone(),
            })?;
            match st {
                StepType::ManualTrigger => {
                    if !step.with.is_object() && !step.with.is_null() {
                        return Err(CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: "`with` của manual_trigger phải là object".into(),
                        });
                    }
                }
                StepType::WebScraper => {
                    serde_json::from_value::<WebScraperArgs>(step.with.clone())
                        .map_err(|e| CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: format!("web_scraper cần `url` (string): {e}"),
                        })?;
                }
                StepType::LocalFileReader => {
                    serde_json::from_value::<FileReaderArgs>(step.with.clone())
                        .map_err(|e| CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: format!("local_file_reader cần `path` (string): {e}"),
                        })?;
                }
                StepType::AiAgent => {
                    let args = serde_json::from_value::<AiAgentArgs>(step.with.clone())
                        .map_err(|e| CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: format!("ai_agent cần `model` và `goal`: {e}"),
                        })?;
                    for tool in &args.allowed_tools {
                        if !crate::tools::is_known_capability(tool) {
                            return Err(CompileError::InvalidStep {
                                step: step.id.clone(),
                                msg: format!("allowed_tools: tool/agent không tồn tại '{tool}'"),
                            });
                        }
                    }
                }
            }
        }
        Ok(())
    }
}
