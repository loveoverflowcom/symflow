use serde_yaml::{Mapping, Value};
use symflow_core::dsl::Flow;
use symflow_core::error::CompileError;
use uuid::Uuid;

pub fn parse_flow_script(src: &str, fallback_id: Option<&str>) -> Result<Flow, CompileError> {
    if let Ok(flow) = symflow_core::dsl::parse(src) {
        return Ok(flow);
    }

    let raw: Value = serde_yaml::from_str(src).map_err(|err| CompileError::Parse(err.to_string()))?;
    let patched = patch_legacy_flow(raw, fallback_id);
    serde_yaml::from_value::<Flow>(patched).map_err(|err| CompileError::Parse(err.to_string()))
}

fn patch_legacy_flow(raw: Value, fallback_id: Option<&str>) -> Value {
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
        } else {
            map.insert(flow_id_key.clone(), Value::String(format!("flow-{}", Uuid::new_v4().simple())));
        }
    }

    Value::Mapping(map)
}
