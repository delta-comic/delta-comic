use std::path::Path;

use super::*;

#[test]
fn serializes_the_kotlin_schedule_request_contract() {
  let request = AndroidScheduleRequest {
    task_id: "task-1".into(),
    estimated_bytes: Some(42),
    allow_metered: false,
  };

  assert_eq!(
    serde_json::to_value(request).unwrap(),
    serde_json::json!({
      "taskId": "task-1",
      "estimatedBytes": 42,
      "allowMetered": false,
    })
  );
}

#[test]
fn deserializes_all_kotlin_notification_permission_results() {
  let cases = [
    ("granted", AndroidNotificationPermission::Granted),
    ("denied", AndroidNotificationPermission::Denied),
    ("notRequired", AndroidNotificationPermission::NotRequired),
  ];

  for (wire_value, expected) in cases {
    let response: AndroidScheduleResponse = serde_json::from_value(serde_json::json!({
      "notificationPermission": wire_value,
    }))
    .unwrap();
    assert_eq!(response.notification_permission, expected);
  }
}

#[test]
fn rejects_unknown_permission_results_instead_of_hiding_contract_drift() {
  let result = serde_json::from_value::<AndroidScheduleResponse>(serde_json::json!({
    "notificationPermission": "prompt",
  }));
  assert!(result.is_err());
}

#[test]
fn serializes_versioned_absolute_headless_engine_configuration() {
  let config = AndroidEngineConfig::new(
    Path::new("/data/user/0/org.delta/files/downloader.sqlite"),
    Path::new("/data/user/0/org.delta/files/downloads"),
  )
  .unwrap();
  assert_eq!(
    serde_json::to_value(config).unwrap(),
    serde_json::json!({
      "version": ANDROID_ENGINE_CONFIG_VERSION,
      "databasePath": "/data/user/0/org.delta/files/downloader.sqlite",
      "downloadDir": "/data/user/0/org.delta/files/downloads",
    })
  );
  assert!(AndroidEngineConfig::new(Path::new("relative.sqlite"), Path::new("/absolute")).is_err());
}
