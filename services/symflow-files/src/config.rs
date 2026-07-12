use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct Config {
    pub port: u16,
    pub uploads_dir: String,
    pub public_base_url: String,
}

impl Config {
    pub fn from_env() -> Self {
        let port: u16 = std::env::var("FILES_PORT")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(3200);

        let uploads_dir = std::env::var("UPLOADS_DIR").unwrap_or_else(|_| "./uploads".to_string());

        let public_base_url =
            std::env::var("PUBLIC_BASE_URL").unwrap_or_else(|_| format!("http://localhost:{port}"));

        Self {
            port,
            uploads_dir: normalize_dir(uploads_dir),
            public_base_url: public_base_url.trim_end_matches('/').to_string(),
        }
    }
}

fn normalize_dir(path: String) -> String {
    let path = PathBuf::from(path);
    path.to_string_lossy().to_string()
}
