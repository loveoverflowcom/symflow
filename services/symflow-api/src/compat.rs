use serde_yaml::{Mapping, Value};
use symflow_core::dsl::Flow;
use symflow_core::error::CompileError;
use uuid::Uuid;

use crate::dto::FlowUpsertRequest;

pub fn parse_flow_script(payload: &FlowUpsertRequest, fallback_id: Option<&str>) -> Result<Flow, CompileError> {
    if let Ok(flow) = symflow_core::dsl::parse(&payload.dsl_script) {
        return Ok(flow);
    }

    let raw: Value = serde_yaml::from_str(&payload.dsl_script)
        .map_err(|e| CompileError::Parse(e.to_string()))?;

    let patched = patch_legacy_flow(raw, payload.name.as_deref(), fallback_id);
    serde_yaml::from_value::<Flow>(patched)
        .map_err(|e| CompileError::Parse(e.to_string()))
}

fn patch_legacy_flow(raw: Value, name: Option<&str>, fallback_id: Option<&str>) -> Value {
    let Some(map) = raw.as_mapping() else {
        return raw;
    };

    let mut map: Mapping = map.clone();
    let flow_id_key = Value::String("flow_id".to_string());
    let name_key = Value::String("name".to_string());

    if !map.contains_key(&flow_id_key) {
        if let Some(fallback) = fallback_id.filter(|value| !value.trim().is_empty()) {
            map.insert(flow_id_key.clone(), Value::String(fallback.to_string()));
        } else if let Some(existing_name) = map
            .get(&name_key)
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
        {
            map.insert(flow_id_key.clone(), Value::String(existing_name.to_string()));
        } else if let Some(explicit_name) = name.filter(|value| !value.trim().is_empty()) {
            let slug = slugify(explicit_name);
            map.insert(
                flow_id_key.clone(),
                Value::String(if slug.is_empty() {
                    format!("flow-{}", Uuid::new_v4().simple())
                } else {
                    slug
                }),
            );
        } else {
            map.insert(flow_id_key.clone(), Value::String(format!("flow-{}", Uuid::new_v4().simple())));
        }
    }

    Value::Mapping(map)
}

fn slugify(input: &str) -> String {
    let slug = input
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>();

    slug.split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
