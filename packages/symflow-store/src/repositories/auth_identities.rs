use sqlx::PgPool;

use crate::{
    auth_store::AuthStoreError,
    models::auth::{PasswordIdentityRecord, PasswordIdentityRow},
};

pub async fn find_password(
    pool: &PgPool,
    username: &str,
) -> Result<Option<PasswordIdentityRecord>, AuthStoreError> {
    let identity = sqlx::query_as::<_, PasswordIdentityRow>(
        "SELECT identity.user_id, users.username, identity.password_hash \
         FROM auth_identities AS identity \
         JOIN users ON users.id = identity.user_id \
         WHERE identity.provider = 'password' \
           AND identity.provider_subject = $1 \
           AND identity.password_hash IS NOT NULL",
    )
    .bind(username)
    .fetch_optional(pool)
    .await
    .map_err(|error| AuthStoreError::Backend(error.to_string()))?;

    Ok(identity.map(PasswordIdentityRow::into_record))
}
