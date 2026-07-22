use std::{
  cmp::Reverse,
  fs::File as StdFile,
  io::{Read, SeekFrom, Write},
  path::{Component, Path, PathBuf},
};

use chrono::{DateTime, Local, Utc};
use flate2::read::GzDecoder;
use tokio::{
  fs,
  io::{AsyncReadExt, AsyncSeekExt},
  task,
};
use zip::{CompressionMethod, ZipWriter, write::SimpleFileOptions};

use crate::{
  error::{Error, Result},
  model::{LogFileContent, LogFileInfo},
};

const READ_LIMIT: usize = 512 * 1024;

#[derive(Clone)]
pub(crate) struct LogRepository {
  directory: PathBuf,
  export_directories: Vec<PathBuf>,
}

impl LogRepository {
  pub(crate) fn new(directory: PathBuf, export_directories: Vec<PathBuf>) -> Self {
    Self {
      directory,
      export_directories,
    }
  }

  pub(crate) async fn list(&self) -> Result<Vec<LogFileInfo>> {
    let mut files = Vec::new();
    let mut entries = fs::read_dir(&self.directory).await?;
    while let Some(entry) = entries.next_entry().await? {
      let path = entry.path();
      let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        continue;
      };
      if !is_managed_name(name) || entry.file_type().await?.is_symlink() {
        continue;
      }
      let metadata = entry.metadata().await?;
      if !metadata.is_file() {
        continue;
      }
      let modified_at: DateTime<Utc> = metadata.modified()?.into();
      if let Some(info) = LogFileInfo::from_parts(&path, metadata.len(), modified_at) {
        files.push(info);
      }
    }
    files.sort_by_key(|file| Reverse(file.modified_at));
    Ok(files)
  }

  pub(crate) async fn read_tail(&self, path: String) -> Result<LogFileContent> {
    let path = self.resolve(&path).await?;
    let archived = path.extension().is_some_and(|value| value == "gz");
    let (bytes, size, truncated) = if archived {
      task::spawn_blocking({
        let path = path.clone();
        move || read_gzip_tail(&path)
      })
      .await
      .map_err(|error| Error::Initialization(format!("log read task failed: {error}")))??
    } else {
      read_plain_tail(&path).await?
    };
    Ok(LogFileContent {
      path: path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_owned(),
      content: String::from_utf8_lossy(&bytes).into_owned(),
      size,
      truncated,
    })
  }

  pub(crate) async fn export(&self, paths: Option<Vec<String>>) -> Result<String> {
    let selected = match paths {
      Some(paths) => paths,
      None => self
        .list()
        .await?
        .into_iter()
        .map(|file| file.path)
        .collect(),
    };
    if selected.is_empty() {
      return Err(Error::Export("no log files were selected".into()));
    }
    let mut sources = Vec::with_capacity(selected.len());
    for path in selected {
      sources.push(self.resolve(&path).await?);
    }

    let archive_name = format!(
      "delta-comic-logs-{}.zip",
      Local::now().format("%Y%m%d-%H%M%S-%3f")
    );
    let mut last_error = None;
    for directory in &self.export_directories {
      if let Err(error) = fs::create_dir_all(directory).await {
        last_error = Some(error.to_string());
        continue;
      }
      let destination = directory.join(&archive_name);
      let result = task::spawn_blocking({
        let destination = destination.clone();
        let sources = sources.clone();
        move || create_zip(&destination, &sources)
      })
      .await
      .map_err(|error| Error::Export(format!("export task failed: {error}")))?;
      match result {
        Ok(()) => return Ok(destination.to_string_lossy().into_owned()),
        Err(error) => last_error = Some(error.to_string()),
      }
    }
    Err(Error::Export(
      last_error.unwrap_or_else(|| "no export directory is available".into()),
    ))
  }

  async fn resolve(&self, requested: &str) -> Result<PathBuf> {
    let relative = Path::new(requested);
    if relative.is_absolute()
      || relative.components().count() != 1
      || !matches!(relative.components().next(), Some(Component::Normal(_)))
      || !is_managed_name(requested)
    {
      return Err(Error::InvalidPath(requested.to_owned()));
    }
    let path = self.directory.join(relative);
    let metadata = fs::symlink_metadata(&path).await?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
      return Err(Error::InvalidPath(requested.to_owned()));
    }
    Ok(path)
  }
}

fn is_managed_name(name: &str) -> bool {
  let Some(rest) = name.strip_prefix("delta-comic-") else {
    return false;
  };
  let suffix_valid = rest.ends_with(".log") || rest.ends_with(".log.gz");
  suffix_valid
    && rest.len() >= 18
    && chrono::NaiveDate::parse_from_str(&rest[..10], "%Y-%m-%d").is_ok()
}

async fn read_plain_tail(path: &Path) -> Result<(Vec<u8>, u64, bool)> {
  let mut file = fs::File::open(path).await?;
  let size = file.metadata().await?.len();
  let start = size.saturating_sub(READ_LIMIT as u64);
  file.seek(SeekFrom::Start(start)).await?;
  let mut bytes = Vec::with_capacity((size - start) as usize);
  file.read_to_end(&mut bytes).await?;
  Ok((bytes, size, start > 0))
}

fn read_gzip_tail(path: &Path) -> Result<(Vec<u8>, u64, bool)> {
  let file = StdFile::open(path)?;
  let mut decoder = GzDecoder::new(file);
  let mut bytes = Vec::new();
  decoder.read_to_end(&mut bytes)?;
  let size = bytes.len() as u64;
  let truncated = bytes.len() > READ_LIMIT;
  if truncated {
    bytes.drain(..bytes.len() - READ_LIMIT);
  }
  Ok((bytes, size, truncated))
}

fn create_zip(destination: &Path, sources: &[PathBuf]) -> Result<()> {
  let file = StdFile::create(destination)?;
  let mut writer = ZipWriter::new(file);
  let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
  for source in sources {
    let name = source
      .file_name()
      .and_then(|value| value.to_str())
      .ok_or_else(|| Error::InvalidPath(source.display().to_string()))?;
    writer
      .start_file(name, options)
      .map_err(|error| Error::Export(error.to_string()))?;
    let mut input = StdFile::open(source)?;
    std::io::copy(&mut input, &mut writer)?;
  }
  let mut file = writer
    .finish()
    .map_err(|error| Error::Export(error.to_string()))?;
  file.flush()?;
  file.sync_all()?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use std::io::Write;

  use flate2::{Compression, write::GzEncoder};
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
  async fn reads_archived_logs_transparently() {
    let directory = tempdir().unwrap();
    let name = "delta-comic-2026-06-01-000.log.gz";
    let file = std::fs::File::create(directory.path().join(name)).unwrap();
    let mut encoder = GzEncoder::new(file, Compression::default());
    encoder.write_all(b"archived line").unwrap();
    encoder.finish().unwrap();
    let repository = LogRepository::new(directory.path().to_path_buf(), vec![]);
    let content = repository.read_tail(name.into()).await.unwrap();
    assert_eq!(content.content, "archived line");
    assert!(!content.truncated);
  }

  #[tokio::test]
  async fn rejects_directory_traversal() {
    let directory = tempdir().unwrap();
    let repository = LogRepository::new(directory.path().to_path_buf(), vec![]);
    assert!(repository.read_tail("../secret.log".into()).await.is_err());
  }
}
