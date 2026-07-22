use tauri::State;

use crate::{
  LoggerState,
  error::Result,
  model::{FrontendLogEntry, LogFileContent, LogFileInfo},
};

#[tauri::command]
pub(crate) async fn write_logs(
  entries: Vec<FrontendLogEntry>,
  state: State<'_, LoggerState>,
) -> Result<()> {
  state.handle.write_frontend_batch(entries).await
}

#[tauri::command]
pub(crate) async fn list_log_files(state: State<'_, LoggerState>) -> Result<Vec<LogFileInfo>> {
  state.repository.list().await
}

#[tauri::command]
pub(crate) async fn read_log_file(
  path: String,
  state: State<'_, LoggerState>,
) -> Result<LogFileContent> {
  state.repository.read_tail(path).await
}

#[tauri::command]
pub(crate) async fn export_logs(
  paths: Option<Vec<String>>,
  state: State<'_, LoggerState>,
) -> Result<String> {
  state.handle.flush().await?;
  state.repository.export(paths).await
}
