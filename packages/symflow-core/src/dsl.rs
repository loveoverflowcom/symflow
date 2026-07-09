//! DSL: `Flow` + `Step` + typed args cho từng loại nút.

use crate::error::CompileError;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub const DEFAULT_MAX_ITERATIONS: u32 = 10;
fn default_max_iterations() -> u32 {
    DEFAULT_MAX_ITERATIONS
}
fn empty_object() -> Value {
    Value::Object(serde_json::Map::new())
}

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
            "manual_trigger" => Some(StepType::ManualTrigger),
            "web_scraper" => Some(StepType::WebScraper),
            "local_file_reader" => Some(StepType::LocalFileReader),
            "ai_agent" => Some(StepType::AiAgent),
            _ => None,
        }
    }
}

impl Step {
    pub fn step_type(&self) -> Option<StepType> {
        StepType::parse(&self.kind)
    }
}

// ---- typed args --------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct WebScraperArgs {
    pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct FileReaderArgs {
    #[serde(alias = "filename")]
    pub path: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AiAgentArgs {
    #[serde(default)]
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
/// Transitional helper for callers migrating legacy YAML documents to JSON.
///
/// New flow authoring should use [`parse_json`] or [`parse`].
pub fn parse_yaml_value(src: &str) -> Result<Value, CompileError> {
    serde_yaml::from_str(src).map_err(|e| CompileError::Parse(e.to_string()))
}
pub fn parse_json(src: &str) -> Result<Flow, CompileError> {
    serde_json::from_str(src).map_err(|e| CompileError::Parse(e.to_string()))
}
pub fn parse(src: &str) -> Result<Flow, CompileError> {
    parse_json(src).or_else(|_| parse_yaml(src))
}

impl Flow {
    pub fn display_name(&self) -> &str {
        if self.name.is_empty() {
            &self.flow_id
        } else {
            &self.name
        }
    }

    pub fn validate(&self) -> Result<(), CompileError> {
        for step in &self.steps {
            let st = step
                .step_type()
                .ok_or_else(|| CompileError::UnknownStepType {
                    step: step.id.clone(),
                    kind: step.kind.clone(),
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
                    serde_json::from_value::<WebScraperArgs>(step.with.clone()).map_err(|e| {
                        CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: format!("web_scraper cần `url` (string): {e}"),
                        }
                    })?;
                }
                StepType::LocalFileReader => {
                    serde_json::from_value::<FileReaderArgs>(step.with.clone()).map_err(|e| {
                        CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: format!("local_file_reader cần `path` (string): {e}"),
                        }
                    })?;
                }
                StepType::AiAgent => {
                    let args =
                        serde_json::from_value::<AiAgentArgs>(step.with.clone()).map_err(|e| {
                            CompileError::InvalidStep {
                                step: step.id.clone(),
                                msg: format!(
                                    "ai_agent cần `goal`; `model` có thể lấy từ `LLM_MODEL`: {e}"
                                ),
                            }
                        })?;
                    if args.model.trim().is_empty() && llm_model_env().is_none() {
                        return Err(CompileError::InvalidStep {
                            step: step.id.clone(),
                            msg: "ai_agent cần `model` hoặc biến môi trường `LLM_MODEL`".into(),
                        });
                    }
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

fn llm_model_env() -> Option<String> {
    std::env::var("LLM_MODEL")
        .ok()
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}

#[cfg(test)]
mod tests {
    use super::{parse, parse_json, StepType};
    use std::path::Path;

    #[test]
    fn parse_json_supports_every_step_type() {
        let flow = parse_json(
            r#"{
              "flow_id": "all-step-types",
              "name": "All step types",
              "steps": [
                {
                  "id": "manual",
                  "type": "manual_trigger",
                  "with": {"message": "hello"}
                },
                {
                  "id": "scrape",
                  "type": "web_scraper",
                  "with": {"url": "https://example.com"}
                },
                {
                  "id": "read",
                  "type": "local_file_reader",
                  "with": {"path": "sample.txt"}
                },
                {
                  "id": "agent",
                  "type": "ai_agent",
                  "with": {
                    "model": "test-model",
                    "goal": "Summarize the inputs"
                  }
                }
              ]
            }"#,
        )
        .expect("valid JSON flow");

        let step_types = flow
            .steps
            .iter()
            .map(|step| step.step_type().expect("known step type"))
            .collect::<Vec<_>>();

        assert_eq!(
            step_types,
            vec![
                StepType::ManualTrigger,
                StepType::WebScraper,
                StepType::LocalFileReader,
                StepType::AiAgent,
            ]
        );
    }

    #[test]
    fn transitional_parse_keeps_legacy_yaml_working() {
        let flow =
            parse("flow_id: legacy\nsteps: []").expect("legacy YAML remains available to the CLI");
        assert_eq!(flow.flow_id, "legacy");
    }

    #[test]
    fn json_test_data_flows_parse_and_validate() {
        let flows_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../test-data/flows");
        let entries = std::fs::read_dir(&flows_dir).expect("test-data/flows directory");
        let mut count = 0;

        for entry in entries {
            let path = entry.expect("flow fixture entry").path();
            if path.extension().and_then(|extension| extension.to_str()) != Some("json") {
                continue;
            }

            let source = std::fs::read_to_string(&path).expect("read JSON flow fixture");
            let flow =
                parse_json(&source).unwrap_or_else(|error| panic!("{}: {error}", path.display()));
            flow.validate()
                .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
            crate::compiler::compile(&flow)
                .unwrap_or_else(|error| panic!("{}: {error}", path.display()));
            count += 1;
        }

        assert_eq!(count, 6, "expected all six JSON flow fixtures");
    }
}
