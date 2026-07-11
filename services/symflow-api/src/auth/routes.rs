use axum::{
    extract::State,
    http::{header::USER_AGENT, HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use axum_extra::extract::cookie::CookieJar;

use crate::{
    app::AppState,
    auth::{
        dto::{LoginRequest, RegisterRequest, UserResponse},
        extractor::AuthUser,
        service,
        session::{removal_cookie, session_cookie},
    },
    error::ApiError,
};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/api/auth/register", post(register))
        .route("/api/auth/login", post(login))
        .route("/api/auth/logout", post(logout))
        .route("/api/auth/me", get(me))
}

async fn register(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<RegisterRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let (user, auth_session) = service::register(
        &state,
        &payload.username,
        &payload.password,
        user_agent(&headers),
    )
    .await?;
    Ok((
        StatusCode::CREATED,
        jar.add(session_cookie(auth_session.id)),
        Json(UserResponse::from(user)),
    ))
}

async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    jar: CookieJar,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let (user, auth_session) = service::login(
        &state,
        &payload.username,
        &payload.password,
        user_agent(&headers),
    )
    .await?;
    Ok((
        jar.add(session_cookie(auth_session.id)),
        Json(UserResponse::from(user)),
    ))
}

async fn logout(
    auth: AuthUser,
    State(state): State<AppState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, ApiError> {
    if state.auth_required {
        state
            .auth_store
            .delete_session(auth.session_id)
            .await
            .map_err(|_| ApiError::internal("authentication service unavailable"))?;
    }
    Ok((StatusCode::NO_CONTENT, jar.add(removal_cookie())))
}

async fn me(auth: AuthUser) -> Json<UserResponse> {
    Json(UserResponse {
        id: auth.user_id,
        username: auth.username,
    })
}

fn user_agent(headers: &HeaderMap) -> Option<&str> {
    headers
        .get(USER_AGENT)
        .and_then(|value| value.to_str().ok())
}

#[cfg(test)]
mod tests {
    use axum::{
        body::{to_bytes, Body},
        http::{header, HeaderMap, Request, StatusCode},
        Router,
    };
    use chrono::Utc;
    use serde_json::{json, Value};
    use tower::ServiceExt;

    use crate::{
        app::AppState,
        auth::{password::hash_password, session::DEFAULT_COOKIE_NAME},
        routes::router,
    };

    fn test_state() -> AppState {
        AppState::new_auth_required(std::env::temp_dir().join("symflow-auth-tests"))
    }

    async fn send(
        app: Router,
        method: &str,
        uri: &str,
        payload: Option<Value>,
        cookie: Option<&str>,
    ) -> (StatusCode, HeaderMap, String) {
        let mut request = Request::builder().method(method).uri(uri);
        if payload.is_some() {
            request = request.header(header::CONTENT_TYPE, "application/json");
        }
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        let response = app
            .oneshot(
                request
                    .body(Body::from(
                        payload.map(|value| value.to_string()).unwrap_or_default(),
                    ))
                    .expect("request"),
            )
            .await
            .expect("router response");
        let status = response.status();
        let headers = response.headers().clone();
        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("response body");
        (
            status,
            headers,
            String::from_utf8(body.to_vec()).expect("UTF-8 body"),
        )
    }

    fn session_cookie(headers: &HeaderMap) -> String {
        headers[header::SET_COOKIE]
            .to_str()
            .expect("set-cookie")
            .split(';')
            .next()
            .expect("cookie pair")
            .to_string()
    }

    #[tokio::test]
    async fn register_sets_cookie_and_me_returns_normalized_user() {
        let app = router(test_state());
        let (status, headers, body) = send(
            app.clone(),
            "POST",
            "/api/auth/register",
            Some(json!({"username": "Alice.Dev", "password": "secret123"})),
            None,
        )
        .await;

        assert_eq!(status, StatusCode::CREATED);
        assert!(headers[header::SET_COOKIE]
            .to_str()
            .expect("set-cookie")
            .contains("HttpOnly"));
        let registered: Value = serde_json::from_str(&body).expect("user response");
        assert_eq!(registered["username"], "alice.dev");

        let cookie = session_cookie(&headers);
        let (me_status, _, me_body) = send(app, "GET", "/api/auth/me", None, Some(&cookie)).await;
        assert_eq!(me_status, StatusCode::OK);
        assert_eq!(
            serde_json::from_str::<Value>(&me_body).expect("me response")["username"],
            "alice.dev"
        );
    }

    #[tokio::test]
    async fn register_validates_and_rejects_duplicate_username() {
        let app = router(test_state());
        let (invalid_status, _, _) = send(
            app.clone(),
            "POST",
            "/api/auth/register",
            Some(json!({"username": "a b", "password": "short"})),
            None,
        )
        .await;
        assert_eq!(invalid_status, StatusCode::BAD_REQUEST);

        let payload = json!({"username": "duplicate", "password": "secret123"});
        let (first_status, _, _) = send(
            app.clone(),
            "POST",
            "/api/auth/register",
            Some(payload.clone()),
            None,
        )
        .await;
        let (second_status, _, body) =
            send(app, "POST", "/api/auth/register", Some(payload), None).await;
        assert_eq!(first_status, StatusCode::CREATED);
        assert_eq!(second_status, StatusCode::CONFLICT);
        assert_eq!(body, "username already exists");
    }

    #[tokio::test]
    async fn bad_login_uses_generic_error() {
        let app = router(test_state());
        let (status, _, body) = send(
            app,
            "POST",
            "/api/auth/login",
            Some(json!({"username": "unknown", "password": "wrongpass"})),
            None,
        )
        .await;
        assert_eq!(status, StatusCode::UNAUTHORIZED);
        assert_eq!(body, "invalid username or password");
    }

    #[tokio::test]
    async fn login_is_case_insensitive_and_creates_a_new_session() {
        let app = router(test_state());
        let (_, register_headers, _) = send(
            app.clone(),
            "POST",
            "/api/auth/register",
            Some(json!({"username": "CaseUser", "password": "secret123"})),
            None,
        )
        .await;
        let (status, login_headers, body) = send(
            app,
            "POST",
            "/api/auth/login",
            Some(json!({"username": "CASEUSER", "password": "secret123"})),
            None,
        )
        .await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(
            serde_json::from_str::<Value>(&body).expect("login response")["username"],
            "caseuser"
        );
        assert_ne!(
            session_cookie(&register_headers),
            session_cookie(&login_headers)
        );
    }

    #[tokio::test]
    async fn logout_revokes_session_and_clears_cookie() {
        let app = router(test_state());
        let (_, headers, _) = send(
            app.clone(),
            "POST",
            "/api/auth/register",
            Some(json!({"username": "logout-user", "password": "secret123"})),
            None,
        )
        .await;
        let cookie = session_cookie(&headers);

        let (logout_status, logout_headers, _) =
            send(app.clone(), "POST", "/api/auth/logout", None, Some(&cookie)).await;
        assert_eq!(logout_status, StatusCode::NO_CONTENT);
        assert!(logout_headers[header::SET_COOKIE]
            .to_str()
            .expect("clear cookie")
            .contains("Max-Age=0"));

        let (me_status, _, _) = send(app, "GET", "/api/auth/me", None, Some(&cookie)).await;
        assert_eq!(me_status, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn expired_session_and_missing_auth_are_rejected() {
        let state = test_state();
        let user = state
            .auth_store
            .create_user_with_password(
                "expired-user",
                &hash_password("secret123").expect("password hash"),
            )
            .await
            .expect("user");
        let expired = state
            .auth_store
            .create_session(
                user.id,
                Utc::now() - chrono::Duration::seconds(1),
                None,
                None,
            )
            .await
            .expect("expired session");
        let cookie = format!("{DEFAULT_COOKIE_NAME}={}", expired.id);
        let app = router(state);

        let (me_status, _, _) = send(app.clone(), "GET", "/api/auth/me", None, Some(&cookie)).await;
        assert_eq!(me_status, StatusCode::UNAUTHORIZED);

        let (flow_status, _, _) = send(
            app,
            "POST",
            "/api/flows",
            Some(json!({
                "id": "protected",
                "name": "Protected",
                "dsl_script": "export async function main() { return {}; }"
            })),
            None,
        )
        .await;
        assert_eq!(flow_status, StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn authenticated_user_can_create_flow() {
        let app = router(test_state());
        let (_, headers, _) = send(
            app.clone(),
            "POST",
            "/api/auth/register",
            Some(json!({"username": "flow-user", "password": "secret123"})),
            None,
        )
        .await;
        let cookie = session_cookie(&headers);
        let (status, _, _) = send(
            app,
            "POST",
            "/api/flows",
            Some(json!({
                "id": "protected",
                "name": "Protected",
                "dsl_script": "export async function main() { return {}; }"
            })),
            Some(&cookie),
        )
        .await;
        assert_eq!(status, StatusCode::OK);
    }
}
