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
