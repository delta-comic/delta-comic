use std::io::Read;

use chrono::NaiveDate;
use flate2::read::GzDecoder;
use tempfile::tempdir;
use tokio::fs;

use super::LogMaintenance;

#[tokio::test]
async fn archives_month_old_and_deletes_quarter_old_logs() {
  let directory = tempdir().unwrap();
  let archive_source = directory.path().join("delta-comic-2026-06-01-000.log");
  let expired = directory.path().join("delta-comic-2026-03-01-000.log.gz");
  fs::write(&archive_source, b"archivable log").await.unwrap();
  fs::write(&expired, b"expired").await.unwrap();

  LogMaintenance::new(directory.path().to_path_buf())
    .run_once(NaiveDate::from_ymd_opt(2026, 7, 22).unwrap())
    .await
    .unwrap();

  assert!(!archive_source.exists());
  assert!(!expired.exists());
  let archive = directory.path().join("delta-comic-2026-06-01-000.log.gz");
  let mut decoded = String::new();
  GzDecoder::new(std::fs::File::open(archive).unwrap())
    .read_to_string(&mut decoded)
    .unwrap();
  assert_eq!(decoded, "archivable log");
}

#[tokio::test]
async fn ignores_unmanaged_files() {
  let directory = tempdir().unwrap();
  let unrelated = directory.path().join("notes.txt");
  fs::write(&unrelated, b"keep").await.unwrap();
  LogMaintenance::new(directory.path().to_path_buf())
    .run_once(NaiveDate::from_ymd_opt(2026, 7, 22).unwrap())
    .await
    .unwrap();
  assert!(unrelated.exists());
}
