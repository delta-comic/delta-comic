use tauri_plugin_sql::{Migration, MigrationKind};

use tauri_plugin_aptabase::EventTracker;

use std::path::Path;
use tauri::http::{Response, StatusCode, header};
use tauri_plugin_sentry;

use percent_encoding::percent_decode_str;

#[tokio::main]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
  let client = sentry::init((
    "https://fc7f04e50b58dbd4ee6d76008c3637eb@o4510714997899264.ingest.us.sentry.io/4510715019067392",
    sentry::ClientOptions {
      release: sentry::release_name!(),
      auto_session_tracking: true,
      ..Default::default()
    },
  ));

  // Caution! Everything before here runs in both app and crash reporter processes
  #[cfg(not(target_os = "ios"))]
  let _guard = tauri_plugin_sentry::minidump::init(&client);

  let migrations = vec![
    // Define your migrations here
    Migration {
      version: 1,
      description: "create_file",
      sql: "",
      kind: MigrationKind::Up,
    },
  ];

  tauri::Builder::default()
    .plugin(
      tauri_plugin_log::Builder::new()
        .level(tauri_plugin_log::log::LevelFilter::Info)
        .build(),
    )
    .plugin(tauri_plugin_sentry::init_with_no_injection(&client))
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_m3::init())
    .plugin(tauri_plugin_upload::init())
    .plugin(tauri_plugin_cors_fetch::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_aptabase::Builder::new("A-US-9793062880").build())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:app.db", migrations)
        .build(),
    )
    .plugin(tauri_plugin_pinia::init())
    .register_uri_scheme_protocol("local", |_ctx, request| {
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

          log::info!("[local-protocol] Successfully read file: {:?}", path);

          Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime)
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(data)
            .unwrap()
        }
        Err(e) => {
          log::info!("[local-protocol] 404 path: {:?}, reason: {}", path, e);
          Response::builder()
            .status(StatusCode::NOT_FOUND)
            .header(header::CONTENT_TYPE, "text/plain")
            .header(header::ACCESS_CONTROL_ALLOW_ORIGIN, "*")
            .body(format!("File not found: {}", e).into_bytes())
            .unwrap()
        }
      }
    })
    .build(tauri::generate_context!())
    .expect("error while running tauri application")
    .run(|handler, event| match event {
      tauri::RunEvent::Exit { .. } => {
        let _ = handler.track_event("app_exited", None);
        handler.flush_events_blocking();
      }
      tauri::RunEvent::Ready { .. } => {
        let _ = handler.track_event("app_started", None);
      }
      _ => {}
    });
}
