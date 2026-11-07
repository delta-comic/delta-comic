use tauri::{AppHandle, Manager, Runtime, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::webview_registry::{WebviewRegistry, validate_page_label};

use super::{InjectCodeOptions, OpenPageOptions, OpenedPage, scripts, storage::get_webview_window};

pub(crate) async fn webview_open_page<R: Runtime>(
  app_handle: AppHandle<R>,
  registry: &WebviewRegistry,
  options: OpenPageOptions,
) -> Result<OpenedPage, String> {
  let label = match options.label {
    Some(label) => label,
    None => registry.next_label(),
  };
  validate_page_label(&label)?;

  if app_handle.get_webview_window(&label).is_some() {
    return Err(format!("webview page already exists: {label}"));
  }

  let webview_url = parse_webview_url(&options.url)?;
  let callback_name = scripts::callback_name(options.callback_name.as_deref());
  let init_script =
    scripts::install_bridge_script(options.css.as_deref(), options.js.as_deref(), callback_name);

  let mut builder = WebviewWindowBuilder::new(&app_handle, &label, webview_url);
  builder = if options.all_frames.unwrap_or(true) {
    builder.initialization_script_for_all_frames(init_script)
  } else {
    builder.initialization_script(init_script)
  };

  if let Some(title) = options.title {
    builder = builder.title(title);
  }
  if let Some(visible) = options.visible {
    builder = builder.visible(visible);
  }
  if let (Some(width), Some(height)) = (options.width, options.height) {
    builder = builder.inner_size(width, height);
  }
  if let Some(user_agent) = options.user_agent {
    builder = builder.user_agent(&user_agent);
  }
  if let Some(incognito) = options.incognito {
    builder = builder.incognito(incognito);
  }
  if let Some(devtools) = options.devtools {
    builder = builder.devtools(devtools);
  }

  let webview = builder
    .build()
    .map_err(|err| format!("failed to open webview page: {err}"))?;
  registry.insert(webview.label().to_string());

  Ok(OpenedPage {
    label,
    url: options.url,
  })
}

pub(crate) async fn webview_inject_code<R: Runtime>(
  app_handle: AppHandle<R>,
  webview_window: WebviewWindow<R>,
  options: InjectCodeOptions,
) -> Result<(), String> {
  let target = match options.label {
    Some(label) => get_webview_window(&app_handle, &label)?,
    None => webview_window,
  };
  let callback_name = scripts::callback_name(options.callback_name.as_deref());
  let script =
    scripts::install_bridge_script(options.css.as_deref(), options.js.as_deref(), callback_name);
  target
    .eval(script)
    .map_err(|err| format!("failed to inject webview code: {err}"))
}

pub(crate) fn webview_close_current_page<R: Runtime>(
  webview_window: WebviewWindow<R>,
  registry: &WebviewRegistry,
) -> Result<(), String> {
  let label = webview_window.label().to_string();
  registry.remove(&label);
  webview_window
    .close()
    .map_err(|err| format!("failed to close current webview page: {err}"))
}

pub(crate) fn webview_close_page<R: Runtime>(
  app_handle: AppHandle<R>,
  registry: &WebviewRegistry,
  label: String,
) -> Result<(), String> {
  let webview = get_webview_window(&app_handle, &label)?;
  registry.remove(&label);
  webview
    .close()
    .map_err(|err| format!("failed to close webview page {label}: {err}"))
}

fn parse_webview_url(url: &str) -> Result<WebviewUrl, String> {
  if has_url_scheme(url) {
    let parsed = tauri::Url::parse(url).map_err(|err| format!("invalid page url {url}: {err}"))?;
    Ok(WebviewUrl::External(parsed))
  } else {
    Ok(WebviewUrl::App(url.into()))
  }
}

fn has_url_scheme(url: &str) -> bool {
  let Some((scheme, _)) = url.split_once(':') else {
    return false;
  };
  !scheme.is_empty()
    && scheme
      .chars()
      .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '+' | '-' | '.'))
}

#[cfg(test)]
#[path = "../../test/src/commands/page.rs"]
mod tests;
