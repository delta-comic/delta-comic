use chrono::Local;
use tempfile::tempdir;

use super::FileSink;
use crate::model::{LogLevel, LogRecord};

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
