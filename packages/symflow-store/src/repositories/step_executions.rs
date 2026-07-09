use super::backend_err;
use crate::models::StepExecRow;
use serde_json::Value;
use sqlx::{PgPool, Row};
use symflow_core::error::StoreError;
use symflow_core::state::StepStatus;
use symflow_core::store::StepRecord;
use uuid::Uuid;

pub async fn upsert_step(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
    status: StepStatus,
) -> Result<(), StoreError> {
    sqlx::query(
        "INSERT INTO step_executions (run_id, step_id, status) VALUES ($1, $2, $3) ON CONFLICT (run_id, step_id) DO NOTHING",
    ).bind(run_id).bind(step_id).bind(status.as_db_str()).execute(pool).await.map_err(backend_err)?;
    Ok(())
}

pub async fn set_step_status(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
    status: StepStatus,
) -> Result<(), StoreError> {
    if status == StepStatus::Running {
        sqlx::query("UPDATE step_executions SET status = $1, executed_at = now() WHERE run_id = $2 AND step_id = $3")
            .bind(status.as_db_str()).bind(run_id).bind(step_id).execute(pool).await.map_err(backend_err)?;
    } else {
        sqlx::query("UPDATE step_executions SET status = $1 WHERE run_id = $2 AND step_id = $3")
            .bind(status.as_db_str())
            .bind(run_id)
            .bind(step_id)
            .execute(pool)
            .await
            .map_err(backend_err)?;
    }
    Ok(())
}

pub async fn set_resolved_inputs(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
    inputs: &Value,
) -> Result<(), StoreError> {
    sqlx::query(
        "UPDATE step_executions SET resolved_inputs = $1 WHERE run_id = $2 AND step_id = $3",
    )
    .bind(inputs)
    .bind(run_id)
    .bind(step_id)
    .execute(pool)
    .await
    .map_err(backend_err)?;
    Ok(())
}

pub async fn complete_step(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
    outputs: &Value,
) -> Result<(), StoreError> {
    sqlx::query("UPDATE step_executions SET status = 'COMPLETED', outputs = $1 WHERE run_id = $2 AND step_id = $3")
        .bind(outputs).bind(run_id).bind(step_id).execute(pool).await.map_err(backend_err)?;
    Ok(())
}

pub async fn fail_step(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
    error: &str,
) -> Result<(), StoreError> {
    sqlx::query("UPDATE step_executions SET status = 'FAILED', error = $1 WHERE run_id = $2 AND step_id = $3")
        .bind(error).bind(run_id).bind(step_id).execute(pool).await.map_err(backend_err)?;
    Ok(())
}

pub async fn get_step_outputs(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
) -> Result<Option<Value>, StoreError> {
    let row = sqlx::query("SELECT outputs FROM step_executions WHERE run_id = $1 AND step_id = $2")
        .bind(run_id)
        .bind(step_id)
        .fetch_optional(pool)
        .await
        .map_err(backend_err)?;
    match row {
        Some(r) => Ok(r
            .try_get::<Option<Value>, _>("outputs")
            .map_err(backend_err)?),
        None => Ok(None),
    }
}

pub async fn append_agent_log(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
    entry: Value,
) -> Result<(), StoreError> {
    let wrapped = Value::Array(vec![entry]);
    sqlx::query(
        "UPDATE step_executions SET agent_logs = COALESCE(agent_logs, '[]'::jsonb) || $1::jsonb WHERE run_id = $2 AND step_id = $3",
    ).bind(wrapped).bind(run_id).bind(step_id).execute(pool).await.map_err(backend_err)?;
    Ok(())
}

pub async fn list_steps(pool: &PgPool, run_id: Uuid) -> Result<Vec<StepRecord>, StoreError> {
    let rows = sqlx::query_as::<_, StepExecRow>(
        "SELECT run_id, step_id, status, resolved_inputs, outputs, agent_logs, error, executed_at \
         FROM step_executions WHERE run_id = $1 ORDER BY executed_at ASC, step_id ASC",
    )
    .bind(run_id)
    .fetch_all(pool)
    .await
    .map_err(backend_err)?;
    Ok(rows.into_iter().map(StepExecRow::into_record).collect())
}

pub async fn get_step(
    pool: &PgPool,
    run_id: Uuid,
    step_id: &str,
) -> Result<Option<StepRecord>, StoreError> {
    let row = sqlx::query_as::<_, StepExecRow>(
        "SELECT run_id, step_id, status, resolved_inputs, outputs, agent_logs, error, executed_at \
         FROM step_executions WHERE run_id = $1 AND step_id = $2",
    )
    .bind(run_id)
    .bind(step_id)
    .fetch_optional(pool)
    .await
    .map_err(backend_err)?;
    Ok(row.map(StepExecRow::into_record))
}
