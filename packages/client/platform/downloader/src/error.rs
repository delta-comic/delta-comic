use serde::Serialize;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
  #[error("download task was not found: {0}")]
  NotFound(String),
  #[error("invalid downloader input: {0}")]
  InvalidInput(String),
  #[error("download source requires refreshed authorization")]
  SourceExpired,
  #[error("the server ignored or rejected the requested byte range")]
  RangeRejected,
  #[error("the remote file changed while it was being downloaded")]
  RemoteChanged,
  #[error("checksum mismatch: expected {expected}, got {actual}")]
  ChecksumMismatch { expected: String, actual: String },
  #[error("download was cancelled")]
  Cancelled,
  #[error("BitTorrent support is not enabled in this build")]
  BitTorrentUnavailable,
  #[error("server returned retryable HTTP status {status}")]
  RetryableHttp {
    status: u16,
    retry_after_millis: Option<u64>,
  },
  #[error("database error: {0}")]
  Database(#[from] sqlx::Error),
  #[error("network request failed: {0}")]
  Network(&'static str),
  #[error("filesystem error: {0}")]
  Io(#[from] std::io::Error),
  #[error("invalid URL: {0}")]
  Url(#[from] url::ParseError),
  #[error("serialization error: {0}")]
  Json(#[from] serde_json::Error),
  #[error("BitTorrent error: {0}")]
  BitTorrent(String),
  #[error("Android destination export failed: {0}")]
  DestinationExport(String),
  #[error("credential store error: {0}")]
  CredentialStore(String),
}

impl Error {
  pub(crate) fn code(&self) -> &'static str {
    match self {
      Self::NotFound(_) => "notFound",
      Self::InvalidInput(_) => "invalidInput",
      Self::SourceExpired => "sourceExpired",
      Self::RangeRejected => "rangeRejected",
      Self::RemoteChanged => "remoteChanged",
      Self::ChecksumMismatch { .. } => "checksumMismatch",
      Self::Cancelled => "cancelled",
      Self::BitTorrentUnavailable => "bitTorrentUnavailable",
      Self::RetryableHttp { .. } => "retryableHttp",
      Self::Database(_) => "database",
      Self::Network(_) => "network",
      Self::Io(_) => "filesystem",
      Self::Url(_) => "invalidUrl",
      Self::Json(_) => "serialization",
      Self::BitTorrent(_) => "bitTorrent",
      Self::DestinationExport(_) => "destinationExport",
      Self::CredentialStore(_) => "credentialStore",
    }
  }

  pub(crate) fn is_transient(&self) -> bool {
    matches!(self, Self::Network(_) | Self::RetryableHttp { .. })
  }

  pub(crate) fn is_connectivity_loss(&self) -> bool {
    matches!(self, Self::Network("connection failed"))
  }

  pub(crate) fn retry_after(&self) -> std::time::Duration {
    match self {
      Self::RetryableHttp {
        retry_after_millis: Some(millis),
        ..
      } => std::time::Duration::from_millis(*millis),
      _ => std::time::Duration::ZERO,
    }
  }
}

impl From<reqwest::Error> for Error {
  fn from(error: reqwest::Error) -> Self {
    let category = if error.is_connect() {
      "connection failed"
    } else if error.is_timeout() {
      "request timed out"
    } else if error.is_body() {
      "response body failed"
    } else if error.is_decode() {
      "response decoding failed"
    } else {
      "transport failed"
    };
    Self::Network(category)
  }
}

impl Serialize for Error {
  fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}
