use percent_encoding::percent_decode_str;
use std::path::Path;
use tauri::http::{Response, StatusCode, header};
use tauri::{Builder, EventLoopMessage};
use tauri_runtime_wry::Wry;

pub fn init(builder: Builder<Wry<EventLoopMessage>>) -> Builder<Wry<EventLoopMessage>> {
  builder.register_uri_scheme_protocol("local", |_ctx, request| {
    // 1. 获取并解码路径 (处理路径中的 %20, %E4 等字符)
    let uri_path = request.uri().path();
    let decoded_path = percent_decode_str(uri_path).decode_utf8_lossy();

    // 2. 路径处理
    // 在 Android/Linux 上，uri().path() 返回的是类似 "/storage/emulated/0/file.jpg"
    // 它是绝对路径，所以我们通常不需要 [1..]。
    // 如果你在 Windows 开发机测试，可能需要去掉开头的 '/'。
    let path_str = if cfg!(windows) && decoded_path.starts_with('/') {
      &decoded_path[1..]
    } else {
      &decoded_path
    };
    let path = Path::new(path_str);

    // 3. 读取文件
    match std::fs::read(path) {
      Ok(data) => {
        // 4. 使用 mime_guess 自动获取 Content-Type
        // 如果猜不到，默认返回 application/octet-stream
        let mime = mime_guess::from_path(path)
          .first_or_octet_stream()
          .to_string();

        log::debug!("[local-protocol] Successfully read file: {:?}", path);

        Response::builder()
          .status(StatusCode::OK)
          .header(header::CONTENT_TYPE, mime)
          .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
          .body(data)
          .unwrap()
      }
      Err(e) => {
        log::warn!("[local-protocol] 404 path: {:?}, reason: {}", path, e);
        Response::builder()
          .status(StatusCode::NOT_FOUND)
          .header(header::CONTENT_TYPE, "text/plain")
          .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
          .body(format!("File not found: {}", e).into_bytes())
          .unwrap()
      }
    }
  })
}
