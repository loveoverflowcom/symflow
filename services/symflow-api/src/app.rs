use std::path::{Path, PathBuf};
use std::sync::Arc;

use symflow_core::mem::MemoryStore;
use symflow_core::store::Store;
use symflow_store::AuthStore;

use crate::auth::memory_store::MemoryAuthStore;
use crate::task_registry::BackendTaskRegistry;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<dyn Store>,
    pub auth_store: Arc<dyn AuthStore>,
    pub auth_required: bool,
    pub sandbox_dir: PathBuf,
    pub tasks: Arc<BackendTaskRegistry>,
}

impl AppState {
    pub fn new(sandbox_dir: PathBuf) -> Self {
        Self {
            store: Arc::new(MemoryStore::new()),
            auth_store: Arc::new(MemoryAuthStore::new()),
            auth_required: false,
            sandbox_dir,
            tasks: Arc::new(BackendTaskRegistry),
        }
    }

    #[cfg(test)]
    pub fn new_auth_required(sandbox_dir: PathBuf) -> Self {
        Self {
            store: Arc::new(MemoryStore::new()),
            auth_store: Arc::new(MemoryAuthStore::new()),
            auth_required: true,
            sandbox_dir,
            tasks: Arc::new(BackendTaskRegistry),
        }
    }

    pub fn with_stores(
        sandbox_dir: PathBuf,
        store: Arc<dyn Store>,
        auth_store: Arc<dyn AuthStore>,
        auth_required: bool,
    ) -> Self {
        Self {
            store,
            auth_store,
            auth_required,
            sandbox_dir,
            tasks: Arc::new(BackendTaskRegistry),
        }
    }
}

pub fn default_sandbox_dir() -> PathBuf {
    if let Ok(value) = std::env::var("SANDBOX_DIR") {
        let path = PathBuf::from(value);
        return if path.is_absolute() {
            path
        } else {
            std::env::current_dir()
                .unwrap_or_else(|_| PathBuf::from("."))
                .join(path)
        };
    }

    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("data/storage_sandbox")
        .canonicalize()
        .unwrap_or_else(|_| Path::new(env!("CARGO_MANIFEST_DIR")).join("data/storage_sandbox"))
}
