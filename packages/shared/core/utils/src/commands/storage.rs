use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime, State, WebviewWindow};

use crate::webview_registry::WebviewRegistry;

use super::{IframeCollection, WebStorageSnapshot, WebviewAuthData, cookies, eval, scripts};

#[tauri::command]
pub(crate) async fn webview_auth_data_current<R: Runtime>(
  app: AppHandle<R>,
  webview: WebviewWindow<R>,
) -> Result<WebviewAuthData, String> {
  collect_auth_data(&app, &webview, false, eval::IFRAME_WAIT).await
}

#[tauri::command]
pub(crate) async fn webview_auth_data<R: Runtime>(
  app: AppHandle<R>,
  label: String,
) -> Result<WebviewAuthData, String> {
  let webview = get_webview_window(&app, &label)?;
  collect_auth_data(&app, &webview, false, eval::IFRAME_WAIT).await
}

#[tauri::command]
pub(crate) async fn webview_iframe_auth_data<R: Runtime>(
  app: AppHandle<R>,
  label: String,
  wait_ms: Option<u64>,
) -> Result<WebviewAuthData, String> {
  let webview = get_webview_window(&app, &label)?;
  let wait = wait_ms
    .map(Duration::from_millis)
    .unwrap_or(eval::IFRAME_WAIT);
  collect_auth_data(&app, &webview, true, wait).await
}

#[tauri::command]
pub(crate) async fn webview_auth_data_all<R: Runtime>(
  app: AppHandle<R>,
  registry: State<'_, WebviewRegistry>,
) -> Result<Vec<WebviewAuthData>, String> {
  let labels = registry.list();
  let mut data = Vec::new();

  for label in labels {
    match app.get_webview_window(&label) {
      Some(webview) => {
        data.push(collect_auth_data(&app, &webview, false, eval::IFRAME_WAIT).await?)
      }
      None => registry.remove(&label),
    }
  }

  Ok(data)
}

pub(crate) async fn collect_auth_data<R: Runtime>(
  app: &AppHandle<R>,
  webview: &WebviewWindow<R>,
  include_iframes: bool,
  iframe_wait: Duration,
) -> Result<WebviewAuthData, String> {
  let url = webview
    .url()
    .map_err(|err| format!("failed to read webview url: {err}"))?
    .to_string();
  let cookies = cookies::collect_webview_cookies(app, webview).await?;

  let (storage, frames, inaccessible_frames) = if include_iframes {
    webview
      .eval(scripts::iframe_request_script())
      .map_err(|err| format!("failed to request iframe snapshots: {err}"))?;
    eval::wait(iframe_wait).await?;
    let collection: IframeCollection =
      eval::eval_json(webview, scripts::iframe_collect_script()).await?;
    (
      collection.top,
      collection.frames,
      collection.inaccessible_frames,
    )
  } else {
    let storage: WebStorageSnapshot =
      eval::eval_json(webview, scripts::top_snapshot_script()).await?;
    (storage, Vec::new(), Vec::new())
  };

  Ok(WebviewAuthData {
    label: webview.label().to_string(),
    url,
    cookies,
    storage,
    frames,
    inaccessible_frames,
  })
}

pub(crate) fn get_webview_window<R: Runtime>(
  app: &AppHandle<R>,
  label: &str,
) -> Result<WebviewWindow<R>, String> {
  app
    .get_webview_window(label)
    .ok_or_else(|| format!("webview page not found: {label}"))
}
