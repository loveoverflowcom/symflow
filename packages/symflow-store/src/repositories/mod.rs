pub mod auth_identities;
pub mod flow_runs;
pub mod flows;
pub mod sessions;
pub mod users;

use symflow_core::error::StoreError;

pub(crate) fn backend_err(e: sqlx::Error) -> StoreError {
    StoreError::Backend(e.to_string())
}
