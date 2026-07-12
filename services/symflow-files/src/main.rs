mod config;
mod error;
mod upload;

use std::sync::Arc;

use config::Config;
use tower_http::{cors::CorsLayer, trace::TraceLayer};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    dotenvy::dotenv().ok();

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true)
        .compact()
        .init();

    let cfg = Arc::new(Config::from_env());
    tokio::fs::create_dir_all(&cfg.uploads_dir).await?;

    let app = upload::router(cfg.clone())
        .layer(TraceLayer::new_for_http())
        .layer(CorsLayer::permissive());

    let addr = format!("0.0.0.0:{}", cfg.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    tracing::info!(%addr, uploads_dir = %cfg.uploads_dir, public_base_url = %cfg.public_base_url, "symflow-files listening");
    axum::serve(listener, app).await?;

    Ok(())
}
