//! Agent/Tool Protocol (MCP-aligned).

use crate::error::ToolError;
use async_trait::async_trait;
use serde_json::Value;
use std::path::PathBuf;

#[derive(Clone)]
pub struct ToolContext {
    pub sandbox_dir: PathBuf,
}

#[derive(Debug, Clone)]
pub struct ToolOutput {
    pub content: Vec<ToolContent>,
    pub is_error: bool,
}

impl ToolOutput {
    pub fn text(s: impl Into<String>) -> Self {
        ToolOutput { content: vec![ToolContent::Text(s.into())], is_error: false }
    }
    pub fn error(s: impl Into<String>) -> Self {
        ToolOutput { content: vec![ToolContent::Text(s.into())], is_error: true }
    }
    pub fn to_text(&self) -> String {
        self.content.iter().map(|c| match c {
            ToolContent::Text(t) => t.clone(),
            ToolContent::Resource { uri, .. } => format!("[resource: {uri}]"),
        }).collect::<Vec<_>>().join("\n")
    }
}

#[derive(Debug, Clone)]
pub enum ToolContent {
    Text(String),
    Resource { uri: String, description: String },
}

#[async_trait]
pub trait Tool: Send + Sync {
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn input_schema(&self) -> Value;
    async fn call(&self, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError>;
}

pub trait Agent: Send + Sync {
    fn id(&self) -> &str;
    fn name(&self) -> &str;
    fn description(&self) -> &str;
    fn tools(&self) -> Vec<Box<dyn Tool>>;
}

pub struct Registry {
    agents: Vec<Box<dyn Agent>>,
}

impl Registry {
    pub fn new() -> Self { Registry { agents: Vec::new() } }

    pub fn register(&mut self, agent: Box<dyn Agent>) { self.agents.push(agent); }

    pub fn find_tool(&self, name: &str) -> Option<Box<dyn Tool>> {
        for agent in &self.agents {
            for tool in agent.tools() {
                if tool.name() == name { return Some(tool); }
            }
        }
        None
    }

    pub fn is_known_capability(&self, name: &str) -> bool {
        self.agents.iter().any(|a| a.id() == name) || self.find_tool(name).is_some()
    }

    pub fn expand_allowed(&self, allowed: &[String]) -> Vec<String> {
        let mut result = Vec::new();
        for cap in allowed {
            if let Some(agent) = self.agents.iter().find(|a| a.id() == cap.as_str()) {
                for tool in agent.tools() { result.push(tool.name().to_string()); }
            } else {
                result.push(cap.clone());
            }
        }
        result
    }

    pub fn schemas_for(&self, allowed: &[String]) -> Vec<Value> {
        let expanded = self.expand_allowed(allowed);
        let mut schemas = Vec::new();
        for name in &expanded {
            for agent in &self.agents {
                for tool in agent.tools() {
                    if tool.name() == name {
                        schemas.push(serde_json::json!({
                            "name": tool.name(),
                            "description": tool.description(),
                            "parameters": tool.input_schema(),
                        }));
                    }
                }
            }
        }
        schemas
    }

    pub fn catalog(&self) -> Vec<Value> {
        self.agents.iter().map(|a| {
            let tools: Vec<Value> = a.tools().iter().map(|t| serde_json::json!({
                "name": t.name(),
                "description": t.description(),
                "inputSchema": t.input_schema(),
            })).collect();
            serde_json::json!({ "id": a.id(), "name": a.name(), "description": a.description(), "tools": tools })
        }).collect()
    }

    pub fn agent_catalog(&self, id: &str) -> Option<Value> {
        self.catalog().into_iter().find(|v| v["id"] == id)
    }
}

impl Default for Registry { fn default() -> Self { Self::new() } }
