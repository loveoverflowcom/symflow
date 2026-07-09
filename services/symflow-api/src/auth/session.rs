use axum_extra::extract::cookie::{Cookie, SameSite};
use chrono::{DateTime, Utc};
use time::Duration;
use uuid::Uuid;

pub const DEFAULT_COOKIE_NAME: &str = "symflow_session";
pub const DEFAULT_TTL_SECS: i64 = 14 * 24 * 60 * 60;

pub fn cookie_name() -> String {
    std::env::var("SYMFLOW_SESSION_COOKIE")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_COOKIE_NAME.to_string())
}

pub fn ttl_secs() -> i64 {
    std::env::var("SYMFLOW_SESSION_TTL_SECS")
        .ok()
        .and_then(|value| value.parse::<i64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_TTL_SECS)
}

pub fn expires_at() -> DateTime<Utc> {
    Utc::now() + chrono::Duration::seconds(ttl_secs())
}

pub fn session_cookie(session_id: Uuid) -> Cookie<'static> {
    Cookie::build((cookie_name(), session_id.to_string()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(cookie_secure())
        .path("/")
        .max_age(Duration::seconds(ttl_secs()))
        .build()
}

pub fn removal_cookie() -> Cookie<'static> {
    Cookie::build((cookie_name(), String::new()))
        .http_only(true)
        .same_site(SameSite::Lax)
        .secure(cookie_secure())
        .path("/")
        .max_age(Duration::ZERO)
        .build()
}

fn cookie_secure() -> bool {
    std::env::var("SYMFLOW_COOKIE_SECURE")
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{session_cookie, DEFAULT_COOKIE_NAME};
    use uuid::Uuid;

    #[test]
    fn session_cookie_has_security_attributes() {
        let cookie = session_cookie(Uuid::new_v4()).to_string();
        assert!(cookie.starts_with(DEFAULT_COOKIE_NAME));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        assert!(cookie.contains("Path=/"));
    }
}
