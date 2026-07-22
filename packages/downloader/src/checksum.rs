use std::{fs::File, path::Path};

use md5::Md5;
use sha2::{Digest, Sha256};
use tokio::io::AsyncReadExt;

use crate::{
  domain::{Checksum, ChecksumAlgorithm},
  error::{Error, Result},
};

pub async fn verify(path: &Path, checksum: &Checksum) -> Result<()> {
  let actual = digest(path, checksum.algorithm).await?;
  verify_digest(actual, checksum)
}

pub async fn verify_file(file: &File, checksum: &Checksum) -> Result<()> {
  let file = file.try_clone()?;
  let algorithm = checksum.algorithm;
  let actual = tokio::task::spawn_blocking(move || digest_file(&file, algorithm))
    .await
    .map_err(|error| Error::InvalidInput(format!("checksum worker failed: {error}")))??;
  verify_digest(actual, checksum)
}

fn verify_digest(actual: String, checksum: &Checksum) -> Result<()> {
  let expected = checksum.value.trim().to_ascii_lowercase();
  if actual == expected {
    Ok(())
  } else {
    Err(Error::ChecksumMismatch { expected, actual })
  }
}

fn digest_file(file: &File, algorithm: ChecksumAlgorithm) -> Result<String> {
  let length = file.metadata()?.len();
  let mut buffer = vec![0_u8; 256 * 1024];
  let mut offset = 0_u64;
  match algorithm {
    ChecksumAlgorithm::Sha256 => {
      let mut digest = Sha256::new();
      while offset < length {
        let read = read_at(file, &mut buffer, offset)?;
        if read == 0 {
          return Err(std::io::Error::from(std::io::ErrorKind::UnexpectedEof).into());
        }
        digest.update(&buffer[..read]);
        offset += read as u64;
      }
      Ok(hex::encode(digest.finalize()))
    }
    ChecksumAlgorithm::Md5 => {
      let mut digest = Md5::new();
      while offset < length {
        let read = read_at(file, &mut buffer, offset)?;
        if read == 0 {
          return Err(std::io::Error::from(std::io::ErrorKind::UnexpectedEof).into());
        }
        digest.update(&buffer[..read]);
        offset += read as u64;
      }
      Ok(hex::encode(digest.finalize()))
    }
  }
}

#[cfg(unix)]
fn read_at(file: &File, buffer: &mut [u8], offset: u64) -> std::io::Result<usize> {
  use std::os::unix::fs::FileExt;
  file.read_at(buffer, offset)
}

#[cfg(windows)]
fn read_at(file: &File, buffer: &mut [u8], offset: u64) -> std::io::Result<usize> {
  use std::os::windows::fs::FileExt;
  file.seek_read(buffer, offset)
}

#[cfg(not(any(unix, windows)))]
fn read_at(file: &File, buffer: &mut [u8], offset: u64) -> std::io::Result<usize> {
  use std::io::{Read, Seek, SeekFrom};
  let mut file = file.try_clone()?;
  file.seek(SeekFrom::Start(offset))?;
  file.read(buffer)
}

pub async fn digest(path: &Path, algorithm: ChecksumAlgorithm) -> Result<String> {
  let mut file = tokio::fs::File::open(path).await?;
  let mut buffer = vec![0_u8; 256 * 1024];
  match algorithm {
    ChecksumAlgorithm::Sha256 => {
      let mut digest = Sha256::new();
      loop {
        let read = file.read(&mut buffer).await?;
        if read == 0 {
          break;
        }
        digest.update(&buffer[..read]);
      }
      Ok(hex::encode(digest.finalize()))
    }
    ChecksumAlgorithm::Md5 => {
      let mut digest = Md5::new();
      loop {
        let read = file.read(&mut buffer).await?;
        if read == 0 {
          break;
        }
        digest.update(&buffer[..read]);
      }
      Ok(hex::encode(digest.finalize()))
    }
  }
}

#[cfg(test)]
mod tests {
  use crate::domain::{Checksum, ChecksumAlgorithm};

  #[tokio::test]
  async fn verifies_sha256_and_md5() {
    let directory = tempfile::tempdir().unwrap();
    let path = directory.path().join("payload");
    tokio::fs::write(&path, b"delta-comic").await.unwrap();
    super::verify(
      &path,
      &Checksum {
        algorithm: ChecksumAlgorithm::Sha256,
        value: "248cfe135ab6f033b49c15aa52ec58b60d2d19e260c9e09dca978e08ef6a3120".into(),
      },
    )
    .await
    .unwrap();

    let file = std::fs::File::open(&path).unwrap();
    super::verify_file(
      &file,
      &Checksum {
        algorithm: ChecksumAlgorithm::Sha256,
        value: "248cfe135ab6f033b49c15aa52ec58b60d2d19e260c9e09dca978e08ef6a3120".into(),
      },
    )
    .await
    .unwrap();
    super::verify(
      &path,
      &Checksum {
        algorithm: ChecksumAlgorithm::Md5,
        value: "e9f142c346d6ae51a298c8714b40a04f".into(),
      },
    )
    .await
    .unwrap();
  }
}
