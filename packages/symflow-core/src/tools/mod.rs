//! Facade trên Registry: is_known_capability, dispatch, catalog, schemas_for.

use crate::agents::default_registry;
use crate::error::ToolError;
use crate::protocol::{ToolContext, ToolOutput};
use once_cell::sync::Lazy;
use serde_json::Value;

static REGISTRY: Lazy<crate::protocol::Registry> = Lazy::new(default_registry);

pub fn is_known_capability(name: &str) -> bool { REGISTRY.is_known_capability(name) }

pub fn is_allowed(tool_name: &str, allowed: &[String]) -> bool {
    REGISTRY.expand_allowed(allowed).iter().any(|t| t == tool_name)
}

pub async fn dispatch(tool_name: &str, args: Value, ctx: &ToolContext) -> Result<ToolOutput, ToolError> {
    let tool = REGISTRY.find_tool(tool_name)
        .ok_or_else(|| ToolError::Unknown(tool_name.to_string()))?;
    tool.call(args, ctx).await
}

pub fn schemas_for(allowed: &[String]) -> Vec<Value> { REGISTRY.schemas_for(allowed) }
pub fn catalog()                         -> Vec<Value> { REGISTRY.catalog() }
pub fn agent_catalog(id: &str)           -> Option<Value> { REGISTRY.agent_catalog(id) }
