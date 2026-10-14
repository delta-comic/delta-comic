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
    .setup(|_app, _api| {
      tracing::info!(target: "plugin::runtime", "plugin runtime initialized");
      Ok(())
    })
    .build()
}

pub fn rpc_handler<R: Runtime>() -> impl taurpc::TauRpcHandler<R> {
  commands::rpc_handler()
}

#[cfg(test)]
#[path = "../test/src/bindings.rs"]
mod bindings_tests;
