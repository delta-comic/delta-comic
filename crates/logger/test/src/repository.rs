use tempfile::tempdir;
use tokio::fs;

use super::{LogRepository, READ_LIMIT};

#[tokio::test]
async fn reads_only_the_bounded_tail() {
  let directory = tempdir().unwrap();
  let name = "delta-comic-2026-07-22-000.log";
  let path = directory.path().join(name);
  let bytes = vec![b'x'; READ_LIMIT + 10];
  fs::write(path, bytes).await.unwrap();
  let repository = LogRepository::new(directory.path().to_path_buf(), vec![]);
  let content = repository.read_tail(name.into()).await.unwrap();
  assert_eq!(content.content.len(), READ_LIMIT);
  assert_eq!(content.size, (READ_LIMIT + 10) as u64);
  assert!(content.truncated);
}

#[tokio::test]
async fn rejects_directory_traversal() {
  let directory = tempdir().unwrap();
  let repository = LogRepository::new(directory.path().to_path_buf(), vec![]);
  assert!(repository.read_tail("../secret.log".into()).await.is_err());
}
