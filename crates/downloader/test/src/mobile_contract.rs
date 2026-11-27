use std::path::Path;

use super::*;
use crate::domain::{HttpSource, TorrentInput, TorrentSource};

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

#[test]
fn any_torrent_that_can_seed_requires_an_unmetered_android_job() {
  let mut settings = DownloaderSettings::platform_default();
  settings.allow_metered = true;
  let http = DownloadSource::Http(HttpSource {
    mirrors: Vec::new(),
    expected_size: None,
    etag: None,
    last_modified: None,
    expires_at: None,
  });
  let torrent = |seed_policy| {
    DownloadSource::Torrent(TorrentSource {
      input: TorrentInput::Magnet {
        uri: "magnet:?xt=urn:btih:test".into(),
      },
      only_files: Vec::new(),
      seed_policy,
    })
  };

  assert!(android_task_allows_metered_network(&http, &settings));
  assert!(android_task_allows_metered_network(
    &torrent(None),
    &settings
  ));
  settings.seed_on_complete = true;
  settings.seed_ratio = Some(1.0);
  assert!(!android_task_allows_metered_network(
    &torrent(None),
    &settings
  ));
  settings.seed_ratio = None;
  assert!(!android_task_allows_metered_network(
    &torrent(Some(SeedPolicy::Duration {
      duration_seconds: 60,
    })),
    &settings
  ));
  assert!(android_task_allows_metered_network(
    &torrent(Some(SeedPolicy::None)),
    &settings
  ));
  settings.allow_metered = false;
  assert!(!android_task_allows_metered_network(&http, &settings));
}
