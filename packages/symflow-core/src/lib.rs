//! symflow-core — Lõi engine Symflow.
//!
//! Chứa toàn bộ logic độc lập CSDL: parse DSL, biên dịch DAG, phân rã biến,
//! điều phối thực thi, vòng lặp Agent (ReAct), local tools và sandbox.
//! Tầng lưu trữ được trừu tượng hoá qua trait [`store::Store`].

pub mod dsl;       // struct Flow/Step, parse YAML/JSON
pub mod compiler;  // build DAG + toposort (petgraph)
pub mod resolver;  // {{steps.x.y}} -> giá trị thật
pub mod executor;  // scheduler chạy step theo thứ tự topo
pub mod state;     // enum RunStatus/StepStatus
pub mod error;     // kiểu lỗi theo domain
pub mod events;    // RunEvent phát qua broadcast (log ReAct realtime)
pub mod sandbox;   // sanitize path, giới hạn SANDBOX_DIR
pub mod store;     // trait Store (ranh giới với symflow-store)

pub mod nodes;     // nút nội bộ (manual_trigger, web_scraper, local_file_reader)
pub mod agent;     // Agent Runtime (ReAct)
pub mod protocol;  // Agent/Tool Protocol (MCP-aligned)
pub mod agents;    // agent tích hợp sẵn (core, pdf, scraper, chart)
pub mod tools;     // facade trên protocol::Registry
pub mod mem;       // Store in-memory (CLI/test không cần CSDL)
