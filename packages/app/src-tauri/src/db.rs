use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_sql::{Migration, MigrationKind};

pub fn init<R: Runtime>() -> TauriPlugin<R, Option<tauri_plugin_sql::PluginConfig>> {
  let migrations = vec![
    // Define your migrations here
    Migration {
      version: 1,
      description: "create_file",
      sql: "",
      kind: MigrationKind::Up,
    },
  ];
  tauri_plugin_sql::Builder::default()
    .add_migrations("sqlite:app.db", migrations)
    .build()
}
