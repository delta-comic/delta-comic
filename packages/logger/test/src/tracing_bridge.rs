use super::EventVisitor;

#[test]
fn event_visitor_separates_scope_message_and_structured_fields() {
  let visitor = EventVisitor {
    message: Some("download started".into()),
    scope: Some("downloader".into()),
    fields: vec!["task=42".into()],
  };
  assert_eq!(visitor.scope.as_deref(), Some("downloader"));
  assert_eq!(visitor.into_content(), "download started task=42");
}
