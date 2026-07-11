//! Enum trạng thái run / step (state machine).

use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RunStatus {
    Pending,
    Running,
    Success,
    Failed,
}

impl RunStatus {
    pub fn as_db_str(self) -> &'static str {
        match self {
            RunStatus::Pending => "PENDING",
            RunStatus::Running => "RUNNING",
            RunStatus::Success => "SUCCESS",
            RunStatus::Failed => "FAILED",
        }
    }
    pub fn from_db_str(s: &str) -> Option<Self> {
        match s {
            "PENDING" => Some(RunStatus::Pending),
            "RUNNING" => Some(RunStatus::Running),
            "SUCCESS" => Some(RunStatus::Success),
            "FAILED" => Some(RunStatus::Failed),
            _ => None,
        }
    }
}

impl fmt::Display for RunStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_db_str())
    }
}
