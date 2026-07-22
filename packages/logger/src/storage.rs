use std::{
  path::{Path, PathBuf},
  sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
  },
};

use chrono::{Local, NaiveDate};
use tokio::{
  fs::{self, File, OpenOptions},
  io::{AsyncWriteExt, BufWriter},
  sync::{mpsc, oneshot},
};

use crate::{
  error::{Error, Result},
  model::{FrontendLogEntry, LogLevel, LogRecord},
};

const FILE_PREFIX: &str = "delta-comic-";

pub(crate) enum WorkerMessage {
  Write(LogRecord),
  Flush(oneshot::Sender<Result<()>>),
}

#[derive(Clone)]
pub struct LoggerHandle {
  sender: mpsc::Sender<WorkerMessage>,
  dropped: Arc<AtomicU64>,
}

impl LoggerHandle {
  pub(crate) fn new(sender: mpsc::Sender<WorkerMessage>) -> Self {
    Self {
      sender,
      dropped: Arc::new(AtomicU64::new(0)),
    }
  }

  /// Enqueues a native or plugin log without blocking the caller.
  ///
  /// Returns `false` only when the bounded queue is full or the logger has
  /// already shut down. Tracing events use this same path.
  pub fn log(&self, scope: impl Into<String>, level: LogLevel, content: impl Into<String>) -> bool {
    self.try_record(LogRecord::new(scope, level, content))
  }

  pub(crate) fn try_record(&self, record: LogRecord) -> bool {
    if !record.level.enabled_in_build() {
      return true;
    }
    match self.sender.try_send(WorkerMessage::Write(record)) {
      Ok(()) => true,
      Err(_) => {
        self.dropped.fetch_add(1, Ordering::Relaxed);
        false
      }
    }
  }

  pub(crate) async fn write_frontend_batch(&self, entries: Vec<FrontendLogEntry>) -> Result<()> {
    for entry in entries {
      if !entry.level.enabled_in_build() {
        continue;
      }
      self
        .sender
        .send(WorkerMessage::Write(LogRecord::from_frontend(entry)))
        .await
        .map_err(|_| Error::WorkerUnavailable)?;
    }
    self.flush().await
  }

  pub(crate) async fn flush(&self) -> Result<()> {
    let (sender, receiver) = oneshot::channel();
    self
      .sender
      .send(WorkerMessage::Flush(sender))
      .await
      .map_err(|_| Error::WorkerUnavailable)?;
    receiver.await.map_err(|_| Error::WorkerUnavailable)?
  }

  pub fn dropped_records(&self) -> u64 {
    self.dropped.load(Ordering::Relaxed)
  }
}

pub(crate) struct AsyncLogWorker {
  receiver: mpsc::Receiver<WorkerMessage>,
  sink: FileSink,
}

impl AsyncLogWorker {
  pub(crate) fn new(receiver: mpsc::Receiver<WorkerMessage>, sink: FileSink) -> Self {
    Self { receiver, sink }
  }

  pub(crate) async fn run(mut self) {
    while let Some(message) = self.receiver.recv().await {
      match message {
        WorkerMessage::Write(record) => {
          if let Err(error) = self.sink.write(record).await {
            eprintln!("logger file worker failed to write: {error}");
          }
        }
        WorkerMessage::Flush(reply) => {
          let _ = reply.send(self.sink.flush().await);
        }
      }
    }
    let _ = self.sink.flush().await;
  }
}

struct ActiveFile {
  day: NaiveDate,
  size: u64,
  writer: BufWriter<File>,
}

pub(crate) struct FileSink {
  directory: PathBuf,
  max_file_size: u64,
  active: Option<ActiveFile>,
}

impl FileSink {
  pub(crate) async fn new(directory: PathBuf, max_file_size: u64) -> Result<Self> {
    fs::create_dir_all(&directory).await?;
    Ok(Self {
      directory,
      max_file_size,
      active: None,
    })
  }

  async fn write(&mut self, record: LogRecord) -> Result<()> {
    let line = record.format();
    let line_size = line.len() as u64;
    let today = Local::now().date_naive();
    let rotate = self.active.as_ref().is_none_or(|active| {
      active.day != today || active.size.saturating_add(line_size) > self.max_file_size
    });
    if rotate {
      self.rotate(today).await?;
    }

    let active = self.active.as_mut().ok_or(Error::WorkerUnavailable)?;
    active.writer.write_all(line.as_bytes()).await?;
    // Every record is flushed so crash diagnostics are durable immediately.
    active.writer.flush().await?;
    active.size = active.size.saturating_add(line_size);

    let mut console = tokio::io::stdout();
    let _ = console.write_all(line.as_bytes()).await;
    let _ = console.flush().await;
    Ok(())
  }

  async fn flush(&mut self) -> Result<()> {
    if let Some(active) = &mut self.active {
      active.writer.flush().await?;
    }
    Ok(())
  }

  async fn rotate(&mut self, day: NaiveDate) -> Result<()> {
    self.flush().await?;
    let (path, size) = select_chunk(&self.directory, day, self.max_file_size).await?;
    let file = OpenOptions::new()
      .create(true)
      .append(true)
      .open(path)
      .await?;
    self.active = Some(ActiveFile {
      day,
      size,
      writer: BufWriter::new(file),
    });
    Ok(())
  }
}

async fn select_chunk(directory: &Path, day: NaiveDate, max_size: u64) -> Result<(PathBuf, u64)> {
  let date = day.format("%Y-%m-%d").to_string();
  let prefix = format!("{FILE_PREFIX}{date}-");
  let mut highest: Option<(u32, PathBuf, u64)> = None;
  let mut entries = fs::read_dir(directory).await?;
  while let Some(entry) = entries.next_entry().await? {
    let name = entry.file_name();
    let Some(name) = name.to_str() else { continue };
    let Some(index) = chunk_index(name, &prefix) else {
      continue;
    };
    let size = entry.metadata().await?.len();
    if highest.as_ref().is_none_or(|current| index > current.0) {
      highest = Some((index, entry.path(), size));
    }
  }

  if let Some((index, path, size)) = highest {
    if size < max_size {
      return Ok((path, size));
    }
    let next = index.saturating_add(1);
    return Ok((directory.join(format!("{prefix}{next:03}.log")), 0));
  }
  Ok((directory.join(format!("{prefix}000.log")), 0))
}

fn chunk_index(name: &str, prefix: &str) -> Option<u32> {
  name
    .strip_prefix(prefix)?
    .strip_suffix(".log")?
    .parse()
    .ok()
}

#[cfg(test)]
mod tests {
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
}
