use tauri_plugin_sql::{Migration, MigrationKind};

use tauri_plugin_aptabase::EventTracker;

#[tokio::main]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
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
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .register_uri_scheme_protocol("local", |_ctx, request| {
      // skip leading `/`
      print!("local called!!!!!");
      if let Ok(data) = std::fs::read(&request.uri().path()[1..]) {
        tauri::http::Response::builder()
          .header(
            tauri::http::header::CONTENT_TYPE,
            "text/javascript",
          )
          .header("Origin", "*")
          .header("Access-Control-Allow-Origin", "*")
          .body(data)
          .unwrap()
      } else {
        tauri::http::Response::builder()
          .status(tauri::http::StatusCode::BAD_REQUEST)
          .header(
            tauri::http::header::CONTENT_TYPE,
            "text/plain",
          )
          .header("Access-Control-Allow-Origin", "*") // 允许跨域
          .body("[delta-comic::local] failed to read file".as_bytes().to_vec())
          .unwrap()
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
       let _ =  handler.track_event("app_started", None);
      }
      _ => {}
    });
}
