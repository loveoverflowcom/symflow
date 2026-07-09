use async_trait::async_trait;
use chrono::{DateTime, Utc};
use thiserror::Error;
use uuid::Uuid;

use crate::models::auth::{PasswordIdentityRecord, SessionRecord, UserRecord};

#[derive(Debug, Error)]
pub enum AuthStoreError {
    #[error("username already exists")]
    DuplicateUsername,
    #[error("authentication store error: {0}")]
    Backend(String),
}

#[async_trait]
pub trait AuthStore: Send + Sync {
    async fn create_user_with_password(
        &self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRecord, AuthStoreError>;

    async fn find_password_identity(
        &self,
        username: &str,
    ) -> Result<Option<PasswordIdentityRecord>, AuthStoreError>;

    async fn create_session(
        &self,
        user_id: Uuid,
        expires_at: DateTime<Utc>,
        user_agent: Option<&str>,
        ip_address: Option<&str>,
    ) -> Result<SessionRecord, AuthStoreError>;

    async fn get_session(&self, session_id: Uuid) -> Result<Option<SessionRecord>, AuthStoreError>;

    async fn delete_session(&self, session_id: Uuid) -> Result<bool, AuthStoreError>;

    async fn get_user(&self, user_id: Uuid) -> Result<Option<UserRecord>, AuthStoreError>;
}
