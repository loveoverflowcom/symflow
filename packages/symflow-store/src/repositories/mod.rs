pub mod flow_runs;
pub mod flows;
pub mod step_executions;

use symflow_core::error::StoreError;

pub(crate) fn backend_err(e: sqlx::Error) -> StoreError {
    StoreError::Backend(e.to_string())
}
