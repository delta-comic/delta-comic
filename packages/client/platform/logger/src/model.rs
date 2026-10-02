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

  pub(crate) const fn meets_minimum_level(self) -> bool {
    matches!(self, Self::Info | Self::Warn | Self::Error)
  }

  const fn ansi_color(self) -> &'static str {
    match self {
      Self::Trace => "\x1b[90m",
      Self::Debug => "\x1b[36m",
      Self::Info => "\x1b[32m",
      Self::Warn => "\x1b[33m",
      Self::Error => "\x1b[31m",
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

  pub(crate) fn format_for_file(&self) -> String {
    let scope = sanitize_inline(&self.scope);
    let content = sanitize_inline(&self.content);
    self.format_with(&scope, &content)
  }

  pub(crate) fn format_for_console(&self, color: bool) -> String {
    let scope = sanitize_inline(&self.scope);
    if !color {
      return self.format_with(&scope, &self.content);
    }
    format!(
      "[{}] ({scope}) {}{}\x1b[0m > {}\n",
      self.timestamp.format("%Y/%m/%d %H:%M:%S"),
      self.level.ansi_color(),
      self.level.as_str(),
      self.content
    )
  }

  fn format_with(&self, scope: &str, content: &str) -> String {
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
#[path = "../test/src/model.rs"]
mod tests;
