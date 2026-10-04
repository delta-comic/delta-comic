use std::{fs, path::Path};

use tauri::{
  Manager, Runtime,
  plugin::{Builder as PluginBuilder, TauriPlugin},
};

pub mod commands;
mod local_scheme;
#[cfg(target_os = "android")]
mod mobile;
mod webview_registry;

use commands::UtilsApi;

/// Builds the Delta Comic utility runtime integration.
pub struct Builder {
  local_scheme: Option<String>,
}

impl Default for Builder {
  fn default() -> Self {
    Self {
      local_scheme: Some("local".to_string()),
    }
  }
}

impl Builder {
  pub fn new() -> Self {
    Self::default()
  }

  pub fn local_scheme(mut self, local_scheme: impl Into<String>) -> Self {
    self.local_scheme = Some(local_scheme.into());
    self
  }

  pub fn disable_local_scheme(mut self) -> Self {
    self.local_scheme = None;
    self
  }

  pub fn build<R: Runtime>(self, builder: tauri::Builder<R>) -> tauri::Builder<R> {
    let builder = match &self.local_scheme {
      Some(local_scheme) => local_scheme::init(builder, local_scheme.clone()),
      None => builder,
    };

    builder.plugin(self.utils_plugin())
  }

  fn utils_plugin<R: Runtime>(&self) -> TauriPlugin<R> {
    let registry = webview_registry::WebviewRegistry::default();
    let setup_registry = registry.clone();
    let ready_registry = registry.clone();

    PluginBuilder::<R>::new("utils")
      .setup(move |app, api| {
        app.manage(setup_registry);
        #[cfg(target_os = "android")]
        app.manage(mobile::init(app, api)?);
        #[cfg(not(target_os = "android"))]
        let _ = api;
        Ok(())
      })
      .on_webview_ready(move |webview| {
        ready_registry.insert(webview.label().to_string());
      })
      .build()
  }
}

/// Initializes the Delta Comic utility runtime integration.
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
    std::env::temp_dir().join(format!("delta-comic-utils-bindings-{}", std::process::id()));
  taurpc::Exporter::new().export(&commands::UtilsApiImpl.into_handler(), &temp_path)?;
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
