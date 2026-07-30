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
#[path = "../test/src/mobile_contract.rs"]
mod tests;
