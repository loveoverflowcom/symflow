use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};

pub fn hash_password(password: &str) -> Result<String, argon2::password_hash::Error> {
    let salt = SaltString::generate(&mut OsRng);
    Ok(Argon2::default()
        .hash_password(password.as_bytes(), &salt)?
        .to_string())
}

pub fn verify_password(password_hash: &str, password: &str) -> bool {
    let Ok(parsed_hash) = PasswordHash::new(password_hash) else {
        return false;
    };
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok()
}

#[cfg(test)]
mod tests {
    use super::{hash_password, verify_password};

    #[test]
    fn argon2_hash_round_trip_and_random_salts() {
        let first = hash_password("secret123").expect("password hash");
        let second = hash_password("secret123").expect("password hash");

        assert_ne!(first, second);
        assert!(first.starts_with("$argon2"));
        assert!(verify_password(&first, "secret123"));
        assert!(!verify_password(&first, "wrong-password"));
    }
}
