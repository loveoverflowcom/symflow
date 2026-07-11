use super::backend_err;
use crate::models::{FlowRow, FlowSummaryRow};
use sqlx::PgPool;
use symflow_core::error::StoreError;
use symflow_core::store::{FlowRecord, FlowSummary};

pub async fn upsert_flow(
    pool: &PgPool,
    id: &str,
    name: &str,
    dsl_script: &str,
) -> Result<(), StoreError> {
    sqlx::query(
        "INSERT INTO flows (id, name, dsl_script) VALUES ($1, $2, $3) \
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, dsl_script = EXCLUDED.dsl_script",
    )
    .bind(id)
    .bind(name)
    .bind(dsl_script)
    .execute(pool)
    .await
    .map_err(backend_err)?;
    Ok(())
}

pub async fn get_flow(pool: &PgPool, id: &str) -> Result<Option<FlowRecord>, StoreError> {
    let row = sqlx::query_as::<_, FlowRow>(
        "SELECT id, name, dsl_script, created_at FROM flows WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(backend_err)?;
    Ok(row.map(FlowRow::into_record))
}

pub async fn list_flows(pool: &PgPool) -> Result<Vec<FlowSummary>, StoreError> {
    let rows = sqlx::query_as::<_, FlowSummaryRow>(
        "SELECT id, name, created_at FROM flows ORDER BY created_at DESC",
    )
    .fetch_all(pool)
    .await
    .map_err(backend_err)?;
    Ok(rows.into_iter().map(FlowSummaryRow::into_summary).collect())
}

pub async fn delete_flow(pool: &PgPool, id: &str) -> Result<bool, StoreError> {
    let mut tx = pool.begin().await.map_err(backend_err)?;

    sqlx::query("DELETE FROM flow_runs WHERE flow_id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(backend_err)?;

    let result = sqlx::query("DELETE FROM flows WHERE id = $1")
        .bind(id)
        .execute(&mut *tx)
        .await
        .map_err(backend_err)?;

    tx.commit().await.map_err(backend_err)?;
    Ok(result.rows_affected() > 0)
}
