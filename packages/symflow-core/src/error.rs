//! Kiểu lỗi theo domain (thiserror).

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CompileError {
    #[error("parse DSL thất bại: {0}")]
    Parse(String),
    #[error("step '{step}': loại không hỗ trợ '{kind}'")]
    UnknownStepType { step: String, kind: String },
    #[error("step '{step}': {msg}")]
    InvalidStep { step: String, msg: String },
    #[error("step id trùng lặp: '{0}'")]
    DuplicateId(String),
    #[error("dependency không tồn tại: '{0}'")]
    UnknownDependency(String),
    #[error("phát hiện chu trình tại node '{0}'")]
    Cycle(String),
}

#[derive(Debug, Error)]
pub enum ResolveError {
    #[error("step '{0}' chưa có output")]
    MissingStep(String),
    #[error("step '{0}' không có field '{1}' trong output")]
    MissingField(String, String),
    #[error("lỗi store: {0}")]
    Store(#[from] StoreError),
}

#[derive(Debug, Error)]
pub enum NodeError {
    #[error("web scraper lỗi: {0}")]
    Scraper(String),
    #[error("đọc file lỗi: {0}")]
    FileReader(String),
    #[error("sandbox lỗi: {0}")]
    Sandbox(#[from] SandboxError),
}

#[derive(Debug, Error)]
pub enum AgentError {
    #[error("vượt quá max_iterations ({0})")]
    MaxIterations(u32),
    #[error("LLM API lỗi: {0}")]
    Llm(String),
    #[error("parse phản hồi LLM thất bại: {0}")]
    Parse(String),
    #[error("store lỗi: {0}")]
    Store(#[from] StoreError),
}

#[derive(Debug, Error)]
pub enum ToolError {
    #[error("tool '{0}' không tồn tại")]
    Unknown(String),
    #[error("tham số không hợp lệ: {0}")]
    InvalidArgs(String),
    #[error("sandbox lỗi: {0}")]
    Sandbox(#[from] SandboxError),
    #[error("I/O lỗi: {0}")]
    Io(String),
}

#[derive(Debug, Error)]
pub enum SandboxError {
    #[error("path traversal bị từ chối: '{0}'")]
    Traversal(String),
    #[error("I/O lỗi sandbox: {0}")]
    Io(#[from] std::io::Error),
}

#[derive(Debug, Error)]
pub enum StoreError {
    #[error("lỗi backend CSDL: {0}")]
    Backend(String),
    #[error("bản ghi không tìm thấy: {0}")]
    NotFound(String),
}

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("lỗi biên dịch: {0}")]
    Compile(#[from] CompileError),
    #[error("lỗi store: {0}")]
    Store(#[from] StoreError),
    #[error("lỗi resolve: {0}")]
    Resolve(#[from] ResolveError),
}
