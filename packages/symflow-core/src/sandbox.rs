//! Sandbox: sanitize path, chống path traversal.

use crate::error::SandboxError;
use std::path::{Component, Path, PathBuf};

pub fn safe_path(sandbox: &Path, filename: &str) -> Result<PathBuf, SandboxError> {
    let candidate = Path::new(filename);
    if candidate.is_absolute()
        || candidate.components().any(|c| matches!(c, Component::ParentDir | Component::RootDir))
    {
        return Err(SandboxError::Traversal(filename.to_string()));
    }
    let full = sandbox.join(candidate);
    let base = sandbox.canonicalize().map_err(SandboxError::Io)?;
    let parent = full.parent().unwrap_or(&full);
    if !parent.exists() { std::fs::create_dir_all(parent).map_err(SandboxError::Io)?; }
    let check = parent.canonicalize().map_err(SandboxError::Io)?;
    if !check.starts_with(&base) {
        return Err(SandboxError::Traversal(filename.to_string()));
    }
    Ok(full)
}
