use std::{collections::BTreeMap, path::Component};

use serde::{Deserialize, Serialize};

use crate::error::{Error, Result};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskKind {
  Http,
  Torrent,
}

impl TaskKind {
  pub(crate) fn as_db(self) -> &'static str {
    match self {
      Self::Http => "http",
      Self::Torrent => "torrent",
    }
  }

  pub(crate) fn from_db(value: &str) -> Result<Self> {
    match value {
      "http" => Ok(Self::Http),
      "torrent" => Ok(Self::Torrent),
      _ => Err(Error::InvalidInput(format!("unknown task kind: {value}"))),
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
  Queued,
  Probing,
  Downloading,
  WaitingForNetwork,
  WaitingForSource,
  Paused,
  Verifying,
  Seeding,
  Completed,
  Failed,
  Cancelled,
}

impl TaskStatus {
  pub(crate) fn as_db(self) -> &'static str {
    match self {
      Self::Queued => "queued",
      Self::Probing => "probing",
      Self::Downloading => "downloading",
      Self::WaitingForNetwork => "waiting_for_network",
      Self::WaitingForSource => "waiting_for_source",
      Self::Paused => "paused",
      Self::Verifying => "verifying",
      Self::Seeding => "seeding",
      Self::Completed => "completed",
      Self::Failed => "failed",
      Self::Cancelled => "cancelled",
    }
  }

  pub(crate) fn from_db(value: &str) -> Result<Self> {
    match value {
      "queued" => Ok(Self::Queued),
      "probing" => Ok(Self::Probing),
      "downloading" => Ok(Self::Downloading),
      "waiting_for_network" => Ok(Self::WaitingForNetwork),
      "waiting_for_source" => Ok(Self::WaitingForSource),
      "paused" => Ok(Self::Paused),
      "verifying" => Ok(Self::Verifying),
      "seeding" => Ok(Self::Seeding),
      "completed" => Ok(Self::Completed),
      "failed" => Ok(Self::Failed),
      "cancelled" => Ok(Self::Cancelled),
      _ => Err(Error::InvalidInput(format!("unknown task status: {value}"))),
    }
  }

  pub fn is_active(self) -> bool {
    matches!(
      self,
      Self::Probing | Self::Downloading | Self::Verifying | Self::Seeding
    )
  }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Checksum {
  pub algorithm: ChecksumAlgorithm,
  pub value: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChecksumAlgorithm {
  Sha256,
  Md5,
}

impl ChecksumAlgorithm {
  pub(crate) fn as_db(self) -> &'static str {
    match self {
      Self::Sha256 => "sha256",
      Self::Md5 => "md5",
    }
  }

  pub(crate) fn from_db(value: &str) -> Result<Self> {
    match value {
      "sha256" => Ok(Self::Sha256),
      "md5" => Ok(Self::Md5),
      _ => Err(Error::InvalidInput(format!(
        "unknown checksum algorithm: {value}"
      ))),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpMirror {
  pub url: String,
  #[serde(default)]
  pub priority: i32,
  #[serde(default)]
  pub headers: BTreeMap<String, HttpHeaderValue>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum HttpHeaderValue {
  Value { value: String },
  SecretRef { secret_ref: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpSource {
  pub mirrors: Vec<HttpMirror>,
  pub expected_size: Option<u64>,
  pub etag: Option<String>,
  pub last_modified: Option<String>,
  pub expires_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum TorrentInput {
  Magnet { uri: String },
  Url { url: String },
  Bytes { base64: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum SeedPolicy {
  None,
  Ratio { ratio: f64 },
  Duration { duration_seconds: u64 },
  RatioOrDuration { ratio: f64, duration_seconds: u64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentSource {
  pub input: TorrentInput,
  #[serde(default)]
  pub only_files: Vec<usize>,
  pub seed_policy: Option<SeedPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DownloadSource {
  Http(HttpSource),
  Torrent(TorrentSource),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTask {
  pub id: String,
  pub collection_key: Option<String>,
  pub asset_key: Option<String>,
  pub kind: TaskKind,
  pub title: String,
  pub source: DownloadSource,
  pub destination_id: String,
  pub relative_path: String,
  pub status: TaskStatus,
  pub priority: u8,
  pub queue_position: i64,
  pub total_bytes: Option<u64>,
  pub downloaded_bytes: u64,
  pub speed_bytes_per_second: u64,
  pub error_code: Option<String>,
  pub error_message: Option<String>,
  pub checksum: Option<Checksum>,
  pub etag: Option<String>,
  pub last_modified: Option<String>,
  pub final_path: Option<String>,
  pub retry_count: u8,
  pub created_at: i64,
  pub updated_at: i64,
  pub revision: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadCollection {
  pub key: String,
  pub title: String,
  pub destination_id: String,
  pub refresh_context: Option<ContentRefreshContext>,
  pub task_count: u64,
  pub completed_tasks: u64,
  pub total_bytes: Option<u64>,
  pub downloaded_bytes: u64,
  pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContentRefreshContext {
  pub plugin: String,
  pub content_type: [String; 2],
  pub content_id: String,
  pub episode_id: String,
  pub content_page_fingerprint: Option<String>,
  pub provider_fingerprint: String,
  pub plugin_version: Option<String>,
  pub plugin_integrity: Option<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ByteRange {
  pub start: u64,
  pub end: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TorrentTaskDetail {
  pub info_hash: Option<String>,
  pub uploaded_bytes: u64,
  pub peer_count: u64,
  pub seed_started_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadTaskDetail {
  pub task: DownloadTask,
  pub completed_ranges: Vec<ByteRange>,
  pub torrent: Option<TorrentTaskDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadAsset {
  pub key: String,
  pub relative_path: String,
  pub size: Option<u64>,
  pub checksum: Option<Checksum>,
  pub source: DownloadSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueuePlanInput {
  pub key: String,
  pub title: String,
  pub assets: Vec<DownloadAsset>,
  pub destination_id: Option<String>,
  pub priority: Option<u8>,
  pub refresh_context: Option<ContentRefreshContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueUrlInput {
  pub url: String,
  pub title: Option<String>,
  pub relative_path: Option<String>,
  pub destination_id: Option<String>,
  pub priority: Option<u8>,
  pub checksum: Option<Checksum>,
  #[serde(default)]
  pub mirrors: Vec<HttpMirror>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnqueueTorrentInput {
  pub source: TorrentSource,
  pub title: Option<String>,
  pub relative_path: Option<String>,
  pub destination_id: Option<String>,
  pub priority: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloaderSettings {
  pub max_active_tasks: u8,
  pub connection_budget: u16,
  pub per_task_connections: u8,
  pub allow_metered: bool,
  pub seed_on_complete: bool,
  pub seed_ratio: Option<f64>,
  pub seed_seconds: Option<u64>,
  pub revision: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloaderCapabilities {
  pub connection_budget_max: u16,
  pub max_active_tasks: u8,
}

impl DownloaderCapabilities {
  pub fn platform() -> Self {
    Self {
      connection_budget_max: DownloaderSettings::connection_budget_max(),
      max_active_tasks: 20,
    }
  }
}

impl DownloaderSettings {
  pub const fn connection_budget_max() -> u16 {
    if cfg!(target_os = "android") { 24 } else { 64 }
  }

  pub fn platform_default() -> Self {
    #[cfg(target_os = "android")]
    let values = (3, 8, 4);
    #[cfg(not(target_os = "android"))]
    let values = (4, 16, 8);
    Self {
      max_active_tasks: values.0,
      connection_budget: values.1,
      per_task_connections: values.2,
      allow_metered: true,
      seed_on_complete: false,
      seed_ratio: None,
      seed_seconds: None,
      revision: 0,
    }
  }

  pub fn validate(&self) -> Result<()> {
    if !(1..=20).contains(&self.max_active_tasks) {
      return Err(Error::InvalidInput(
        "maxActiveTasks must be between 1 and 20".into(),
      ));
    }
    let connection_max = Self::connection_budget_max();
    if self.connection_budget == 0 || self.connection_budget > connection_max {
      return Err(Error::InvalidInput(format!(
        "connectionBudget must be between 1 and {connection_max}"
      )));
    }
    if self.per_task_connections == 0
      || u16::from(self.per_task_connections) > self.connection_budget
    {
      return Err(Error::InvalidInput(
        "perTaskConnections must be positive and not exceed connectionBudget".into(),
      ));
    }
    if self
      .seed_ratio
      .is_some_and(|ratio| !ratio.is_finite() || ratio <= 0.0)
    {
      return Err(Error::InvalidInput(
        "seedRatio must be a positive finite number".into(),
      ));
    }
    Ok(())
  }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Destination {
  pub id: String,
  pub label: String,
  pub kind: DestinationKind,
  #[serde(skip_serializing)]
  pub path: String,
  pub is_default: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum DestinationKind {
  Managed,
  DesktopDirectory,
  AndroidSaf,
}

impl DestinationKind {
  pub(crate) fn as_db(self) -> &'static str {
    match self {
      Self::Managed => "managed",
      Self::DesktopDirectory => "desktop_directory",
      Self::AndroidSaf => "android_saf",
    }
  }

  pub(crate) fn from_db(value: &str) -> Result<Self> {
    match value {
      "managed" => Ok(Self::Managed),
      "desktop_directory" => Ok(Self::DesktopDirectory),
      "android_saf" => Ok(Self::AndroidSaf),
      _ => Err(Error::InvalidInput(format!(
        "unknown destination kind: {value}"
      ))),
    }
  }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskUpsertEvent {
  pub task: DownloadTask,
  pub revision: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRemovedEvent {
  pub task_id: String,
  pub revision: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AttentionEvent {
  pub task_id: String,
  pub code: String,
  pub message: String,
  pub revision: i64,
}

pub fn validate_priority(priority: u8) -> Result<u8> {
  if (1..=10).contains(&priority) {
    Ok(priority)
  } else {
    Err(Error::InvalidInput(
      "priority must be between 1 and 10".into(),
    ))
  }
}

pub fn sanitize_relative_path(value: &str) -> Result<String> {
  let trimmed = value.trim().replace('\\', "/");
  if trimmed.is_empty() || trimmed.starts_with('/') || trimmed.contains('\0') {
    return Err(Error::InvalidInput(
      "relativePath is empty or absolute".into(),
    ));
  }

  let path = std::path::Path::new(&trimmed);
  let mut clean = Vec::new();
  for component in path.components() {
    match component {
      Component::Normal(segment) => {
        let segment = segment.to_string_lossy();
        let value = sanitize_file_name(&segment);
        if value.is_empty() {
          return Err(Error::InvalidInput(
            "relativePath contains an empty segment".into(),
          ));
        }
        clean.push(value);
      }
      _ => {
        return Err(Error::InvalidInput(
          "relativePath contains traversal".into(),
        ));
      }
    }
  }
  Ok(clean.join("/"))
}

pub fn sanitize_file_name(value: &str) -> String {
  let mut sanitized: String = value
    .chars()
    .map(|character| match character {
      '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
      character if character.is_control() => '_',
      character => character,
    })
    .collect();
  sanitized = sanitized.trim_matches([' ', '.']).to_string();
  let stem = sanitized
    .split('.')
    .next()
    .unwrap_or_default()
    .to_ascii_uppercase();
  if matches!(
    stem.as_str(),
    "CON"
      | "PRN"
      | "AUX"
      | "NUL"
      | "COM1"
      | "COM2"
      | "COM3"
      | "COM4"
      | "COM5"
      | "COM6"
      | "COM7"
      | "COM8"
      | "COM9"
      | "LPT1"
      | "LPT2"
      | "LPT3"
      | "LPT4"
      | "LPT5"
      | "LPT6"
      | "LPT7"
      | "LPT8"
      | "LPT9"
  ) {
    sanitized.insert(0, '_');
  }
  if sanitized.len() > 240 {
    let mut boundary = 240;
    while !sanitized.is_char_boundary(boundary) {
      boundary -= 1;
    }
    sanitized.truncate(boundary);
  }
  sanitized
}

#[cfg(test)]
mod tests {
  use super::{DownloaderSettings, sanitize_file_name, sanitize_relative_path};

  #[test]
  fn rejects_path_traversal_and_absolute_paths() {
    assert!(sanitize_relative_path("../secret").is_err());
    assert!(sanitize_relative_path("/tmp/file").is_err());
    assert!(sanitize_relative_path("chapter/../../secret").is_err());
  }

  #[test]
  fn sanitizes_platform_reserved_names() {
    assert_eq!(sanitize_file_name("CON.txt"), "_CON.txt");
    assert_eq!(
      sanitize_relative_path("Comic/a:b?.jpg").unwrap(),
      "Comic/a_b_.jpg"
    );
  }

  #[test]
  fn truncates_long_utf8_file_names_only_at_character_boundaries() {
    let chinese_name = "漫".repeat(100);
    let sanitized = sanitize_file_name(&chinese_name);
    assert_eq!(sanitized, "漫".repeat(80));
    assert_eq!(sanitized.len(), 240);

    let split_boundary = format!("{}漫", "a".repeat(239));
    let sanitized = sanitize_file_name(&split_boundary);
    assert_eq!(sanitized, "a".repeat(239));
    assert!(sanitized.is_char_boundary(sanitized.len()));
  }

  #[test]
  fn validates_concurrency_limits() {
    let mut settings = DownloaderSettings::platform_default();
    settings.max_active_tasks = 21;
    assert!(settings.validate().is_err());
  }

  #[test]
  fn platform_defaults_never_seed_without_user_opt_in() {
    let settings = DownloaderSettings::platform_default();
    assert!(!settings.seed_on_complete);
    assert_eq!(settings.seed_ratio, None);
    assert_eq!(settings.seed_seconds, None);
  }
}
