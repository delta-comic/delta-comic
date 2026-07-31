use serde_json::json;

use super::parse_eval_value;

#[test]
fn parse_eval_value_accepts_objects() {
  assert_eq!(
    parse_eval_value(r#"{"href":"https://example.com"}"#).expect("object should parse"),
    json!({ "href": "https://example.com" }),
  );
}

#[test]
fn parse_eval_value_unwraps_nested_json_strings() {
  assert_eq!(
    parse_eval_value(r#""{\"href\":\"https://example.com\"}""#)
      .expect("nested object should parse"),
    json!({ "href": "https://example.com" }),
  );
}

#[test]
fn parse_eval_value_returns_null_for_empty_callbacks() {
  assert_eq!(
    parse_eval_value("").expect("empty callback should parse"),
    serde_json::Value::Null,
  );
}
