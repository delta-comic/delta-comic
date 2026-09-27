use super::{has_url_scheme, parse_webview_url};

#[test]
fn has_url_scheme_detects_absolute_urls() {
  assert!(has_url_scheme("https://example.com"));
  assert!(has_url_scheme("tauri://localhost/index.html"));
  assert!(!has_url_scheme("/index.html"));
  assert!(!has_url_scheme("index.html"));
}

#[test]
fn parse_webview_url_accepts_app_and_external_urls() {
  assert!(parse_webview_url("https://example.com/login").is_ok());
  assert!(parse_webview_url("/login").is_ok());
}

#[test]
fn parse_webview_url_rejects_invalid_absolute_urls() {
  assert!(parse_webview_url("https://").is_err());
}
