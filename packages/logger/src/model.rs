use std::path::Path;

use chrono::{DateTime, Local, Utc};
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
  Trace,
  Debug,
  Info,
  Warn,
  Error,
}

impl LogLevel {
  pub(crate) const fn as_str(self) -> &'static str {
    match self {
      Self::Trace => "trace",
      Self::Debug => "debug",
      Self::Info => "info",
      Self::Warn => "warn",
      Self::Error => "error",
    }
  }

  pub(crate) const fn enabled_in_build(self) -> bool {
    if cfg!(debug_assertions) {
      true
    } else {
      matches!(self, Self::Info | Self::Warn | Self::Error)
    }
  }
}

impl From<&tracing::Level> for LogLevel {
  fn from(value: &tracing::Level) -> Self {
    match *value {
      tracing::Level::TRACE => Self::Trace,
      tracing::Level::DEBUG => Self::Debug,
      tracing::Level::INFO => Self::Info,
      tracing::Level::WARN => Self::Warn,
      tracing::Level::ERROR => Self::Error,
    }
  }
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrontendLogEntry {
  pub timestamp: String,
  pub scope: String,
  pub level: LogLevel,
  pub content: String,
}

#[derive(Clone, Debug)]
pub(crate) struct LogRecord {
  pub timestamp: DateTime<Local>,
  pub scope: String,
  pub level: LogLevel,
  pub content: String,
}

impl LogRecord {
  pub(crate) fn new(scope: impl Into<String>, level: LogLevel, content: impl Into<String>) -> Self {
    Self {
      timestamp: Local::now(),
      scope: scope.into(),
      level,
      content: content.into(),
    }
  }

  pub(crate) fn from_frontend(entry: FrontendLogEntry) -> Self {
    let timestamp = DateTime::parse_from_rfc3339(&entry.timestamp)
      .map(|value| value.with_timezone(&Local))
      .unwrap_or_else(|_| Local::now());
    Self {
      timestamp,
      scope: entry.scope,
      level: entry.level,
      content: entry.content,
    }
  }

  pub(crate) fn format(&self) -> String {
    let scope = sanitize_inline(&self.scope);
    let content = sanitize_inline(&self.content);
    format!(
      "[{}] ({scope}) {} > {content}\n",
      self.timestamp.format("%Y/%m/%d %H:%M:%S"),
      self.level.as_str()
    )
  }
}

fn sanitize_inline(value: &str) -> String {
  value.replace('\r', "\\r").replace('\n', "\\n")
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFileInfo {
  /// Safe relative path accepted by `read_log_file` and `export_logs`.
  pub path: String,
  pub name: String,
  pub size: u64,
  pub modified_at: DateTime<Utc>,
  pub archived: bool,
}

impl LogFileInfo {
  pub(crate) fn from_parts(path: &Path, size: u64, modified_at: DateTime<Utc>) -> Option<Self> {
    let name = path.file_name()?.to_str()?.to_owned();
    Some(Self {
      path: name.clone(),
      archived: name.ends_with(".log.gz"),
      name,
      size,
      modified_at,
    })
  }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogFileContent {
  pub path: String,
  pub content: String,
  /// Uncompressed byte size.
  pub size: u64,
  pub truncated: bool,
}

#[cfg(test)]
mod tests {
  use chrono::{Local, TimeZone};

  use super::{LogLevel, LogRecord};

  #[test]
  fn formats_the_public_line_contract_exactly() {
    let record = LogRecord {
      timestamp: Local.with_ymd_and_hms(2026, 7, 22, 9, 8, 7).unwrap(),
      scope: "reader".into(),
      level: LogLevel::Warn,
      content: "cache miss".into(),
    };
    assert_eq!(
      record.format(),
      "[2026/07/22 09:08:07] (reader) warn > cache miss\n"
    );
  }

  #[test]
  fn keeps_each_record_on_one_physical_line() {
    let record = LogRecord::new("ui\nworker", LogLevel::Error, "first\r\nsecond");
    let formatted = record.format();
    assert_eq!(formatted.lines().count(), 1);
    assert!(formatted.contains("ui\\nworker"));
    assert!(formatted.contains("first\\r\\nsecond"));
  }
}
