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
