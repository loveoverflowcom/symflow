mod app;
mod auth;
mod compat;
mod dto;
mod error;
mod realtime;
mod routes;

use std::net::SocketAddr;
use std::sync::Arc;

use anyhow::Context;
use app::{default_sandbox_dir, AppState};
use axum::http::{
    header::{AUTHORIZATION, CONTENT_TYPE, COOKIE},
    HeaderValue, Method,
};
use dotenvy::dotenv;
use routes::router;
use sqlx::PgPool;
use symflow_core::mem::MemoryStore;
use symflow_core::store::Store;
use symflow_store::{AuthStore, PgStore};
use tower_http::{cors::CorsLayer, trace::TraceLayer};
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

    let (store, auth_store, auth_required): (Arc<dyn Store>, Arc<dyn AuthStore>, bool) =
        match std::env::var("DATABASE_URL") {
            Ok(db_url) => {
                let pool = PgPool::connect(&db_url)
                    .await
                    .context("failed to connect to DATABASE_URL")?;
                sqlx::migrate!("../../packages/symflow-store/migrations")
                    .run(&pool)
                    .await
                    .context("database migrations failed")?;
                let postgres = Arc::new(PgStore::new(pool));
                (postgres.clone(), postgres, true)
            }
            Err(_) => {
                if std::env::var("SYMFLOW_AUTH_DISABLED").as_deref() != Ok("1") {
                    anyhow::bail!(
                    "DATABASE_URL is required for authentication; set SYMFLOW_AUTH_DISABLED=1 only for local flow-only development"
                );
                }
                tracing::warn!(
                    "authentication disabled; using in-memory stores (data lost on restart)"
                );
                (
                    Arc::new(MemoryStore::new()),
                    Arc::new(auth::memory_store::MemoryAuthStore::new()),
                    false,
                )
            }
        };

    let state = AppState::with_stores(sandbox_dir, store, auth_store, auth_required);
    let web_origin = std::env::var("SYMFLOW_WEB_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:5173".to_string())
        .parse::<HeaderValue>()
        .context("invalid SYMFLOW_WEB_ORIGIN")?;
    let app = router(state)
        .layer(
            CorsLayer::new()
                .allow_origin(web_origin)
                .allow_credentials(true)
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::DELETE,
                    Method::OPTIONS,
                ])
                .allow_headers([CONTENT_TYPE, COOKIE, AUTHORIZATION]),
        )
        .layer(TraceLayer::new_for_http());

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
