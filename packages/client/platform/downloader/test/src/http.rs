use std::{
  collections::BTreeMap,
  time::{Duration, UNIX_EPOCH},
};

use super::{
  MINIMUM_REBALANCE_REMAINING, MINIMUM_WORKER_AGE, ParsedContentRange, RangeLedger,
  WorkerTelemetry, build_headers, choose_slow_tail, overlapping_worker_to_cancel,
  parse_content_range, parse_retry_after,
};
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
fn parses_retry_after_delta_seconds_and_http_dates() {
  assert_eq!(parse_retry_after("17", UNIX_EPOCH), Some(17_000));
  assert_eq!(
    parse_retry_after(
      "Thu, 01 Jan 1970 00:01:00 GMT",
      UNIX_EPOCH + Duration::from_secs(15),
    ),
    Some(45_000),
  );
  assert_eq!(
    parse_retry_after(
      "Thu, 01 Jan 1970 00:00:10 GMT",
      UNIX_EPOCH + Duration::from_secs(15),
    ),
    None,
  );
  assert_eq!(parse_retry_after("not-a-delay", UNIX_EPOCH), None);
  assert_eq!(parse_retry_after("18446744073709551615", UNIX_EPOCH), None);
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
  assert_eq!(ledger.completed_bytes(), 25);
}

#[test]
fn slow_tail_requires_age_size_and_a_free_split_point() {
  let young = WorkerTelemetry {
    id: 1,
    cursor: 0,
    end: MINIMUM_REBALANCE_REMAINING * 2,
    transferred: 1,
    age: MINIMUM_WORKER_AGE - Duration::from_millis(1),
  };
  assert_eq!(choose_slow_tail(&[young]), None);

  let eligible = WorkerTelemetry {
    age: MINIMUM_WORKER_AGE,
    ..young
  };
  let plan = choose_slow_tail(&[eligible]).expect("eligible tail should split");
  assert_eq!(plan.worker_id, 1);
  assert_eq!(plan.first.end, plan.second.start);
  assert_eq!(plan.second.end, eligible.end);
}

#[test]
fn cancels_the_less_productive_overlapping_worker() {
  let workers = [
    WorkerTelemetry {
      id: 1,
      cursor: 10,
      end: 30,
      transferred: 5,
      age: Duration::from_secs(3),
    },
    WorkerTelemetry {
      id: 2,
      cursor: 20,
      end: 40,
      transferred: 10,
      age: Duration::from_secs(3),
    },
  ];
  assert_eq!(overlapping_worker_to_cancel(&workers), Some(1));
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

#[test]
fn non_sensitive_literal_headers_remain_supported() {
  let headers = BTreeMap::from([(
    "User-Agent".into(),
    HttpHeaderValue::Value {
      value: "delta-comic-test".into(),
    },
  )]);

  let built = build_headers(&headers, None).unwrap();
  assert_eq!(built.get("user-agent").unwrap(), "delta-comic-test");
}
