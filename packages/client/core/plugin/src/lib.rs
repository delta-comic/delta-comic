use std::{fs, path::Path};

use tauri::{
  Runtime,
  plugin::{Builder, TauriPlugin},
};

mod commands;
mod protocol;

use commands::PluginApi;

/// Initializes the Delta Comic plugin runtime integration.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new("plugin")
    .register_uri_scheme_protocol("plugin", |context, request| {
      protocol::handle(context.app_handle(), request)
    })
    .setup(|_app, _api| {
      tracing::info!(target: "plugin::runtime", "plugin runtime initialized");
      Ok(())
    })
    .build()
}

pub fn rpc_handler<R: Runtime>() -> impl taurpc::TauRpcHandler<R> {
  commands::rpc_handler()
}

pub fn export_bindings(
  path: impl AsRef<Path>,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = path.as_ref();
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-plugin-bindings-{}",
    std::process::id()
  ));
  taurpc::Exporter::new().export(&commands::PluginApiImpl.into_handler(), &temp_path)?;
  let generated = fs::read(&temp_path)?;
  let current = fs::read(path).unwrap_or_default();
  if generated != current {
    fs::write(path, generated)?;
  }
  let _ = fs::remove_file(temp_path);
  Ok(())
}
