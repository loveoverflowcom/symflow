use symflow_store::{AuthStoreError, SessionRecord, UserRecord};

use crate::{
    app::AppState,
    auth::{
        password::{hash_password, verify_password},
        session,
        validation::{normalize_username, validate_password, validate_username},
    },
    error::ApiError,
};

pub async fn register(
    state: &AppState,
    username: &str,
    password: &str,
    user_agent: Option<&str>,
) -> Result<(UserRecord, SessionRecord), ApiError> {
    validate_username(username).map_err(ApiError::bad_request)?;
    validate_password(password).map_err(ApiError::bad_request)?;
    let username = normalize_username(username);
    let password_hash =
        hash_password(password).map_err(|_| ApiError::internal("could not secure password"))?;
    let user = state
        .auth_store
        .create_user_with_password(&username, &password_hash)
        .await
        .map_err(map_register_store_error)?;
    let session = create_session(state, user.id, user_agent).await?;
    Ok((user, session))
}

pub async fn login(
    state: &AppState,
    username: &str,
    password: &str,
    user_agent: Option<&str>,
) -> Result<(UserRecord, SessionRecord), ApiError> {
    if validate_username(username).is_err() || validate_password(password).is_err() {
        return Err(ApiError::unauthorized("invalid username or password"));
    }
    let username = normalize_username(username);
    let identity = state
        .auth_store
        .find_password_identity(&username)
        .await
        .map_err(|_| ApiError::internal("authentication service unavailable"))?
        .ok_or_else(|| ApiError::unauthorized("invalid username or password"))?;

    if !verify_password(&identity.password_hash, password) {
        return Err(ApiError::unauthorized("invalid username or password"));
    }

    let user = state
        .auth_store
        .get_user(identity.user_id)
        .await
        .map_err(|_| ApiError::internal("authentication service unavailable"))?
        .ok_or_else(|| ApiError::unauthorized("invalid username or password"))?;
    let session = create_session(state, user.id, user_agent).await?;
    Ok((user, session))
}

async fn create_session(
    state: &AppState,
    user_id: uuid::Uuid,
    user_agent: Option<&str>,
) -> Result<SessionRecord, ApiError> {
    state
        .auth_store
        .create_session(user_id, session::expires_at(), user_agent, None)
        .await
        .map_err(|_| ApiError::internal("authentication service unavailable"))
}

fn map_register_store_error(error: AuthStoreError) -> ApiError {
    match error {
        AuthStoreError::DuplicateUsername => ApiError::conflict("username already exists"),
        AuthStoreError::Backend(_) => ApiError::internal("authentication service unavailable"),
    }
}
