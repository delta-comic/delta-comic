use super::sanitize_relative_path;

#[test]
fn rejects_path_traversal_and_absolute_paths() {
  assert!(sanitize_relative_path("../secret").is_err());
  assert!(sanitize_relative_path("/tmp/file").is_err());
  assert!(sanitize_relative_path("chapter/../../secret").is_err());
}
