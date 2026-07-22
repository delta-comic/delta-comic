use std::{path::PathBuf, sync::Arc};

use tauri::{
  AppHandle, Emitter, Manager, Runtime,
  plugin::{Builder as PluginBuilder, TauriPlugin},
};

mod checksum;
mod commands;
mod credentials;
mod domain;
mod engine;
mod ephemeral;
mod error;
mod http;
#[cfg(target_os = "android")]
mod mobile;
#[cfg(any(target_os = "android", test))]
mod mobile_contract;
mod persistence;
#[cfg(any(target_os = "android", test))]
mod saf_contract;
mod target_file;
mod torrent;

pub use domain::*;
pub use engine::{DownloaderHandle, EngineEvent};
pub use error::{Error, Result};

pub struct Builder {
  database_path: Option<PathBuf>,
  download_dir: Option<PathBuf>,
  secret_resolver: Option<Arc<dyn SecretResolver>>,
}

pub trait SecretResolver: Send + Sync + 'static {
  fn resolve(&self, secret_ref: &str) -> Result<Option<String>>;
}

impl Builder {
  pub fn new() -> Self {
    Self {
      database_path: None,
      download_dir: None,
      secret_resolver: None,
    }
  }

  pub fn database_path(mut self, path: impl Into<PathBuf>) -> Self {
    self.database_path = Some(path.into());
    self
  }

  pub fn download_dir(mut self, path: impl Into<PathBuf>) -> Self {
    self.download_dir = Some(path.into());
    self
  }

  pub fn secret_resolver(mut self, resolver: impl SecretResolver) -> Self {
    self.secret_resolver = Some(Arc::new(resolver));
    self
  }

  pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
    PluginBuilder::<R>::new("downloader")
      .invoke_handler(tauri::generate_handler![
        commands::cancel_task,
        commands::delete_secret,
        commands::delete_task_files,
        commands::download_ephemeral,
        commands::enqueue_plan,
        commands::enqueue_torrent,
        commands::enqueue_url,
        commands::forget_task,
        commands::get_collections,
        commands::get_capabilities,
        commands::get_settings,
        commands::get_task,
        commands::get_task_detail,
        commands::list_destinations,
        commands::list_tasks,
        commands::move_queue,
        commands::pause_task,
        commands::pick_destination,
        commands::resume_task,
        commands::retry_task,
        commands::set_priority,
        commands::store_secret,
        commands::update_settings,
        commands::update_source,
      ])
      .setup(move |app, api| {
        let app_data = app
          .path()
          .app_data_dir()
          .map_err(|error| format!("failed to resolve application data directory: {error}"))?;
        let database_path = self
          .database_path
          .unwrap_or_else(|| app_data.join("downloader.sqlite"));
        let ephemeral_root = ephemeral::EphemeralRoot::new(app_data.join(".downloader-ephemeral"));
        if let Err(error) = tauri::async_runtime::block_on(ephemeral_root.clean_stale()) {
          log::warn!("stale ephemeral download cleanup failed: {error}");
        }
        app.manage(ephemeral_root);
        #[cfg(target_os = "android")]
        let default_download_dir = self
          .download_dir
          .unwrap_or_else(|| app_data.join("downloads"));
        #[cfg(not(target_os = "android"))]
        let default_download_dir = match self.download_dir {
          Some(path) => path,
          None => app
            .path()
            .download_dir()
            .map_err(|error| format!("failed to resolve Downloads directory: {error}"))?,
        };
        let event_app = app.clone();
        let event_sink = move |event| match event {
          EngineEvent::TaskUpsert(payload) => {
            let _ = event_app.emit("downloader://task-upsert", payload);
          }
          EngineEvent::TaskRemoved(payload) => {
            let _ = event_app.emit("downloader://task-removed", payload);
          }
          EngineEvent::Attention(payload) => {
            let _ = event_app.emit("downloader://attention", payload);
          }
        };

        #[cfg(target_os = "android")]
        {
          let config =
            mobile_contract::AndroidEngineConfig::new(&database_path, &default_download_dir)
              .map_err(str::to_string)?;
          let mobile = mobile::init(app, api)?;
          mobile.initialize_credential_context()?;
          let credentials =
            credentials::CredentialVault::system().map_err(|error| error.to_string())?;
          let secret_resolver = credentials::resolver(credentials.clone(), self.secret_resolver);
          mobile::register_event_sink(event_sink);
          let engine = tauri::async_runtime::block_on(mobile::open_or_reuse_engine(
            config.clone(),
            Some(secret_resolver),
          ))
          .map_err(|error| error.to_string())?;
          mobile.configure(config)?;
          app.manage(credentials);
          app.manage(engine);
          app.manage(mobile);
        }

        #[cfg(not(target_os = "android"))]
        {
          let credentials =
            credentials::CredentialVault::system().map_err(|error| error.to_string())?;
          let secret_resolver = credentials::resolver(credentials.clone(), self.secret_resolver);
          let engine = tauri::async_runtime::block_on(engine::Engine::open(
            &database_path,
            &default_download_dir,
            Some(secret_resolver),
            event_sink,
          ))
          .map_err(|error| error.to_string())?;
          engine.start();
          app.manage(credentials);
          app.manage(engine);
          let _ = api;
        }
        Ok(())
      })
      .build()
  }
}

impl Default for Builder {
  fn default() -> Self {
    Self::new()
  }
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new().build()
}

pub trait DownloaderExt<R: Runtime> {
  fn downloader(&self) -> DownloaderHandle;
}

impl<R: Runtime> DownloaderExt<R> for AppHandle<R> {
  fn downloader(&self) -> DownloaderHandle {
    self.state::<engine::Engine>().handle()
  }
}
