use std::{
    collections::HashMap,
    sync::{Mutex, MutexGuard},
};

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use symflow_store::{AuthStore, AuthStoreError, PasswordIdentityRecord, SessionRecord, UserRecord};
use uuid::Uuid;

#[derive(Default)]
pub struct MemoryAuthStore {
    inner: Mutex<MemoryAuthState>,
}

#[derive(Default)]
struct MemoryAuthState {
    users: HashMap<Uuid, UserRecord>,
    identities: HashMap<String, PasswordIdentityRecord>,
    sessions: HashMap<Uuid, SessionRecord>,
}

impl MemoryAuthStore {
    pub fn new() -> Self {
        Self::default()
    }

    fn lock(&self) -> Result<MutexGuard<'_, MemoryAuthState>, AuthStoreError> {
        self.inner
            .lock()
            .map_err(|_| AuthStoreError::Backend("memory auth store lock poisoned".to_string()))
    }
}

#[async_trait]
impl AuthStore for MemoryAuthStore {
    async fn create_user_with_password(
        &self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRecord, AuthStoreError> {
        let mut state = self.lock()?;
        if state.identities.contains_key(username) {
            return Err(AuthStoreError::DuplicateUsername);
        }

        let user = UserRecord {
            id: Uuid::new_v4(),
            username: username.to_string(),
            created_at: Utc::now(),
        };
        state.identities.insert(
            username.to_string(),
            PasswordIdentityRecord {
                user_id: user.id,
                username: user.username.clone(),
                password_hash: password_hash.to_string(),
            },
        );
        state.users.insert(user.id, user.clone());
        Ok(user)
    }

    async fn find_password_identity(
        &self,
        username: &str,
    ) -> Result<Option<PasswordIdentityRecord>, AuthStoreError> {
        Ok(self.lock()?.identities.get(username).cloned())
    }

    async fn create_session(
        &self,
        user_id: Uuid,
        expires_at: DateTime<Utc>,
        user_agent: Option<&str>,
        ip_address: Option<&str>,
    ) -> Result<SessionRecord, AuthStoreError> {
        let session = SessionRecord {
            id: Uuid::new_v4(),
            user_id,
            created_at: Utc::now(),
            expires_at,
            last_seen_at: Utc::now(),
            user_agent: user_agent.map(str::to_string),
            ip_address: ip_address.map(str::to_string),
        };
        self.lock()?.sessions.insert(session.id, session.clone());
        Ok(session)
    }

    async fn get_session(&self, session_id: Uuid) -> Result<Option<SessionRecord>, AuthStoreError> {
        let mut state = self.lock()?;
        let Some(session) = state.sessions.get(&session_id).cloned() else {
            return Ok(None);
        };
        if session.expires_at <= Utc::now() {
            state.sessions.remove(&session_id);
            return Ok(None);
        }
        Ok(Some(session))
    }

    async fn delete_session(&self, session_id: Uuid) -> Result<bool, AuthStoreError> {
        Ok(self.lock()?.sessions.remove(&session_id).is_some())
    }

    async fn get_user(&self, user_id: Uuid) -> Result<Option<UserRecord>, AuthStoreError> {
        Ok(self.lock()?.users.get(&user_id).cloned())
    }
}
