use serde_json::json;

use super::parse_eval_value;

#[test]
fn parse_eval_value_unwraps_nested_json_strings() {
  assert_eq!(
    parse_eval_value(r#""{\"href\":\"https://example.com\"}""#)
      .expect("nested object should parse"),
    json!({ "href": "https://example.com" }),
  );
}
