use super::{DownloaderSettings, sanitize_file_name, sanitize_relative_path};

#[test]
fn rejects_path_traversal_and_absolute_paths() {
  assert!(sanitize_relative_path("../secret").is_err());
  assert!(sanitize_relative_path("/tmp/file").is_err());
  assert!(sanitize_relative_path("chapter/../../secret").is_err());
}

#[test]
fn sanitizes_platform_reserved_names() {
  assert_eq!(sanitize_file_name("CON.txt"), "_CON.txt");
  assert_eq!(
    sanitize_relative_path("Comic/a:b?.jpg").unwrap(),
    "Comic/a_b_.jpg"
  );
}

#[test]
fn truncates_long_utf8_file_names_only_at_character_boundaries() {
  let chinese_name = "漫".repeat(100);
  let sanitized = sanitize_file_name(&chinese_name);
  assert_eq!(sanitized, "漫".repeat(80));
  assert_eq!(sanitized.len(), 240);

  let split_boundary = format!("{}漫", "a".repeat(239));
  let sanitized = sanitize_file_name(&split_boundary);
  assert_eq!(sanitized, "a".repeat(239));
  assert!(sanitized.is_char_boundary(sanitized.len()));
}

#[test]
fn validates_concurrency_limits() {
  let mut settings = DownloaderSettings::platform_default();
  settings.max_active_tasks = 21;
  assert!(settings.validate().is_err());
}

#[test]
fn platform_defaults_never_seed_without_user_opt_in() {
  let settings = DownloaderSettings::platform_default();
  assert!(!settings.seed_on_complete);
  assert_eq!(settings.seed_ratio, None);
  assert_eq!(settings.seed_seconds, None);
}
