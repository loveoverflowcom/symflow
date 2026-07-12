use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::{flow_runs, flows};
use crate::{
    auth_store::{AuthStore, AuthStoreError},
    models::auth::{PasswordIdentityRecord, SessionRecord, UserRecord},
    repositories::{auth_identities, sessions, users},
};
use symflow_core::error::StoreError;
use symflow_core::state::RunStatus;
use symflow_core::store::{FlowRecord, FlowSummary, RunRecord, Store};

#[derive(Clone)]
pub struct PgStore {
    pool: PgPool,
}

impl PgStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl Store for PgStore {
    async fn upsert_flow(
        &self,
        id: &str,
        name: &str,
        dsl_script: &str,
        graph: Option<&Value>,
    ) -> Result<(), StoreError> {
        flows::upsert_flow(&self.pool, id, name, dsl_script, graph).await
    }

    async fn get_flow(&self, id: &str) -> Result<Option<FlowRecord>, StoreError> {
        flows::get_flow(&self.pool, id).await
    }

    async fn list_flows(&self) -> Result<Vec<FlowSummary>, StoreError> {
        flows::list_flows(&self.pool).await
    }

    async fn delete_flow(&self, id: &str) -> Result<bool, StoreError> {
        flows::delete_flow(&self.pool, id).await
    }

    async fn create_run(
        &self,
        flow_id: &str,
        initial_inputs: Option<Value>,
    ) -> Result<Uuid, StoreError> {
        flow_runs::create_run(&self.pool, flow_id, initial_inputs).await
    }

    async fn set_run_status(&self, run_id: Uuid, status: RunStatus) -> Result<(), StoreError> {
        flow_runs::set_run_status(&self.pool, run_id, status).await
    }

    async fn save_run_result(
        &self,
        run_id: Uuid,
        status: RunStatus,
        output: Option<Value>,
        execution_logs: Value,
        error: Option<String>,
    ) -> Result<(), StoreError> {
        flow_runs::save_run_result(&self.pool, run_id, status, output, execution_logs, error).await
    }

    async fn get_run(&self, run_id: Uuid) -> Result<Option<RunRecord>, StoreError> {
        flow_runs::get_run(&self.pool, run_id).await
    }

    async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError> {
        flow_runs::list_runs(&self.pool).await
    }
}

#[async_trait]
impl AuthStore for PgStore {
    async fn create_user_with_password(
        &self,
        username: &str,
        password_hash: &str,
    ) -> Result<UserRecord, AuthStoreError> {
        users::create_with_password(&self.pool, username, password_hash).await
    }

    async fn find_password_identity(
        &self,
        username: &str,
    ) -> Result<Option<PasswordIdentityRecord>, AuthStoreError> {
        auth_identities::find_password(&self.pool, username).await
    }

    async fn create_session(
        &self,
        user_id: Uuid,
        expires_at: chrono::DateTime<chrono::Utc>,
        user_agent: Option<&str>,
        ip_address: Option<&str>,
    ) -> Result<SessionRecord, AuthStoreError> {
        sessions::create(&self.pool, user_id, expires_at, user_agent, ip_address).await
    }

    async fn get_session(&self, session_id: Uuid) -> Result<Option<SessionRecord>, AuthStoreError> {
        sessions::get_valid(&self.pool, session_id).await
    }

    async fn delete_session(&self, session_id: Uuid) -> Result<bool, AuthStoreError> {
        sessions::delete(&self.pool, session_id).await
    }

    async fn get_user(&self, user_id: Uuid) -> Result<Option<UserRecord>, AuthStoreError> {
        users::get(&self.pool, user_id).await
    }
}
