use percent_encoding::percent_decode_str;
use std::path::Path;
use tauri::http::{Response, StatusCode, header};
use tauri::{Builder, Runtime};

pub fn init<R: Runtime>(builder: Builder<R>, scheme: String) -> Builder<R> {
  builder.register_uri_scheme_protocol(scheme, |_ctx, request| {
    let uri_path = request.uri().path();
    let decoded_path = percent_decode_str(uri_path).decode_utf8_lossy();
    let path_str = if cfg!(windows) && decoded_path.starts_with('/') {
      &decoded_path[1..]
    } else {
      &decoded_path
    };
    let path = Path::new(path_str);

    match std::fs::read(path) {
      Ok(data) => {
        let mime = mime_guess::from_path(path)
          .first_or_octet_stream()
          .to_string();

        tracing::debug!("[local-protocol] successfully read file: {:?}", path);

        Response::builder()
          .status(StatusCode::OK)
          .header(header::CONTENT_TYPE, mime)
          .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
          .body(data)
          .unwrap()
      }
      Err(err) => {
        tracing::warn!("[local-protocol] 404 path: {:?}, reason: {}", path, err);
        Response::builder()
          .status(StatusCode::NOT_FOUND)
          .header(header::CONTENT_TYPE, "text/plain")
          .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
          .body(format!("File not found: {err}").into_bytes())
          .unwrap()
      }
    }
  })
}
