use std::path::{Path, PathBuf};
use std::sync::Arc;

use symflow_core::events::{EventBus, RunEvent};
use symflow_core::mem::MemoryStore;
use symflow_core::store::Store;
use tokio::sync::broadcast;

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<dyn Store>,
    pub bus: EventBus,
    pub sandbox_dir: PathBuf,
}

impl AppState {
    pub fn new(sandbox_dir: PathBuf) -> Self {
        let (bus, _) = broadcast::channel::<RunEvent>(512);
        Self {
            store: Arc::new(MemoryStore::new()),
            bus,
            sandbox_dir,
        }
    }

    pub fn with_store(sandbox_dir: PathBuf, store: Arc<dyn Store>) -> Self {
        let (bus, _) = broadcast::channel::<RunEvent>(512);
        Self { store, bus, sandbox_dir }
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
        .join("../../data/storage_sandbox")
        .canonicalize()
        .unwrap_or_else(|_| Path::new(env!("CARGO_MANIFEST_DIR")).join("../../data/storage_sandbox"))
}
