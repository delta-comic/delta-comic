use super::{WebviewRegistry, validate_page_label};

#[test]
fn registry_keeps_labels_sorted_and_removable() {
  let registry = WebviewRegistry::default();
  registry.insert("zeta");
  registry.insert("alpha");
  registry.insert("zeta");

  assert_eq!(
    registry.list(),
    vec!["alpha".to_string(), "zeta".to_string()]
  );

  registry.remove("alpha");

  assert_eq!(registry.list(), vec!["zeta".to_string()]);
}

#[test]
fn generated_labels_are_stable_and_unique() {
  let registry = WebviewRegistry::default();

  assert_eq!(registry.next_label(), "delta-auth-page-0");
  assert_eq!(registry.next_label(), "delta-auth-page-1");
}

#[test]
fn validate_page_label_rejects_unsafe_labels() {
  assert!(validate_page_label("auth-page").is_ok());
  assert!(validate_page_label("").is_err());
  assert!(validate_page_label(" ").is_err());
  assert!(validate_page_label("auth/page").is_err());
  assert!(validate_page_label("auth\\page").is_err());
  assert!(validate_page_label("auth\npage").is_err());
}
