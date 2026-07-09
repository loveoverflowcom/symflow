use chrono::{DateTime, Utc};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct UserRecord {
    pub id: Uuid,
    pub username: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone)]
pub struct PasswordIdentityRecord {
    pub user_id: Uuid,
    pub username: String,
    pub password_hash: String,
}

#[derive(Debug, Clone)]
pub struct SessionRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub created_at: DateTime<Utc>,
}

impl UserRow {
    pub(crate) fn into_record(self) -> UserRecord {
        UserRecord {
            id: self.id,
            username: self.username,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct PasswordIdentityRow {
    pub user_id: Uuid,
    pub username: String,
    pub password_hash: String,
}

impl PasswordIdentityRow {
    pub(crate) fn into_record(self) -> PasswordIdentityRecord {
        PasswordIdentityRecord {
            user_id: self.user_id,
            username: self.username,
            password_hash: self.password_hash,
        }
    }
}

#[derive(Debug, sqlx::FromRow)]
pub(crate) struct SessionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub user_agent: Option<String>,
    pub ip_address: Option<String>,
}

impl SessionRow {
    pub(crate) fn into_record(self) -> SessionRecord {
        SessionRecord {
            id: self.id,
            user_id: self.user_id,
            created_at: self.created_at,
            expires_at: self.expires_at,
            last_seen_at: self.last_seen_at,
            user_agent: self.user_agent,
            ip_address: self.ip_address,
        }
    }
}
