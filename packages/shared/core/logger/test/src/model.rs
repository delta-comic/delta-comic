use chrono::{Local, TimeZone};

use super::{LogLevel, LogRecord};

#[test]
fn enforces_info_as_the_minimum_level() {
  assert!(!LogLevel::Trace.meets_minimum_level());
  assert!(!LogLevel::Debug.meets_minimum_level());
  assert!(LogLevel::Info.meets_minimum_level());
  assert!(LogLevel::Warn.meets_minimum_level());
  assert!(LogLevel::Error.meets_minimum_level());
}

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

#[test]
fn preserves_content_line_breaks_for_console_output() {
  let record = LogRecord {
    timestamp: Local.with_ymd_and_hms(2026, 7, 22, 9, 8, 7).unwrap(),
    scope: "ui\nworker".into(),
    level: LogLevel::Info,
    content: "first\r\nsecond".into(),
  };
  assert_eq!(
    record.format_for_console(false),
    "[2026/07/22 09:08:07] (ui\\nworker) info > first\r\nsecond\n"
  );
}

#[test]
fn colors_console_levels() {
  let timestamp = Local.with_ymd_and_hms(2026, 7, 22, 9, 8, 7).unwrap();
  let cases = [
    (LogLevel::Trace, "\x1b[90mtrace"),
    (LogLevel::Debug, "\x1b[36mdebug"),
    (LogLevel::Info, "\x1b[32minfo"),
    (LogLevel::Warn, "\x1b[33mwarn"),
    (LogLevel::Error, "\x1b[31merror"),
  ];

  for (level, colored_level) in cases {
    let record = LogRecord {
      timestamp,
      scope: "reader".into(),
      level,
      content: "message".into(),
    };
    assert_eq!(
      record.format_for_console(true),
      format!("[2026/07/22 09:08:07] (reader) {colored_level}\x1b[0m > message\n")
    );
  }
}
