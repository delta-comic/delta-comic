use std::collections::BTreeMap;

use super::{ParsedContentRange, RangeLedger, build_headers, parse_content_range};
use crate::{domain::HttpHeaderValue, persistence::CompletedRange};

#[test]
fn parses_content_range() {
  assert_eq!(
    parse_content_range("bytes 10-19/100"),
    Some(ParsedContentRange {
      start: 10,
      end: 20,
      total: 100
    }),
  );
  assert_eq!(parse_content_range("bytes */100"), None);
  assert_eq!(parse_content_range("bytes 20-10/100"), None);
}

#[test]
fn ledger_never_claims_overlapping_writes() {
  let mut ledger = RangeLedger::new(vec![CompletedRange { start: 0, end: 10 }]);
  let first = ledger.claim(5, 20);
  let second = ledger.claim(15, 25);
  assert_eq!(first, vec![CompletedRange { start: 10, end: 20 }]);
  assert_eq!(second, vec![CompletedRange { start: 20, end: 25 }]);
  ledger.commit(&first);
  ledger.commit(&second);
  assert_eq!(ledger.completed_bytes, 25);
}

#[test]
fn releasing_a_failed_write_keeps_other_claims_and_committed_bytes() {
  let mut ledger = RangeLedger::new(vec![CompletedRange { start: 10, end: 20 }]);
  let failed = ledger.claim(5, 25);
  let other = ledger.claim(0, 30);
  ledger.commit(&other);
  ledger.release(&failed);
  assert_eq!(ledger.completed_bytes, 20);
  let retry = ledger.claim(0, 30);
  assert_eq!(retry, failed);
  ledger.commit(&retry);
  assert_eq!(ledger.completed_bytes, 30);
  assert!(ledger.claim(0, 30).is_empty());
}

#[test]
fn sensitive_headers_require_secret_references() {
  for name in ["Authorization", "Proxy-Authorization", "Cookie"] {
    let headers = BTreeMap::from([(
      name.into(),
      HttpHeaderValue::Value {
        value: "plaintext-secret".into(),
      },
    )]);

    let error = build_headers(&headers, None).unwrap_err();
    assert!(error.to_string().contains("must use a secretRef"));
  }
}
