mod fs_scheme;
mod sentry;

use tauri_plugin_aptabase::EventTracker;
use tauri_plugin_sql::{Migration, MigrationKind};

#[tokio::main]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
  log::debug!("app started");

  let migrations = vec![
    // Define your migrations here
    Migration {
      version: 1,
      description: "create_file",
      sql: "",
      kind: MigrationKind::Up,
    },
  ];

  let builder = fs_scheme::init(
    tauri::Builder::default()
      .plugin(sentry::init())
      .plugin(tauri_plugin_fs::init()),
  );
  let builder = builder
    .plugin(
      tauri_plugin_log::Builder::new()
        .level(tauri_plugin_log::log::LevelFilter::Debug)
        .build(),
    )
    .plugin(tauri_plugin_m3::init())
    .plugin(tauri_plugin_upload::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_cors_fetch::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_aptabase::Builder::new("A-US-9793062880").build())
    .plugin(
      tauri_plugin_sql::Builder::default()
        .add_migrations("sqlite:app.db", migrations)
        .build(),
    )
    .plugin(tauri_plugin_pinia::init());

  match builder.build(tauri::generate_context!()) {
    Ok(builder) => builder.run(|handler, event| match event {
      tauri::RunEvent::Exit { .. } => {
        let _ = handler.track_event("app_exited", None);
        handler.flush_events_blocking();
      }
      tauri::RunEvent::Ready { .. } => {
        let _ = handler.track_event("app_started", None);
      }
      _ => {}
    }),
    Err(err) => log::error!("error while running tauri application: {}", err),
  }

  log::debug!("app exited");
}
