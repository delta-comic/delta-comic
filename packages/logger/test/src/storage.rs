use chrono::{Local, NaiveDate};
use tempfile::tempdir;
use tokio::fs;

use super::{FileSink, select_chunk};
use crate::model::{LogLevel, LogRecord};

#[tokio::test]
async fn appends_to_the_latest_non_full_chunk() {
  let directory = tempdir().unwrap();
  let day = NaiveDate::from_ymd_opt(2026, 7, 22).unwrap();
  let old = directory.path().join("delta-comic-2026-07-22-002.log");
  fs::write(&old, b"hello").await.unwrap();
  let (selected, size) = select_chunk(directory.path(), day, 100).await.unwrap();
  assert_eq!(selected, old);
  assert_eq!(size, 5);
}

#[tokio::test]
async fn rotates_when_the_size_limit_would_be_exceeded() {
  let directory = tempdir().unwrap();
  let today = Local::now().date_naive();
  let mut sink = FileSink::new(directory.path().to_path_buf(), 1)
    .await
    .unwrap();
  sink
    .write(LogRecord::new("test", LogLevel::Info, "one"))
    .await
    .unwrap();
  sink
    .write(LogRecord::new("test", LogLevel::Info, "two"))
    .await
    .unwrap();
  let date = today.format("%Y-%m-%d");
  assert!(
    directory
      .path()
      .join(format!("delta-comic-{date}-000.log"))
      .exists()
  );
  assert!(
    directory
      .path()
      .join(format!("delta-comic-{date}-001.log"))
      .exists()
  );
}
