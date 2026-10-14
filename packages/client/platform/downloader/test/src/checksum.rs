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
