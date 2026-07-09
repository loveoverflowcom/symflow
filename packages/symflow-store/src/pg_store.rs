use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

use crate::repositories::{flow_runs, flows, step_executions};
use crate::{
    auth_store::{AuthStore, AuthStoreError},
    models::auth::{PasswordIdentityRecord, SessionRecord, UserRecord},
    repositories::{auth_identities, sessions, users},
};
use symflow_core::error::StoreError;
use symflow_core::state::RunStatus;
use symflow_core::state::StepStatus;
use symflow_core::store::{FlowRecord, FlowSummary, RunRecord, StepRecord, Store};

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
    async fn upsert_flow(&self, id: &str, name: &str, dsl_script: &str) -> Result<(), StoreError> {
        flows::upsert_flow(&self.pool, id, name, dsl_script).await
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

    async fn get_run(&self, run_id: Uuid) -> Result<Option<RunRecord>, StoreError> {
        flow_runs::get_run(&self.pool, run_id).await
    }

    async fn list_runs(&self) -> Result<Vec<RunRecord>, StoreError> {
        flow_runs::list_runs(&self.pool).await
    }

    async fn upsert_step(
        &self,
        run_id: Uuid,
        step_id: &str,
        status: StepStatus,
    ) -> Result<(), StoreError> {
        step_executions::upsert_step(&self.pool, run_id, step_id, status).await
    }

    async fn set_step_status(
        &self,
        run_id: Uuid,
        step_id: &str,
        status: StepStatus,
    ) -> Result<(), StoreError> {
        step_executions::set_step_status(&self.pool, run_id, step_id, status).await
    }

    async fn set_step_resolved_inputs(
        &self,
        run_id: Uuid,
        step_id: &str,
        inputs: &Value,
    ) -> Result<(), StoreError> {
        step_executions::set_resolved_inputs(&self.pool, run_id, step_id, inputs).await
    }

    async fn complete_step(
        &self,
        run_id: Uuid,
        step_id: &str,
        outputs: &Value,
    ) -> Result<(), StoreError> {
        step_executions::complete_step(&self.pool, run_id, step_id, outputs).await
    }

    async fn fail_step(&self, run_id: Uuid, step_id: &str, error: &str) -> Result<(), StoreError> {
        step_executions::fail_step(&self.pool, run_id, step_id, error).await
    }

    async fn get_step_outputs(
        &self,
        run_id: Uuid,
        step_id: &str,
    ) -> Result<Option<Value>, StoreError> {
        step_executions::get_step_outputs(&self.pool, run_id, step_id).await
    }

    async fn append_agent_log(
        &self,
        run_id: Uuid,
        step_id: &str,
        entry: Value,
    ) -> Result<(), StoreError> {
        step_executions::append_agent_log(&self.pool, run_id, step_id, entry).await
    }

    async fn list_steps(&self, run_id: Uuid) -> Result<Vec<StepRecord>, StoreError> {
        step_executions::list_steps(&self.pool, run_id).await
    }

    async fn get_step(
        &self,
        run_id: Uuid,
        step_id: &str,
    ) -> Result<Option<StepRecord>, StoreError> {
        step_executions::get_step(&self.pool, run_id, step_id).await
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
