use serde::{Deserialize, Serialize, de::DeserializeOwned};
use tauri::{
  AppHandle, Runtime,
  plugin::{PluginApi, PluginHandle},
};

const PLUGIN_IDENTIFIER: &str = "org.delta_comic.utils";

pub(crate) fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> Result<MobileUtils<R>, Box<dyn std::error::Error>> {
  let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "UtilsPlugin")?;
  Ok(MobileUtils { handle })
}

pub(crate) struct MobileUtils<R: Runtime> {
  handle: PluginHandle<R>,
}

impl<R: Runtime> MobileUtils<R> {
  pub(crate) fn cookie_header(&self, url: String) -> Result<AndroidCookieHeader, String> {
    self
      .handle
      .run_mobile_plugin("getCookieHeader", AndroidCookieRequest { url })
      .map_err(|err| format!("failed to read android webview cookies: {err}"))
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct AndroidCookieRequest {
  url: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidCookieHeader {
  pub(crate) cookie_header: String,
}
