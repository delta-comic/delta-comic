use super::parse_cookie_header;

#[test]
fn parse_cookie_header_splits_name_value_pairs() {
  let cookies = parse_cookie_header(
    "session=abc; theme=dark; token=a=b=c",
    Some("example.com".to_string()),
    Some("/login".to_string()),
    "test",
  );

  assert_eq!(cookies.len(), 3);
  assert_eq!(cookies[0].name, "session");
  assert_eq!(cookies[0].value, "abc");
  assert_eq!(cookies[1].name, "theme");
  assert_eq!(cookies[1].value, "dark");
  assert_eq!(cookies[2].name, "token");
  assert_eq!(cookies[2].value, "a=b=c");
  assert_eq!(cookies[2].domain.as_deref(), Some("example.com"));
  assert_eq!(cookies[2].path.as_deref(), Some("/login"));
}

#[test]
fn parse_cookie_header_ignores_invalid_parts() {
  let cookies = parse_cookie_header("=empty; valid=yes; no_value", None, None, "test");

  assert_eq!(cookies.len(), 1);
  assert_eq!(cookies[0].name, "valid");
}
