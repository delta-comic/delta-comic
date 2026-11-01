use chrono::{Local, TimeZone};

use super::{LogLevel, LogRecord};

#[test]
fn formats_the_file_line_contract_exactly() {
  let record = LogRecord {
    timestamp: Local.with_ymd_and_hms(2026, 7, 22, 9, 8, 7).unwrap(),
    scope: "reader".into(),
    level: LogLevel::Warn,
    content: "cache miss".into(),
  };
  assert_eq!(
    record.format_for_file(),
    "[2026/07/22 09:08:07] (reader) warn > cache miss\n"
  );
}

#[test]
fn keeps_each_record_on_one_physical_line() {
  let record = LogRecord::new("ui\nworker", LogLevel::Error, "first\r\nsecond");
  let formatted = record.format_for_file();
  assert_eq!(formatted.lines().count(), 1);
  assert!(formatted.contains("ui\\nworker"));
  assert!(formatted.contains("first\\r\\nsecond"));
}
