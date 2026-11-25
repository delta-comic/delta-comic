use tauri::{AppHandle, Manager, Runtime};

use crate::{
  LoggerState,
  error::Result,
  model::{FrontendLogEntry, LogFileContent, LogFileInfo},
};

#[taurpc::procedures(path = "logger")]
pub trait LoggerApi {
  async fn write_logs<R: Runtime>(
    app_handle: AppHandle<R>,
    entries: Vec<FrontendLogEntry>,
  ) -> Result<()>;
  async fn list_log_files<R: Runtime>(app_handle: AppHandle<R>) -> Result<Vec<LogFileInfo>>;
  async fn read_log_file<R: Runtime>(
    app_handle: AppHandle<R>,
    path: String,
  ) -> Result<LogFileContent>;
  async fn export_logs<R: Runtime>(
    app_handle: AppHandle<R>,
    paths: Option<Vec<String>>,
  ) -> Result<String>;
}

#[derive(Clone, Copy)]
pub struct LoggerApiImpl;

#[taurpc::resolvers]
impl LoggerApi for LoggerApiImpl {
  async fn write_logs<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    entries: Vec<FrontendLogEntry>,
  ) -> Result<()> {
    let state = app_handle.state::<LoggerState>().clone();
    state.handle.write_frontend_batch(entries).await
  }

  async fn list_log_files<R: Runtime>(self, app_handle: AppHandle<R>) -> Result<Vec<LogFileInfo>> {
    let state = app_handle.state::<LoggerState>().clone();
    state.repository.list().await
  }

  async fn read_log_file<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    path: String,
  ) -> Result<LogFileContent> {
    let state = app_handle.state::<LoggerState>().clone();
    state.repository.read_tail(path).await
  }

  async fn export_logs<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    paths: Option<Vec<String>>,
  ) -> Result<String> {
    let state = app_handle.state::<LoggerState>().clone();
    state.handle.flush().await?;
    state.repository.export(paths).await
  }
}

pub fn rpc_handler<R: Runtime>() -> impl taurpc::TauRpcHandler<R> {
  LoggerApiImpl.into_handler()
}
