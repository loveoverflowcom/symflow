use std::{path::PathBuf, sync::Arc};

use axum::{
    body::Bytes,
    extract::{DefaultBodyLimit, Multipart, State},
    routing::post,
    Json, Router,
};
use serde::Serialize;
use tokio::io::AsyncWriteExt;
use tower_http::services::ServeDir;
use uuid::Uuid;

use crate::{config::Config, error::AppError};

/// Hard cap on the multipart body axum will read before our handler runs.
/// Set slightly above MAX_FILE_SIZE to account for multipart framing overhead.
const BODY_LIMIT: usize = 3 * 1024 * 1024; // 3 MB
const MAX_FILE_SIZE: usize = 2 * 1024 * 1024; // 2 MB

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub id: String,
    pub filename: String,
    pub url: String,
}

pub fn router(cfg: Arc<Config>) -> Router<()> {
    Router::new()
        .route(
            "/upload",
            post(upload_handler).layer(DefaultBodyLimit::max(BODY_LIMIT)),
        )
        .nest_service("/files", ServeDir::new(cfg.uploads_dir.clone()))
        .with_state(cfg)
}

pub async fn upload_handler(
    State(cfg): State<Arc<Config>>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, AppError> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|err| AppError::ReadField(err.to_string()))?
    {
        if field.name().unwrap_or_default() != "file" {
            continue;
        }

        let original_name = field.file_name().unwrap_or("upload").to_string();
        let content_type = field
            .content_type()
            .map(|mime| mime.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string());

        let extension = file_extension(&original_name, &content_type);
        let id = Uuid::new_v4().to_string();
        let filename = format!("{id}.{extension}");
        let path = PathBuf::from(&cfg.uploads_dir).join(&filename);

        let data: Bytes = field
            .bytes()
            .await
            .map_err(|err| AppError::ReadField(err.to_string()))?;

        if data.len() > MAX_FILE_SIZE {
            return Err(AppError::FileTooLarge {
                max_mb: 2,
                actual_mb: data.len() as f64 / (1024.0 * 1024.0),
            });
        }

        tokio::fs::create_dir_all(&cfg.uploads_dir).await?;
        let mut file = tokio::fs::File::create(&path).await?;
        file.write_all(&data).await?;

        let url = format!(
            "{}/files/{}",
            cfg.public_base_url.trim_end_matches('/'),
            filename
        );

        tracing::info!(filename = %filename, bytes = data.len(), %url, "uploaded file");
        return Ok(Json(UploadResponse { id, filename, url }));
    }

    Err(AppError::NoFilePart)
}

fn file_extension(original_name: &str, content_type: &str) -> String {
    std::path::Path::new(original_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_string())
        .or_else(|| {
            mime_guess::get_mime_extensions_str(content_type)
                .and_then(|extensions| extensions.first().copied())
                .map(str::to_string)
        })
        .unwrap_or_else(|| "bin".to_string())
}

#[cfg(test)]
mod tests {
    use super::{file_extension, router};
    use axum::{
        body::{to_bytes, Body},
        http::{header, Request, StatusCode},
    };
    use serde_json::Value;
    use std::sync::Arc;
    use tempfile::TempDir;
    use tower::ServiceExt;

    use crate::config::Config;

    fn test_config(dir: &TempDir) -> Arc<Config> {
        Arc::new(Config {
            port: 3200,
            uploads_dir: dir.path().join("uploads").to_string_lossy().to_string(),
            public_base_url: "http://localhost:3200".to_string(),
        })
    }

    fn multipart_body(boundary: &str, filename: &str, content_type: &str, body: &[u8]) -> String {
        let payload = String::from_utf8_lossy(body);
        format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{filename}\"\r\nContent-Type: {content_type}\r\n\r\n{payload}\r\n--{boundary}--\r\n"
        )
    }

    #[test]
    fn extension_prefers_filename_then_mime_then_bin() {
        assert_eq!(
            file_extension("card.jpg", "application/octet-stream"),
            "jpg"
        );
        assert_eq!(file_extension("upload", "image/png"), "png");
        assert_eq!(file_extension("upload", "application/x-unknown"), "bin");
    }

    #[tokio::test]
    async fn upload_writes_file_and_returns_public_url() {
        let temp = TempDir::new().expect("temp dir");
        let cfg = test_config(&temp);
        tokio::fs::create_dir_all(&cfg.uploads_dir)
            .await
            .expect("uploads dir");
        let app = router(cfg.clone());

        let boundary = "X-BOUNDARY";
        let request = Request::builder()
            .method("POST")
            .uri("/upload")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(Body::from(multipart_body(
                boundary,
                "card.jpg",
                "image/jpeg",
                b"hello world",
            )))
            .expect("request");

        let response = app.oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::OK);

        let body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        let value: Value = serde_json::from_slice(&body).expect("json");
        let filename = value["filename"].as_str().expect("filename").to_string();
        assert!(filename.ends_with(".jpg"));
        assert_eq!(
            value["url"].as_str().expect("url"),
            format!("http://localhost:3200/files/{filename}")
        );

        let uploaded = tokio::fs::read(std::path::Path::new(&cfg.uploads_dir).join(&filename))
            .await
            .expect("uploaded file");
        assert_eq!(uploaded, b"hello world");
    }

    #[tokio::test]
    async fn upload_rejects_file_exceeding_2mb() {
        let temp = TempDir::new().expect("temp dir");
        let cfg = test_config(&temp);
        tokio::fs::create_dir_all(&cfg.uploads_dir)
            .await
            .expect("uploads dir");
        let app = router(cfg);

        let boundary = "X-BOUNDARY";
        // 2MB + 1 byte
        let oversized = vec![0u8; 2 * 1024 * 1024 + 1];
        let mut body = format!(
            "--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"big.bin\"\r\nContent-Type: application/octet-stream\r\n\r\n"
        )
        .into_bytes();
        body.extend_from_slice(&oversized);
        body.extend_from_slice(format!("\r\n--{boundary}--\r\n").as_bytes());

        let request = Request::builder()
            .method("POST")
            .uri("/upload")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(Body::from(body))
            .expect("request");

        let response = app.oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let resp_body = to_bytes(response.into_body(), usize::MAX)
            .await
            .expect("body");
        let value: Value = serde_json::from_slice(&resp_body).expect("json");
        assert!(
            value["error"]
                .as_str()
                .unwrap_or_default()
                .contains("file too large"),
            "expected 'file too large' in error message"
        );
    }

    #[tokio::test]
    async fn upload_returns_bad_request_when_no_file_part_exists() {
        let temp = TempDir::new().expect("temp dir");
        let cfg = test_config(&temp);
        let app = router(cfg);

        let boundary = "X-BOUNDARY";
        let request = Request::builder()
            .method("POST")
            .uri("/upload")
            .header(
                header::CONTENT_TYPE,
                format!("multipart/form-data; boundary={boundary}"),
            )
            .body(Body::from(format!(
                "--{boundary}\r\nContent-Disposition: form-data; name=\"other\"\r\n\r\nvalue\r\n--{boundary}--\r\n"
            )))
            .expect("request");

        let response = app.oneshot(request).await.expect("response");
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
