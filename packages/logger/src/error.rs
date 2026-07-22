use serde::Serialize;
use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
  #[error("logger I/O failed: {0}")]
  Io(#[from] std::io::Error),
  #[error("invalid log path: {0}")]
  InvalidPath(String),
  #[error("log worker is unavailable")]
  WorkerUnavailable,
  #[error("log export failed: {0}")]
  Export(String),
  #[error("logger initialization failed: {0}")]
  Initialization(String),
}

impl Serialize for Error {
  fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
  where
    S: serde::Serializer,
  {
    serializer.serialize_str(&self.to_string())
  }
}
