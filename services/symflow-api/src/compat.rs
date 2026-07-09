use serde_json::{Map, Value};
use symflow_core::dsl::Flow;
use symflow_core::error::CompileError;
use uuid::Uuid;

use crate::dto::FlowUpsertRequest;

pub fn parse_flow_script(
    payload: &FlowUpsertRequest,
    fallback_id: Option<&str>,
) -> Result<Flow, CompileError> {
    if let Ok(flow) = symflow_core::dsl::parse_json(&payload.dsl_script) {
        return Ok(flow);
    }

    let raw = match serde_json::from_str::<Value>(&payload.dsl_script) {
        Ok(value) => value,
        Err(json_error) => {
            if payload.dsl_script.trim_start().starts_with(['{', '[']) {
                return Err(CompileError::Parse(format!(
                    "invalid JSON DSL: {json_error}"
                )));
            }

            symflow_core::dsl::parse_yaml_value(&payload.dsl_script).map_err(|yaml_error| {
                CompileError::Parse(format!(
                    "invalid JSON DSL or legacy YAML DSL: {json_error}; {yaml_error}"
                ))
            })?
        }
    };

    let patched = patch_legacy_flow(raw, payload.name.as_deref(), fallback_id);
    serde_json::from_value::<Flow>(patched)
        .map_err(|e| CompileError::Parse(format!("invalid JSON DSL: {e}")))
}

fn patch_legacy_flow(raw: Value, name: Option<&str>, fallback_id: Option<&str>) -> Value {
    let Some(map) = raw.as_object() else {
        return raw;
    };

    let mut map: Map<String, Value> = map.clone();

    if !map.contains_key("flow_id") {
        if let Some(fallback) = fallback_id.filter(|value| !value.trim().is_empty()) {
            map.insert("flow_id".to_string(), Value::String(fallback.to_string()));
        } else if let Some(existing_name) = map
            .get("name")
            .and_then(Value::as_str)
            .filter(|value| !value.trim().is_empty())
        {
            map.insert(
                "flow_id".to_string(),
                Value::String(existing_name.to_string()),
            );
        } else if let Some(explicit_name) = name.filter(|value| !value.trim().is_empty()) {
            let slug = slugify(explicit_name);
            map.insert(
                "flow_id".to_string(),
                Value::String(if slug.is_empty() {
                    format!("flow-{}", Uuid::new_v4().simple())
                } else {
                    slug
                }),
            );
        } else {
            map.insert(
                "flow_id".to_string(),
                Value::String(format!("flow-{}", Uuid::new_v4().simple())),
            );
        }
    }

    Value::Object(map)
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

#[cfg(test)]
mod tests {
    use super::parse_flow_script;
    use crate::dto::FlowUpsertRequest;

    fn request(dsl_script: &str, name: Option<&str>) -> FlowUpsertRequest {
        FlowUpsertRequest {
            id: None,
            name: name.map(str::to_string),
            dsl_script: dsl_script.to_string(),
        }
    }

    #[test]
    fn injects_path_id_into_legacy_json_document() {
        let flow = parse_flow_script(
            &request(
                r#"{"name":"Legacy JSON","steps":[{"id":"start","type":"manual_trigger"}]}"#,
                None,
            ),
            Some("path-flow"),
        )
        .expect("legacy JSON should be patched");

        assert_eq!(flow.flow_id, "path-flow");
    }

    #[test]
    fn accepts_legacy_yaml_during_transition() {
        let flow = parse_flow_script(
            &request(
                "name: Legacy YAML\nsteps:\n  - id: start\n    type: manual_trigger\n",
                None,
            ),
            Some("legacy-yaml"),
        )
        .expect("legacy YAML should be converted");

        assert_eq!(flow.flow_id, "legacy-yaml");
        assert_eq!(flow.steps[0].kind, "manual_trigger");
    }

    #[test]
    fn reports_malformed_json_as_json_error() {
        let error = parse_flow_script(&request(r#"{"flow_id":"broken",]"#, None), None)
            .expect_err("malformed JSON should fail");

        assert!(error.to_string().contains("invalid JSON DSL"));
    }
}
