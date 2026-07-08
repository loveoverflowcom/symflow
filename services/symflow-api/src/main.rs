mod app;
mod compat;
mod dto;
mod error;
mod realtime;
mod routes;

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use app::{default_sandbox_dir, AppState};
use axum::http::{header::CONTENT_TYPE, Method};
use dotenvy::dotenv;
use sqlx::PgPool;
use routes::router;
use symflow_core::mem::MemoryStore;
use symflow_core::store::Store;
use symflow_store::PgStore;
use tower_http::{
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv().ok();

    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(true)
        .compact()
        .init();

    let sandbox_dir = default_sandbox_dir();
    std::fs::create_dir_all(&sandbox_dir)
        .with_context(|| format!("failed to create sandbox dir at {}", sandbox_dir.display()))?;

    // TODO: thêm auth/authorization nếu service này được expose ra ngoài localhost.
    let store: Arc<dyn Store> = match std::env::var("DATABASE_URL") {
        Ok(db_url) => {
            let pool = PgPool::connect(&db_url)
                .await
                .context("failed to connect to DATABASE_URL")?;
            sqlx::migrate!("../../packages/symflow-store/migrations")
                .run(&pool)
                .await
                .context("database migrations failed")?;
            Arc::new(PgStore::new(pool))
        }
        Err(_) => {
            tracing::warn!("DATABASE_URL not set, using in-memory store (data lost on restart)");
            Arc::new(MemoryStore::new())
        }
    };

    let state = AppState::with_store(sandbox_dir, store);
    let app = router(state).layer(
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE, Method::OPTIONS])
            .allow_headers([CONTENT_TYPE]),
    ).layer(TraceLayer::new_for_http());

    let addr: SocketAddr = std::env::var("SYMFLOW_API_ADDR")
        .or_else(|_| std::env::var("BIND_ADDR"))
        .unwrap_or_else(|_| "127.0.0.1:8787".to_string())
        .parse()
        .context("invalid bind address")?;

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, "symflow-api listening");
    axum::serve(listener, app).await?;

    Ok(())
}
