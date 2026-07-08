//! Variable Resolution: thay token `{{steps.step_id.field}}` bằng giá trị thật từ DB.

use crate::error::ResolveError;
use crate::store::Store;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::Value;
use uuid::Uuid;

static TOKEN: Lazy<Regex> = Lazy::new(|| {
    Regex::new(r"\{\{\s*steps\.([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\s*\}\}").unwrap()
});

pub async fn resolve_str(raw: &str, run_id: Uuid, store: &dyn Store) -> Result<String, ResolveError> {
    let mut out = String::new();
    let mut last = 0usize;
    for cap in TOKEN.captures_iter(raw) {
        let m = cap.get(0).unwrap();
        out.push_str(&raw[last..m.start()]);
        let (step_id, field) = (&cap[1], &cap[2]);
        let outputs = store.get_step_outputs(run_id, step_id).await?
            .ok_or_else(|| ResolveError::MissingStep(step_id.to_string()))?;
        let val = outputs.get(field)
            .ok_or_else(|| ResolveError::MissingField(step_id.to_string(), field.to_string()))?;
        out.push_str(&val_to_string(val));
        last = m.end();
    }
    out.push_str(&raw[last..]);
    Ok(out)
}

pub async fn resolve_value(val: &Value, run_id: Uuid, store: &dyn Store) -> Result<Value, ResolveError> {
    match val {
        Value::String(s) => Ok(Value::String(resolve_str(s, run_id, store).await?)),
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (k, v) in map {
                out.insert(k.clone(), Box::pin(resolve_value(v, run_id, store)).await?);
            }
            Ok(Value::Object(out))
        }
        Value::Array(arr) => {
            let mut out = Vec::with_capacity(arr.len());
            for v in arr { out.push(Box::pin(resolve_value(v, run_id, store)).await?); }
            Ok(Value::Array(out))
        }
        other => Ok(other.clone()),
    }
}

fn val_to_string(v: &Value) -> String {
    match v { Value::String(s) => s.clone(), other => other.to_string() }
}
