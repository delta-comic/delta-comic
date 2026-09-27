use tauri::{
  Runtime,
  plugin::{Builder, TauriPlugin},
};

mod commands;
mod protocol;

/// Initializes the Delta Comic plugin runtime integration.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("plugin")
    .register_uri_scheme_protocol("plugin", |context, request| {
      protocol::handle(context.app_handle(), request)
    })
    .invoke_handler(tauri::generate_handler![
      commands::decode_zip_meta,
      commands::install_zip,
      commands::read_local_file,
    ])
    .setup(|_app, _api| {
      tracing::info!(target: "plugin::runtime", "plugin runtime initialized");
      Ok(())
    })
    .build()
}
