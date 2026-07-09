use axum::{
    async_trait,
    extract::{FromRequestParts, State},
    http::request::Parts,
};
use axum_extra::extract::cookie::CookieJar;
use uuid::Uuid;

use crate::{app::AppState, auth::session::cookie_name, error::ApiError};

#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: Uuid,
    pub username: String,
    pub session_id: Uuid,
}

#[async_trait]
impl FromRequestParts<AppState> for AuthUser {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &AppState,
    ) -> Result<Self, Self::Rejection> {
        if !state.auth_required {
            return Ok(Self {
                user_id: Uuid::nil(),
                username: "local-dev".to_string(),
                session_id: Uuid::nil(),
            });
        }

        let State(state) = State::<AppState>::from_request_parts(parts, state)
            .await
            .map_err(|_| ApiError::internal("authentication state unavailable"))?;
        let jar = CookieJar::from_headers(&parts.headers);
        let session_id = jar
            .get(&cookie_name())
            .and_then(|cookie| Uuid::parse_str(cookie.value()).ok())
            .ok_or_else(|| ApiError::unauthorized("not authenticated"))?;
        let session = state
            .auth_store
            .get_session(session_id)
            .await
            .map_err(|_| ApiError::internal("authentication service unavailable"))?
            .ok_or_else(|| ApiError::unauthorized("not authenticated"))?;
        let user = state
            .auth_store
            .get_user(session.user_id)
            .await
            .map_err(|_| ApiError::internal("authentication service unavailable"))?
            .ok_or_else(|| ApiError::unauthorized("not authenticated"))?;

        Ok(Self {
            user_id: user.id,
            username: user.username,
            session_id,
        })
    }
}
