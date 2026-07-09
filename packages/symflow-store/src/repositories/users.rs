use sqlx::PgPool;

use crate::{
    auth_store::AuthStoreError,
    models::auth::{UserRecord, UserRow},
};

pub async fn create_with_password(
    pool: &PgPool,
    username: &str,
    password_hash: &str,
) -> Result<UserRecord, AuthStoreError> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| AuthStoreError::Backend(error.to_string()))?;

    let user = sqlx::query_as::<_, UserRow>(
        "INSERT INTO users (username) VALUES ($1) RETURNING id, username, created_at",
    )
    .bind(username)
    .fetch_one(&mut *transaction)
    .await
    .map_err(map_create_error)?;

    sqlx::query(
        "INSERT INTO auth_identities \
         (user_id, provider, provider_subject, password_hash) \
         VALUES ($1, 'password', $2, $3)",
    )
    .bind(user.id)
    .bind(username)
    .bind(password_hash)
    .execute(&mut *transaction)
    .await
    .map_err(map_create_error)?;

    transaction
        .commit()
        .await
        .map_err(|error| AuthStoreError::Backend(error.to_string()))?;
    Ok(user.into_record())
}

pub async fn get(pool: &PgPool, user_id: uuid::Uuid) -> Result<Option<UserRecord>, AuthStoreError> {
    let user =
        sqlx::query_as::<_, UserRow>("SELECT id, username, created_at FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|error| AuthStoreError::Backend(error.to_string()))?;
    Ok(user.map(UserRow::into_record))
}

fn map_create_error(error: sqlx::Error) -> AuthStoreError {
    if error
        .as_database_error()
        .and_then(|database_error| database_error.code())
        .as_deref()
        == Some("23505")
    {
        AuthStoreError::DuplicateUsername
    } else {
        AuthStoreError::Backend(error.to_string())
    }
}
