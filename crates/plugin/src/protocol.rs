use std::path::{Component, Path, PathBuf};

use percent_encoding::percent_decode_str;
use tauri::{AppHandle, Manager, Runtime, http};

const ACCESS_CONTROL_ALLOW_METHODS: &str = "GET, HEAD, OPTIONS";

fn response(
  status: http::StatusCode,
  content_type: &str,
  body: Vec<u8>,
) -> http::Response<Vec<u8>> {
  http::Response::builder()
    .status(status)
    .header(http::header::CONTENT_TYPE, content_type)
    .header(http::header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
    .header(
      http::header::ACCESS_CONTROL_ALLOW_METHODS,
      ACCESS_CONTROL_ALLOW_METHODS,
    )
    .header("Cross-Origin-Resource-Policy", "cross-origin")
    .header(http::header::CACHE_CONTROL, "no-cache")
    .header(http::header::CONTENT_LENGTH, body.len())
    .body(body)
    .unwrap()
}

fn plugin_id(value: &str) -> bool {
  let mut chars = value.chars();
  let Some(first) = chars.next() else {
    return false;
  };
  value.len() <= 64
    && first.is_ascii_alphanumeric()
    && chars.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '_' | '-'))
}

fn request_path(uri: &http::Uri) -> Result<(String, PathBuf), http::StatusCode> {
  let decoded = percent_decode_str(uri.path().trim_start_matches('/'))
    .decode_utf8()
    .map_err(|_| http::StatusCode::BAD_REQUEST)?;
  let (plugin, relative) = decoded
    .split_once('/')
    .ok_or(http::StatusCode::BAD_REQUEST)?;
  if !plugin_id(plugin) || relative.is_empty() || relative.contains(['\\', '\0']) {
    return Err(http::StatusCode::BAD_REQUEST);
  }

  let relative = Path::new(relative);
  if relative
    .components()
    .any(|component| !matches!(component, Component::Normal(_)))
  {
    return Err(http::StatusCode::BAD_REQUEST);
  }
  Ok((plugin.to_string(), relative.to_path_buf()))
}

fn content_type(path: &Path) -> String {
  match path.extension().and_then(|extension| extension.to_str()) {
    Some("js" | "mjs") => "text/javascript; charset=utf-8".to_string(),
    Some("wasm") => "application/wasm".to_string(),
    _ => mime_guess::from_path(path)
      .first_or_octet_stream()
      .to_string(),
  }
}

fn response_from_root(root: &Path, request: http::Request<Vec<u8>>) -> http::Response<Vec<u8>> {
  if request.method() == http::Method::OPTIONS {
    return response(
      http::StatusCode::NO_CONTENT,
      "text/plain; charset=utf-8",
      Vec::new(),
    );
  }
  if request.method() != http::Method::GET && request.method() != http::Method::HEAD {
    return response(
      http::StatusCode::METHOD_NOT_ALLOWED,
      "text/plain; charset=utf-8",
      Vec::new(),
    );
  }

  let (plugin, relative) = match request_path(request.uri()) {
    Ok(path) => path,
    Err(status) => return response(status, "text/plain; charset=utf-8", Vec::new()),
  };
  let path = root.join(plugin).join(relative);
  if !path.is_file() {
    return response(
      http::StatusCode::NOT_FOUND,
      "text/plain; charset=utf-8",
      Vec::new(),
    );
  }

  match std::fs::read(&path) {
    Ok(bytes) => {
      let content_type = content_type(&path);
      if request.method() == http::Method::HEAD {
        let length = bytes.len();
        let mut result = response(http::StatusCode::OK, &content_type, Vec::new());
        result.headers_mut().insert(
          http::header::CONTENT_LENGTH,
          http::HeaderValue::from(length),
        );
        result
      } else {
        response(http::StatusCode::OK, &content_type, bytes)
      }
    }
    Err(error) => {
      tracing::warn!(target: "plugin::protocol", %error, ?path, "failed to read plugin resource");
      response(
        http::StatusCode::INTERNAL_SERVER_ERROR,
        "text/plain; charset=utf-8",
        Vec::new(),
      )
    }
  }
}

pub fn handle<R: Runtime>(
  app: &AppHandle<R>,
  request: http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>> {
  match app.path().app_local_data_dir() {
    Ok(path) => response_from_root(&path.join("plugin"), request),
    Err(error) => {
      tracing::error!(target: "plugin::protocol", %error, "failed to resolve plugin directory");
      response(
        http::StatusCode::INTERNAL_SERVER_ERROR,
        "text/plain; charset=utf-8",
        Vec::new(),
      )
    }
  }
}

#[cfg(test)]
#[path = "../test/src/protocol.rs"]
mod tests;
