use std::path::PathBuf;
use std::{fs, path::Path};

use tauri::{
  Manager, Runtime,
  plugin::{Builder as PluginBuilder, TauriPlugin},
};

mod commands;
mod migrations;

use commands::DbApi;

#[derive(Clone)]
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

pub fn rpc_handler<R: Runtime>() -> impl taurpc::TauRpcHandler<R> {
  commands::rpc_handler()
}

pub fn export_bindings(
  path: impl AsRef<Path>,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = path.as_ref();
  let temp_path =
    std::env::temp_dir().join(format!("delta-comic-db-bindings-{}", std::process::id()));
  taurpc::Exporter::new().export(&commands::DbApiImpl.into_handler(), &temp_path)?;
  let generated = fs::read_to_string(&temp_path)?
    .replace(", type UnlistenFn", "")
    .into_bytes();
  let current = fs::read(path).unwrap_or_default();
  if generated != current {
    fs::write(path, generated)?;
  }
  let _ = fs::remove_file(temp_path);
  Ok(())
}
