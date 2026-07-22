use std::path::PathBuf;

use tauri::{
  Manager, Runtime,
  plugin::{Builder as PluginBuilder, TauriPlugin},
};

mod commands;
mod migrations;

pub(crate) struct NativeStore {
  root: PathBuf,
}

/// Builds the Delta Comic database runtime integration.
pub struct Builder {
  database_url: String,
  native_store_dir: Option<PathBuf>,
}

impl Default for Builder {
  fn default() -> Self {
    Self {
      database_url: "sqlite:app.db".to_string(),
      native_store_dir: None,
    }
  }
}

impl Builder {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn database_url(mut self, database_url: impl Into<String>) -> Self {
    self.database_url = database_url.into();
    self
  }

  pub fn native_store_dir(mut self, native_store_dir: impl Into<PathBuf>) -> Self {
    self.native_store_dir = Some(native_store_dir.into());
    self
  }

  pub fn build<R: Runtime>(self, builder: tauri::Builder<R>) -> tauri::Builder<R> {
    let sql = self.sql_plugin();
    builder.plugin(sql).plugin(self.db_plugin())
  }

  fn sql_plugin<R: Runtime>(&self) -> TauriPlugin<R, Option<tauri_plugin_sql::PluginConfig>> {
    tauri_plugin_sql::Builder::default()
      .add_migrations(&self.database_url, migrations::all())
      .build()
  }

  fn db_plugin<R: Runtime>(self) -> TauriPlugin<R> {
    PluginBuilder::new("db")
      .invoke_handler(tauri::generate_handler![
        commands::native_store_get,
        commands::native_store_remove,
        commands::native_store_set,
      ])
      .setup(move |app, _api| {
        let root = match self.native_store_dir {
          Some(path) => path,
          None => app
            .path()
            .app_local_data_dir()
            .map_err(|err| format!("failed to resolve native store directory: {err}"))?
            .join("native-store"),
        };
        std::fs::create_dir_all(&root)
          .map_err(|err| format!("failed to create native store directory: {err}"))?;
        tracing::info!(target: "database::native_store", path = %root.display(), "native store initialized");
        app.manage(NativeStore { root });
        Ok(())
      })
      .build()
  }
}

/// Initializes the Delta Comic database runtime integration.
pub fn init<R: Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
  Builder::new().build(builder)
}
