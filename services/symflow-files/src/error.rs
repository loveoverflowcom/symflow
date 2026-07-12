use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("no file part found in multipart request")]
    NoFilePart,

    #[error("failed to read file data: {0}")]
    ReadField(String),

    #[error("io error: {0}")]
    Io(#[from] std::io::Error),

    #[allow(dead_code)]
    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("file too large: maximum allowed size is {max_mb}MB, got {actual_mb:.2}MB")]
    FileTooLarge { max_mb: u64, actual_mb: f64 },
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let code = match &self {
            Self::BadRequest(_) | Self::NoFilePart | Self::FileTooLarge { .. } => {
                StatusCode::BAD_REQUEST
            }
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        (code, Json(json!({ "error": self.to_string() }))).into_response()
    }
}
