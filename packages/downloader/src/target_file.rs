use std::path::Path;

use crate::Result;

/// Atomically commits a completed temporary file without deleting an existing
/// destination first. If replacement fails, the old destination remains
/// reachable and the temporary file is retained for diagnosis or retry.
pub(crate) async fn replace(source: &Path, destination: &Path) -> Result<()> {
  let source = source.to_path_buf();
  let destination = destination.to_path_buf();
  tokio::task::spawn_blocking(move || replace_blocking(&source, &destination))
    .await
    .map_err(join_error)??;
  Ok(())
}

fn join_error(error: tokio::task::JoinError) -> std::io::Error {
  std::io::Error::other(format!("target file replacement worker failed: {error}"))
}

#[cfg(unix)]
fn replace_blocking(source: &Path, destination: &Path) -> std::io::Result<()> {
  std::fs::rename(source, destination)
}

#[cfg(windows)]
fn replace_blocking(source: &Path, destination: &Path) -> std::io::Result<()> {
  use std::os::windows::ffi::OsStrExt;

  use windows_sys::Win32::Storage::FileSystem::{
    MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH, MoveFileExW,
  };

  fn wide(path: &Path) -> Vec<u16> {
    path.as_os_str().encode_wide().chain(Some(0)).collect()
  }

  let source = wide(source);
  let destination = wide(destination);
  // SAFETY: both buffers are valid, NUL-terminated UTF-16 paths and remain
  // alive for the duration of the call.
  let result = unsafe {
    MoveFileExW(
      source.as_ptr(),
      destination.as_ptr(),
      MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
    )
  };
  if result == 0 {
    Err(std::io::Error::last_os_error())
  } else {
    Ok(())
  }
}

#[cfg(not(any(unix, windows)))]
fn replace_blocking(source: &Path, destination: &Path) -> std::io::Result<()> {
  if destination.try_exists()? {
    return Err(std::io::Error::new(
      std::io::ErrorKind::AlreadyExists,
      "atomic target replacement is unavailable on this platform",
    ));
  }
  std::fs::rename(source, destination)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[tokio::test]
  async fn replaces_an_existing_file_without_leaving_the_temporary_file() {
    let root = tempfile::tempdir().unwrap();
    let source = root.path().join("payload.part");
    let destination = root.path().join("payload.bin");
    tokio::fs::write(&source, b"new payload").await.unwrap();
    tokio::fs::write(&destination, b"old payload")
      .await
      .unwrap();

    replace(&source, &destination).await.unwrap();

    assert_eq!(tokio::fs::read(&destination).await.unwrap(), b"new payload");
    assert!(!tokio::fs::try_exists(&source).await.unwrap());
  }

  #[tokio::test]
  async fn leaves_the_existing_destination_when_the_source_is_missing() {
    let root = tempfile::tempdir().unwrap();
    let source = root.path().join("missing.part");
    let destination = root.path().join("payload.bin");
    tokio::fs::write(&destination, b"old payload")
      .await
      .unwrap();

    assert!(replace(&source, &destination).await.is_err());
    assert_eq!(tokio::fs::read(&destination).await.unwrap(), b"old payload");
  }
}
