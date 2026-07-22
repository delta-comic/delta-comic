use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::domain::{DownloadSource, DownloaderSettings, SeedPolicy};

pub(crate) const ANDROID_ENGINE_CONFIG_VERSION: u32 = 1;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidEngineConfig {
  pub(crate) version: u32,
  pub(crate) database_path: String,
  pub(crate) download_dir: String,
}

impl AndroidEngineConfig {
  pub(crate) fn new(database_path: &Path, download_dir: &Path) -> Result<Self, &'static str> {
    if !database_path.is_absolute() || !download_dir.is_absolute() {
      return Err("Android downloader engine paths must be absolute");
    }
    if database_path == download_dir {
      return Err("Android downloader database and download paths must differ");
    }
    Ok(Self {
      version: ANDROID_ENGINE_CONFIG_VERSION,
      database_path: database_path.to_string_lossy().into_owned(),
      download_dir: download_dir.to_string_lossy().into_owned(),
    })
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidScheduleRequest {
  pub(crate) task_id: String,
  pub(crate) estimated_bytes: Option<u64>,
  pub(crate) allow_metered: bool,
}

#[derive(Debug, Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AndroidNotificationPermission {
  Granted,
  Denied,
  NotRequired,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidScheduleResponse {
  pub(crate) notification_permission: AndroidNotificationPermission,
}

pub(crate) fn android_task_allows_metered_network(
  source: &DownloadSource,
  settings: &DownloaderSettings,
) -> bool {
  settings.allow_metered && !torrent_may_seed(source, settings)
}

fn torrent_may_seed(source: &DownloadSource, settings: &DownloaderSettings) -> bool {
  if !settings.seed_on_complete {
    return false;
  }
  let DownloadSource::Torrent(source) = source else {
    return false;
  };
  match source.seed_policy.as_ref() {
    Some(SeedPolicy::None) => false,
    Some(_) => true,
    None => settings.seed_ratio.is_some() || settings.seed_seconds.is_some(),
  }
}

#[cfg(test)]
mod tests {
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
    assert!(
      AndroidEngineConfig::new(Path::new("relative.sqlite"), Path::new("/absolute")).is_err()
    );
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
}
