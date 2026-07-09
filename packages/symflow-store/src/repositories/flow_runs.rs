use super::backend_err;
use crate::models::FlowRunRow;
use serde_json::Value;
use sqlx::PgPool;
use symflow_core::error::StoreError;
use symflow_core::state::RunStatus;
use symflow_core::store::RunRecord;
use uuid::Uuid;

pub async fn create_run(
    pool: &PgPool,
    flow_id: &str,
    initial_inputs: Option<Value>,
) -> Result<Uuid, StoreError> {
    let id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO flow_runs (id, flow_id, status, initial_inputs) VALUES ($1, $2, 'PENDING', $3)",
    ).bind(id).bind(flow_id).bind(initial_inputs).execute(pool).await.map_err(backend_err)?;
    Ok(id)
}

pub async fn set_run_status(
    pool: &PgPool,
    run_id: Uuid,
    status: RunStatus,
) -> Result<(), StoreError> {
    if matches!(status, RunStatus::Success | RunStatus::Failed) {
        sqlx::query("UPDATE flow_runs SET status = $1, finished_at = now() WHERE id = $2")
            .bind(status.as_db_str())
            .bind(run_id)
            .execute(pool)
            .await
            .map_err(backend_err)?;
    } else {
        sqlx::query("UPDATE flow_runs SET status = $1 WHERE id = $2")
            .bind(status.as_db_str())
            .bind(run_id)
            .execute(pool)
            .await
            .map_err(backend_err)?;
    }
    Ok(())
}

pub async fn get_run(pool: &PgPool, run_id: Uuid) -> Result<Option<RunRecord>, StoreError> {
    let row = sqlx::query_as::<_, FlowRunRow>(
        "SELECT id, flow_id, status, initial_inputs, created_at, finished_at FROM flow_runs WHERE id = $1",
    ).bind(run_id).fetch_optional(pool).await.map_err(backend_err)?;
    Ok(row.map(FlowRunRow::into_record))
}

pub async fn list_runs(pool: &PgPool) -> Result<Vec<RunRecord>, StoreError> {
    let rows = sqlx::query_as::<_, FlowRunRow>(
        "SELECT id, flow_id, status, initial_inputs, created_at, finished_at \
         FROM flow_runs ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(backend_err)?;

    Ok(rows.into_iter().map(FlowRunRow::into_record).collect())
}
