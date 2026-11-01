use super::validate_page_label;

#[test]
fn validate_page_label_rejects_unsafe_labels() {
  assert!(validate_page_label("auth-page").is_ok());
  assert!(validate_page_label("").is_err());
  assert!(validate_page_label(" ").is_err());
  assert!(validate_page_label("auth/page").is_err());
  assert!(validate_page_label("auth\\page").is_err());
  assert!(validate_page_label("auth\npage").is_err());
}
