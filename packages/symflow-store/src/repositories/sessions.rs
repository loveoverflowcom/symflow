use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{
    auth_store::AuthStoreError,
    models::auth::{SessionRecord, SessionRow},
};

pub async fn create(
    pool: &PgPool,
    user_id: Uuid,
    expires_at: DateTime<Utc>,
    user_agent: Option<&str>,
    ip_address: Option<&str>,
) -> Result<SessionRecord, AuthStoreError> {
    let session = sqlx::query_as::<_, SessionRow>(
        "INSERT INTO sessions (id, user_id, expires_at, user_agent, ip_address) \
         VALUES ($1, $2, $3, $4, $5::inet) \
         RETURNING id, user_id, created_at, expires_at, last_seen_at, \
                   user_agent, host(ip_address) AS ip_address",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(expires_at)
    .bind(user_agent)
    .bind(ip_address)
    .fetch_one(pool)
    .await
    .map_err(|error| AuthStoreError::Backend(error.to_string()))?;
    Ok(session.into_record())
}

pub async fn get_valid(
    pool: &PgPool,
    session_id: Uuid,
) -> Result<Option<SessionRecord>, AuthStoreError> {
    let session = sqlx::query_as::<_, SessionRow>(
        "UPDATE sessions SET last_seen_at = now() \
         WHERE id = $1 AND expires_at > now() \
         RETURNING id, user_id, created_at, expires_at, last_seen_at, \
                   user_agent, host(ip_address) AS ip_address",
    )
    .bind(session_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| AuthStoreError::Backend(error.to_string()))?;
    Ok(session.map(SessionRow::into_record))
}

pub async fn delete(pool: &PgPool, session_id: Uuid) -> Result<bool, AuthStoreError> {
    let result = sqlx::query("DELETE FROM sessions WHERE id = $1")
        .bind(session_id)
        .execute(pool)
        .await
        .map_err(|error| AuthStoreError::Backend(error.to_string()))?;
    Ok(result.rows_affected() > 0)
}
