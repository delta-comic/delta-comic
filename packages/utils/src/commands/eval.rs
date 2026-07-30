use std::{
  sync::mpsc::{RecvTimeoutError, channel},
  time::Duration,
};

use serde::de::DeserializeOwned;
use serde_json::Value;
use tauri::{Runtime, WebviewWindow};

pub(crate) const EVAL_TIMEOUT: Duration = Duration::from_secs(5);
pub(crate) const IFRAME_WAIT: Duration = Duration::from_millis(250);

pub(crate) async fn eval_json<R, T>(webview: &WebviewWindow<R>, script: &str) -> Result<T, String>
where
  R: Runtime,
  T: DeserializeOwned,
{
  let raw = eval_raw(webview, script, EVAL_TIMEOUT).await?;
  let value = parse_eval_value(&raw)?;
  serde_json::from_value(value).map_err(|err| format!("failed to decode webview result: {err}"))
}

pub(crate) async fn wait(duration: Duration) -> Result<(), String> {
  tauri::async_runtime::spawn_blocking(move || std::thread::sleep(duration))
    .await
    .map_err(|err| format!("failed to wait for webview frames: {err}"))
}

async fn eval_raw<R>(
  webview: &WebviewWindow<R>,
  script: &str,
  timeout: Duration,
) -> Result<String, String>
where
  R: Runtime,
{
  let (tx, rx) = channel();
  webview
    .eval_with_callback(script.to_string(), move |value| {
      let _ = tx.send(value);
    })
    .map_err(|err| format!("failed to evaluate webview script: {err}"))?;

  tauri::async_runtime::spawn_blocking(move || rx.recv_timeout(timeout))
    .await
    .map_err(|err| format!("failed to join webview eval wait: {err}"))?
    .map_err(|err| match err {
      RecvTimeoutError::Timeout => "timed out waiting for webview eval result".to_string(),
      RecvTimeoutError::Disconnected => "webview eval callback disconnected".to_string(),
    })
}

fn parse_eval_value(raw: &str) -> Result<Value, String> {
  let raw = raw.trim();
  if raw.is_empty() {
    return Ok(Value::Null);
  }

  let first = serde_json::from_str::<Value>(raw)
    .map_err(|err| format!("failed to parse webview eval json: {err}; raw: {raw}"))?;

  if let Value::String(text) = &first {
    let trimmed = text.trim();
    if trimmed.starts_with('{') || trimmed.starts_with('[') {
      return serde_json::from_str::<Value>(trimmed)
        .map_err(|err| format!("failed to parse nested webview eval json: {err}; raw: {text}"));
    }
  }

  Ok(first)
}

#[cfg(test)]
#[path = "../../test/src/commands/eval.rs"]
mod tests;
