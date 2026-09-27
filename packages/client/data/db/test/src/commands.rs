use std::{
  fs,
  path::{Path, PathBuf},
  time::{SystemTime, UNIX_EPOCH},
};

use super::{
  native_store_get_value, native_store_remove_value, native_store_set_value, store_path,
};

struct TestDir {
  path: PathBuf,
}

impl TestDir {
  fn new() -> Self {
    let timestamp = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .expect("system time should be after unix epoch")
      .as_nanos();
    let path = std::env::temp_dir().join(format!(
      "delta-comic-db-test-{}-{timestamp}",
      std::process::id()
    ));
    fs::create_dir_all(&path).expect("test directory should be created");
    Self { path }
  }

  fn path(&self) -> &Path {
    &self.path
  }
}

impl Drop for TestDir {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.path);
  }
}

#[test]
fn store_path_percent_encodes_path_segments() {
  let root = PathBuf::from("store");

  let path = store_path(&root, "plugin/a.b", "");

  assert_eq!(path, root.join("plugin%2Fa%2Eb").join("_.json"));
}

#[test]
fn native_store_value_round_trips_and_removes_values() {
  let dir = TestDir::new();

  assert_eq!(
    native_store_get_value(dir.path(), "settings", "theme").expect("missing value should read"),
    None,
  );

  native_store_set_value(dir.path(), "settings", "theme", r#"{"mode":"dark"}"#)
    .expect("value should write");

  assert_eq!(
    native_store_get_value(dir.path(), "settings", "theme").expect("value should read"),
    Some(r#"{"mode":"dark"}"#.to_string()),
  );

  native_store_remove_value(dir.path(), "settings", "theme").expect("value should remove");
  native_store_remove_value(dir.path(), "settings", "theme")
    .expect("removing a missing value should be idempotent");

  assert_eq!(
    native_store_get_value(dir.path(), "settings", "theme").expect("removed value should read"),
    None,
  );
}

#[test]
fn native_store_set_value_creates_encoded_namespace_directory() {
  let dir = TestDir::new();

  native_store_set_value(dir.path(), "plugin/a.b", "comic:key", "value")
    .expect("value should write");

  assert_eq!(
    fs::read_to_string(dir.path().join("plugin%2Fa%2Eb").join("comic%3Akey.json"))
      .expect("encoded value path should exist"),
    "value",
  );
}
