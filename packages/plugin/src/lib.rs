use tauri::{
  Runtime,
  plugin::{Builder, TauriPlugin},
};

mod commands;

/// Initializes the Delta Comic plugin runtime integration.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("plugin")
    .invoke_handler(tauri::generate_handler![
      commands::decode_dev_meta,
      commands::decode_zip_meta,
      commands::install_dev,
      commands::install_zip,
      commands::prepare_dev_script,
      commands::read_local_file,
    ])
    .setup(|_app, _api| {
      tracing::info!(target: "plugin::runtime", "plugin runtime initialized");
      Ok(())
    })
    .build()
}
