use super::{NodeExec, StepCtx};
use crate::dsl::FileReaderArgs;
use crate::error::NodeError;
use crate::sandbox;
use async_trait::async_trait;
use serde_json::{json, Value};

pub struct LocalFileReaderNode;

#[async_trait]
impl NodeExec for LocalFileReaderNode {
    async fn run(&self, ctx: &StepCtx) -> Result<Value, NodeError> {
        let args: FileReaderArgs = serde_json::from_value(ctx.resolved_with.clone())
            .map_err(|e| NodeError::FileReader(format!("tham số không hợp lệ: {e}")))?;
        let path = sandbox::safe_path(&ctx.sandbox_dir, &args.path)?;
        let content = tokio::fs::read_to_string(&path).await
            .map_err(|e| NodeError::FileReader(format!("đọc '{}' lỗi: {e}", args.path)))?;
        Ok(json!({ "content": content, "path": args.path, "size": content.len() }))
    }
}
