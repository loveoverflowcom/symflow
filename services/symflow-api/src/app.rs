use std::path::{Path, PathBuf};
use std::sync::Arc;

use symflow_core::events::{EventBus, RunEvent};
use symflow_core::mem::MemoryStore;
use symflow_core::store::Store;
use symflow_store::AuthStore;
use tokio::sync::broadcast;

use crate::auth::memory_store::MemoryAuthStore;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<dyn Store>,
    pub auth_store: Arc<dyn AuthStore>,
    pub auth_required: bool,
    pub bus: EventBus,
    pub sandbox_dir: PathBuf,
}

impl AppState {
    pub fn new(sandbox_dir: PathBuf) -> Self {
        let (bus, _) = broadcast::channel::<RunEvent>(512);
        Self {
            store: Arc::new(MemoryStore::new()),
            auth_store: Arc::new(MemoryAuthStore::new()),
            auth_required: false,
            bus,
            sandbox_dir,
        }
    }

    #[cfg(test)]
    pub fn new_auth_required(sandbox_dir: PathBuf) -> Self {
        let (bus, _) = broadcast::channel::<RunEvent>(512);
        Self {
            store: Arc::new(MemoryStore::new()),
            auth_store: Arc::new(MemoryAuthStore::new()),
            auth_required: true,
            bus,
            sandbox_dir,
        }
    }

    pub fn with_stores(
        sandbox_dir: PathBuf,
        store: Arc<dyn Store>,
        auth_store: Arc<dyn AuthStore>,
        auth_required: bool,
    ) -> Self {
        let (bus, _) = broadcast::channel::<RunEvent>(512);
        Self {
            store,
            auth_store,
            auth_required,
            bus,
            sandbox_dir,
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
