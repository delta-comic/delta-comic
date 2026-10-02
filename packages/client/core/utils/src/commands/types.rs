use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpenPageOptions {
  pub(crate) url: String,
  pub(crate) label: Option<String>,
  pub(crate) title: Option<String>,
  pub(crate) css: Option<String>,
  pub(crate) js: Option<String>,
  pub(crate) callback_name: Option<String>,
  pub(crate) all_frames: Option<bool>,
  pub(crate) visible: Option<bool>,
  pub(crate) width: Option<f64>,
  pub(crate) height: Option<f64>,
  pub(crate) user_agent: Option<String>,
  pub(crate) incognito: Option<bool>,
  pub(crate) devtools: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct OpenedPage {
  pub(crate) label: String,
  pub(crate) url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InjectCodeOptions {
  pub(crate) label: Option<String>,
  pub(crate) css: Option<String>,
  pub(crate) js: Option<String>,
  pub(crate) callback_name: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct StorageEntry {
  pub(crate) key: String,
  pub(crate) value: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AuthCallbackSnapshot {
  #[serde(default)]
  pub(crate) value: Value,
  #[serde(default)]
  pub(crate) href: String,
  #[serde(default)]
  pub(crate) title: String,
  #[serde(default)]
  pub(crate) cookie: String,
  #[serde(default)]
  pub(crate) local_storage: Vec<StorageEntry>,
  #[serde(default)]
  pub(crate) session_storage: Vec<StorageEntry>,
  #[serde(default)]
  pub(crate) collected_at: u64,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebStorageSnapshot {
  #[serde(default)]
  pub(crate) frame_id: String,
  #[serde(default)]
  pub(crate) reason: String,
  #[serde(default)]
  pub(crate) top: bool,
  #[serde(default)]
  pub(crate) href: String,
  #[serde(default)]
  pub(crate) origin: String,
  #[serde(default)]
  pub(crate) title: String,
  #[serde(default)]
  pub(crate) cookie: String,
  #[serde(default)]
  pub(crate) local_storage: Vec<StorageEntry>,
  #[serde(default)]
  pub(crate) session_storage: Vec<StorageEntry>,
  #[serde(default)]
  pub(crate) callback: Option<AuthCallbackSnapshot>,
  #[serde(default)]
  pub(crate) errors: Vec<String>,
  #[serde(default)]
  pub(crate) collected_at: u64,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct InaccessibleFrame {
  pub(crate) index: usize,
  #[serde(default)]
  pub(crate) src: String,
  pub(crate) error: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct IframeCollection {
  #[serde(default)]
  pub(crate) top: WebStorageSnapshot,
  #[serde(default)]
  pub(crate) frames: Vec<WebStorageSnapshot>,
  #[serde(default)]
  pub(crate) inaccessible_frames: Vec<InaccessibleFrame>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebviewCookie {
  pub(crate) name: String,
  pub(crate) value: String,
  #[serde(default)]
  pub(crate) domain: Option<String>,
  #[serde(default)]
  pub(crate) path: Option<String>,
  #[serde(default)]
  pub(crate) secure: Option<bool>,
  #[serde(default)]
  pub(crate) http_only: Option<bool>,
  #[serde(default)]
  pub(crate) same_site: Option<String>,
  #[serde(default)]
  pub(crate) expires: Option<String>,
  #[serde(default)]
  pub(crate) source: String,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct WebviewAuthData {
  pub(crate) label: String,
  pub(crate) url: String,
  #[serde(default)]
  pub(crate) cookies: Vec<WebviewCookie>,
  #[serde(default)]
  pub(crate) storage: WebStorageSnapshot,
  #[serde(default)]
  pub(crate) frames: Vec<WebStorageSnapshot>,
  #[serde(default)]
  pub(crate) inaccessible_frames: Vec<InaccessibleFrame>,
}
