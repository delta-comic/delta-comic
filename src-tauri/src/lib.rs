use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
