//! Delta Comic's unified native and frontend logging runtime.
//!
//! Register this plugin before other plugins so `log` and `tracing` events
//! emitted during their setup are captured:
//!
//! ```ignore
//! tauri::Builder::default()
//!   .plugin(tauri_plugin_logger::init())
//!   .plugin(other_plugin);
//! ```

use std::path::PathBuf;

use tauri::{
  Manager, Runtime,
  plugin::{Builder as PluginBuilder, TauriPlugin},
};
use tokio::sync::mpsc;

mod commands;
mod error;
mod maintenance;
mod model;
mod repository;
mod storage;
mod tracing_bridge;

pub use error::{Error, Result};
pub use model::{FrontendLogEntry, LogFileContent, LogFileInfo, LogLevel};
pub use storage::LoggerHandle;
pub use tracing;

use maintenance::LogMaintenance;
use repository::LogRepository;
use storage::{AsyncLogWorker, FileSink};
use tracing_bridge::{PanicCapture, TracingBridge};

pub const DEFAULT_MAX_FILE_SIZE: u64 = 5 * 1024 * 1024;
pub const DEFAULT_CHANNEL_CAPACITY: usize = 4096;

struct LoggerState {
  handle: LoggerHandle,
  repository: LogRepository,
}

/// Configures the logger plugin.
pub struct Builder {
  directory: Option<PathBuf>,
  max_file_size: u64,
  channel_capacity: usize,
}

impl Builder {
  pub fn new() -> Self {
    Self::default()
  }

  /// Overrides Tauri's application log directory. Primarily useful to hosts
  /// with a custom storage policy and to integration tests.
  pub fn directory(mut self, directory: impl Into<PathBuf>) -> Self {
    self.directory = Some(directory.into());
    self
  }

  /// Sets the size boundary for each daily chunk. The default is 5 MiB.
  pub fn max_file_size(mut self, bytes: u64) -> Self {
    self.max_file_size = bytes.max(1);
    self
  }

  /// Sets the bounded hand-off queue capacity used by synchronous tracing
  /// callsites. The default is 4096 records.
  pub fn channel_capacity(mut self, capacity: usize) -> Self {
    self.channel_capacity = capacity.max(1);
    self
  }

  pub fn build<R: Runtime>(self) -> TauriPlugin<R> {
    PluginBuilder::<R>::new("logger")
      .invoke_handler(tauri::generate_handler![
        commands::write_logs,
        commands::list_log_files,
        commands::read_log_file,
        commands::export_logs,
      ])
      .setup(move |app, _api| {
        let directory = match self.directory {
          Some(directory) => directory,
          None => app
            .path()
            .app_log_dir()
            .map_err(|error| format!("failed to resolve application log directory: {error}"))?,
        };
        let fallback_export = app
          .path()
          .app_data_dir()
          .map_err(|error| format!("failed to resolve application data directory: {error}"))?
          .join("log-exports");
        let mut export_directories = Vec::with_capacity(2);
        if let Ok(downloads) = app.path().download_dir() {
          export_directories.push(downloads);
        }
        export_directories.push(fallback_export);

        let (sender, receiver) = mpsc::channel(self.channel_capacity);
        let handle = LoggerHandle::new(sender);
        let sink =
          tauri::async_runtime::block_on(FileSink::new(directory.clone(), self.max_file_size))
            .map_err(|error| error.to_string())?;
        TracingBridge::install(handle.clone()).map_err(|error| error.to_string())?;
        PanicCapture::install(handle.clone());
        tauri::async_runtime::spawn(AsyncLogWorker::new(receiver, sink).run());
        LogMaintenance::new(directory.clone()).start();

        let repository = LogRepository::new(directory.clone(), export_directories);
        app.manage(handle.clone());
        app.manage(LoggerState { handle, repository });
        tracing::info!(
          target: "tauri_plugin_logger",
          scope = "logger",
          log_directory = %directory.display(),
          "logger initialized"
        );
        Ok(())
      })
      .build()
  }
}

impl Default for Builder {
  fn default() -> Self {
    Self {
      directory: None,
      max_file_size: DEFAULT_MAX_FILE_SIZE,
      channel_capacity: DEFAULT_CHANNEL_CAPACITY,
    }
  }
}

/// Creates the logger plugin with production defaults.
pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::new().build()
}
