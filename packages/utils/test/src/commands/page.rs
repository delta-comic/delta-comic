use super::parse_webview_url;

#[test]
fn parse_webview_url_rejects_invalid_absolute_urls() {
  assert!(parse_webview_url("https://").is_err());
}
