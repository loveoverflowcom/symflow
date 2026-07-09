use once_cell::sync::Lazy;
use regex::Regex;

static USERNAME_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^[a-zA-Z0-9._-]{3,20}$").expect("valid username regex"));
static PASSWORD_RE: Lazy<Regex> =
    Lazy::new(|| Regex::new(r"^\S{8,32}$").expect("valid password regex"));

pub fn validate_username(username: &str) -> Result<(), &'static str> {
    if USERNAME_RE.is_match(username) {
        Ok(())
    } else {
        Err("username must be 3-20 characters: letters, numbers, . _ -")
    }
}

pub fn validate_password(password: &str) -> Result<(), &'static str> {
    if PASSWORD_RE.is_match(password) {
        Ok(())
    } else {
        Err("password must be 8-32 non-whitespace characters")
    }
}

pub fn normalize_username(username: &str) -> String {
    username.to_ascii_lowercase()
}

#[cfg(test)]
mod tests {
    use super::{normalize_username, validate_password, validate_username};

    #[test]
    fn username_contract_matches_the_web_contract() {
        assert!(validate_username("alice.dev_1").is_ok());
        assert!(validate_username("ab").is_err());
        assert!(validate_username("alice bob").is_err());
        assert!(validate_username("alice@example.com").is_err());
        assert_eq!(normalize_username("Alice.Dev"), "alice.dev");
    }

    #[test]
    fn password_contract_rejects_length_and_whitespace() {
        assert!(validate_password("secret123").is_ok());
        assert!(validate_password("short").is_err());
        assert!(validate_password("pass word123").is_err());
        assert!(validate_password("password\n123").is_err());
    }
}
