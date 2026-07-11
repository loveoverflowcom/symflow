//! Shared backend task, storage and sandbox primitives.
//! Workflow compilation and execution now live in the browser TypeScript runtime.

pub mod error; // kiểu lỗi theo domain
pub mod sandbox; // sanitize path, giới hạn SANDBOX_DIR
pub mod state;
pub mod store; // trait Store (ranh giới với symflow-store)

pub mod agent;
pub mod agents; // agent tích hợp sẵn (core, pdf, scraper, chart)
pub mod mem;
pub mod protocol; // Agent/Tool Protocol (MCP-aligned)
pub mod tools; // facade trên protocol::Registry // Store in-memory (CLI/test không cần CSDL)
