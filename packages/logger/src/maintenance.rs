use std::{
  fs::File as StdFile,
  io,
  path::{Path, PathBuf},
  time::Duration,
};

use chrono::{Local, NaiveDate};
use flate2::{Compression, write::GzEncoder};
use tokio::{fs, task, time};

use crate::error::{Error, Result};

const ARCHIVE_AFTER_DAYS: i64 = 30;
const DELETE_AFTER_DAYS: i64 = 90;
const MAINTENANCE_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

#[derive(Clone)]
pub(crate) struct LogMaintenance {
  directory: PathBuf,
}

impl LogMaintenance {
  pub(crate) fn new(directory: PathBuf) -> Self {
    Self { directory }
  }

  pub(crate) fn start(self) {
    tauri::async_runtime::spawn(async move {
      self.report_run().await;
      let start = time::Instant::now() + MAINTENANCE_INTERVAL;
      let mut interval = time::interval_at(start, MAINTENANCE_INTERVAL);
      interval.set_missed_tick_behavior(time::MissedTickBehavior::Delay);
      loop {
        interval.tick().await;
        self.report_run().await;
      }
    });
  }

  async fn report_run(&self) {
    if let Err(error) = self.run_once(Local::now().date_naive()).await {
      eprintln!("logger maintenance failed: {error}");
    }
  }

  pub(crate) async fn run_once(&self, today: NaiveDate) -> Result<()> {
    fs::create_dir_all(&self.directory).await?;
    let mut entries = fs::read_dir(&self.directory).await?;
    while let Some(entry) = entries.next_entry().await? {
      let path = entry.path();
      let Some(file) = ManagedFile::parse(&path) else {
        continue;
      };
      let age = today.signed_duration_since(file.day).num_days();
      if age >= DELETE_AFTER_DAYS {
        fs::remove_file(&path).await?;
      } else if age >= ARCHIVE_AFTER_DAYS && !file.archived {
        Self::archive(path).await?;
      }
    }
    Ok(())
  }

  async fn archive(source: PathBuf) -> Result<()> {
    task::spawn_blocking(move || compress_atomically(&source))
      .await
      .map_err(|error| Error::Initialization(format!("archive task failed: {error}")))??;
    Ok(())
  }
}

struct ManagedFile {
  day: NaiveDate,
  archived: bool,
}

impl ManagedFile {
  fn parse(path: &Path) -> Option<Self> {
    let name = path.file_name()?.to_str()?;
    let archived = name.ends_with(".log.gz");
    if !archived && !name.ends_with(".log") {
      return None;
    }
    let date = name.strip_prefix("delta-comic-")?.get(..10)?;
    Some(Self {
      day: NaiveDate::parse_from_str(date, "%Y-%m-%d").ok()?,
      archived,
    })
  }
}

fn compress_atomically(source: &Path) -> io::Result<()> {
  let archive = PathBuf::from(format!("{}.gz", source.display()));
  if archive.exists() {
    std::fs::remove_file(source)?;
    return Ok(());
  }
  let temporary = PathBuf::from(format!("{}.tmp", archive.display()));
  let result = (|| {
    let mut input = StdFile::open(source)?;
    let output = StdFile::create(&temporary)?;
    let mut encoder = GzEncoder::new(output, Compression::default());
    io::copy(&mut input, &mut encoder)?;
    let output = encoder.finish()?;
    output.sync_all()?;
    std::fs::rename(&temporary, &archive)?;
    std::fs::remove_file(source)
  })();
  if result.is_err() {
    let _ = std::fs::remove_file(temporary);
  }
  result
}

#[cfg(test)]
mod tests {
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
}
