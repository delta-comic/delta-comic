use std::collections::BTreeMap;

#[cfg(target_os = "android")]
use tauri::Emitter;
use tauri::{Manager, State};
use tokio_util::sync::CancellationToken;
use zeroize::Zeroizing;

use crate::{
  credentials::CredentialVault,
  domain::{
    ByteRange, Destination, DownloadCollection, DownloadSource, DownloadTask, DownloadTaskDetail,
    DownloaderCapabilities, DownloaderSettings, EnqueuePlanInput, EnqueueTorrentInput,
    EnqueueUrlInput,
  },
  engine::Engine,
  ephemeral::{EphemeralDownloadRequest, EphemeralRoot},
  error::Result,
};

#[tauri::command]
pub(crate) async fn store_secret(
  credentials: State<'_, CredentialVault>,
  value: String,
) -> Result<String> {
  // Wrap before the first await so the IPC-owned allocation is cleared on every exit path.
  let value = Zeroizing::new(value);
  let credentials = credentials.inner().clone();
  tauri::async_runtime::spawn_blocking(move || credentials.store(value.as_str()))
    .await
    .map_err(|_| {
      crate::Error::CredentialStore("native credential worker could not complete".into())
    })?
}

#[tauri::command]
pub(crate) async fn delete_secret(
  credentials: State<'_, CredentialVault>,
  secret_ref: String,
) -> Result<()> {
  let secret_ref = Zeroizing::new(secret_ref);
  let credentials = credentials.inner().clone();
  tauri::async_runtime::spawn_blocking(move || credentials.delete(secret_ref.as_str()))
    .await
    .map_err(|_| {
      crate::Error::CredentialStore("native credential worker could not complete".into())
    })?
}

#[tauri::command]
pub(crate) async fn download_ephemeral(
  engine: State<'_, Engine>,
  temporary_root: State<'_, EphemeralRoot>,
  url: String,
  headers: Option<BTreeMap<String, String>>,
  secret_ref: Option<String>,
  max_bytes: Option<u64>,
) -> Result<tauri::ipc::Response> {
  let bytes = engine
    .download_ephemeral(
      temporary_root.path(),
      EphemeralDownloadRequest {
        url,
        headers: headers.unwrap_or_default(),
        secret_ref,
        max_bytes,
      },
      CancellationToken::new(),
    )
    .await?;
  Ok(tauri::ipc::Response::new(bytes))
}

#[cfg(target_os = "android")]
async fn schedule_android(
  app: &tauri::AppHandle,
  engine: &Engine,
  task: &DownloadTask,
) -> Result<()> {
  let settings = engine.repository.get_settings().await?;
  let mobile = app.state::<crate::mobile::MobileDownloader<tauri::Wry>>();
  let allow_metered =
    crate::mobile_contract::android_task_allows_metered_network(&task.source, &settings);
  let notification_permission = mobile
    .schedule(task.id.clone(), task.total_bytes, allow_metered)
    .map_err(crate::Error::InvalidInput)?;
  if notification_permission == crate::mobile_contract::AndroidNotificationPermission::Denied {
    let _ = app.emit(
      "downloader://attention",
      crate::AttentionEvent {
        task_id: task.id.clone(),
        code: "notificationPermissionDenied".into(),
        message: "Android notification permission is denied; notification pause and cancel actions are unavailable".into(),
        revision: task.revision,
      },
    );
  }
  Ok(())
}

#[tauri::command]
pub(crate) async fn list_tasks(engine: State<'_, Engine>) -> Result<Vec<DownloadTask>> {
  engine.repository.list_tasks().await
}

#[tauri::command]
pub(crate) async fn get_task(
  engine: State<'_, Engine>,
  id: String,
) -> Result<Option<DownloadTask>> {
  engine.repository.get_task(&id).await
}

#[tauri::command]
pub(crate) async fn get_task_detail(
  engine: State<'_, Engine>,
  id: String,
) -> Result<DownloadTaskDetail> {
  let task = engine
    .repository
    .get_task(&id)
    .await?
    .ok_or_else(|| crate::Error::NotFound(id.clone()))?;
  let completed_ranges = engine
    .repository
    .completed_ranges(&id)
    .await?
    .into_iter()
    .map(|range| ByteRange {
      start: range.start,
      end: range.end,
    })
    .collect();
  let torrent = engine.repository.torrent_detail(&id).await?;
  Ok(DownloadTaskDetail {
    task,
    completed_ranges,
    torrent,
  })
}

#[tauri::command]
pub(crate) async fn get_collections(engine: State<'_, Engine>) -> Result<Vec<DownloadCollection>> {
  engine.repository.list_collections().await
}

#[tauri::command]
pub(crate) async fn list_destinations(engine: State<'_, Engine>) -> Result<Vec<Destination>> {
  engine.repository.list_destinations().await
}

#[tauri::command]
pub(crate) async fn get_settings(engine: State<'_, Engine>) -> Result<DownloaderSettings> {
  engine.repository.get_settings().await
}

#[tauri::command]
pub(crate) fn get_capabilities() -> DownloaderCapabilities {
  DownloaderCapabilities::platform()
}

#[tauri::command]
pub(crate) async fn update_settings(
  engine: State<'_, Engine>,
  settings: DownloaderSettings,
) -> Result<DownloaderSettings> {
  engine.update_settings(settings).await
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn enqueue_url(
  engine: State<'_, Engine>,
  input: EnqueueUrlInput,
) -> Result<DownloadTask> {
  engine.enqueue_url(input).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn enqueue_url(
  engine: State<'_, Engine>,
  app: tauri::AppHandle,
  input: EnqueueUrlInput,
) -> Result<DownloadTask> {
  let task = engine.enqueue_url(input).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn enqueue_torrent(
  engine: State<'_, Engine>,
  input: EnqueueTorrentInput,
) -> Result<DownloadTask> {
  engine.enqueue_torrent(input).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn enqueue_torrent(
  engine: State<'_, Engine>,
  app: tauri::AppHandle,
  input: EnqueueTorrentInput,
) -> Result<DownloadTask> {
  let task = engine.enqueue_torrent(input).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn enqueue_plan(
  engine: State<'_, Engine>,
  input: EnqueuePlanInput,
) -> Result<Vec<DownloadTask>> {
  engine.enqueue_plan(input).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn enqueue_plan(
  engine: State<'_, Engine>,
  app: tauri::AppHandle,
  input: EnqueuePlanInput,
) -> Result<Vec<DownloadTask>> {
  let tasks = engine.enqueue_plan(input).await?;
  for task in &tasks {
    schedule_android(&app, &engine, task).await?;
  }
  Ok(tasks)
}

#[tauri::command]
pub(crate) async fn pause_task(engine: State<'_, Engine>, id: String) -> Result<DownloadTask> {
  engine.pause(&id).await
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn resume_task(engine: State<'_, Engine>, id: String) -> Result<DownloadTask> {
  engine.resume(&id).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn resume_task(
  engine: State<'_, Engine>,
  app: tauri::AppHandle,
  id: String,
) -> Result<DownloadTask> {
  let task = engine.resume(&id).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn retry_task(engine: State<'_, Engine>, id: String) -> Result<DownloadTask> {
  engine.retry(&id).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn retry_task(
  engine: State<'_, Engine>,
  app: tauri::AppHandle,
  id: String,
) -> Result<DownloadTask> {
  let task = engine.retry(&id).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[tauri::command]
pub(crate) async fn cancel_task(engine: State<'_, Engine>, id: String) -> Result<DownloadTask> {
  engine.cancel(&id).await
}

#[tauri::command]
pub(crate) async fn forget_task(engine: State<'_, Engine>, id: String) -> Result<()> {
  engine.forget(&id).await
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn delete_task_files(engine: State<'_, Engine>, id: String) -> Result<()> {
  engine.delete_files(&id).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn delete_task_files<R: tauri::Runtime>(
  engine: State<'_, Engine>,
  app: tauri::AppHandle<R>,
  id: String,
) -> Result<()> {
  let mobile = app.state::<crate::mobile::MobileDownloader<R>>();
  engine
    .delete_files_with_external(&id, |destination, export| {
      let Some(export) = export else {
        return Ok(());
      };
      if export.destination_id != destination.id {
        return Err(crate::Error::InvalidInput(
          "export record does not match its task destination".into(),
        ));
      }
      let Some(document_uri) = export.document_uri.as_ref() else {
        return Ok(());
      };
      if destination.kind != crate::DestinationKind::AndroidSaf {
        return Err(crate::Error::InvalidInput(
          "export record does not reference an Android SAF destination".into(),
        ));
      }
      mobile
        .delete_exported(destination.path.clone(), document_uri.clone())
        .map_err(crate::Error::DestinationExport)
    })
    .await
}

#[tauri::command]
pub(crate) async fn set_priority(
  engine: State<'_, Engine>,
  id: String,
  priority: u8,
) -> Result<DownloadTask> {
  engine.set_priority(&id, priority).await
}

#[tauri::command]
pub(crate) async fn move_queue(
  engine: State<'_, Engine>,
  id: String,
  before_task_id: Option<String>,
) -> Result<DownloadTask> {
  engine.move_queue(&id, before_task_id.as_deref()).await
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn pick_destination<R: tauri::Runtime>(
  engine: State<'_, Engine>,
  app: tauri::AppHandle<R>,
) -> Result<Option<Destination>> {
  let Some(handle) = rfd::AsyncFileDialog::new()
    .set_directory(
      app
        .path()
        .download_dir()
        .map_err(|error| crate::Error::InvalidInput(error.to_string()))?,
    )
    .pick_folder()
    .await
  else {
    return Ok(None);
  };
  let path = tokio::fs::canonicalize(handle.path()).await?;
  let label = path
    .file_name()
    .and_then(|value| value.to_str())
    .filter(|value| !value.is_empty())
    .unwrap_or("Selected folder")
    .to_owned();
  let destination = Destination {
    id: format!("directory-{}", uuid::Uuid::new_v4()),
    label,
    kind: crate::DestinationKind::DesktopDirectory,
    path: path.to_string_lossy().into_owned(),
    is_default: false,
  };
  engine.repository.register_destination(&destination).await?;
  Ok(Some(destination))
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn pick_destination<R: tauri::Runtime>(
  engine: State<'_, Engine>,
  app: tauri::AppHandle<R>,
) -> Result<Option<Destination>> {
  let mobile = app.state::<crate::mobile::MobileDownloader<R>>();
  let Some(picked) = mobile
    .pick_destination()
    .map_err(crate::Error::DestinationExport)?
  else {
    return Ok(None);
  };
  let destination = Destination {
    id: picked.id.ok_or_else(|| {
      crate::Error::InvalidInput("Android picker returned no destination ID".into())
    })?,
    label: picked
      .label
      .ok_or_else(|| crate::Error::InvalidInput("Android picker returned no label".into()))?,
    kind: crate::DestinationKind::AndroidSaf,
    path: picked
      .uri
      .ok_or_else(|| crate::Error::InvalidInput("Android picker returned no tree URI".into()))?,
    is_default: false,
  };
  engine.repository.register_destination(&destination).await?;
  Ok(Some(destination))
}

#[cfg(not(target_os = "android"))]
#[tauri::command]
pub(crate) async fn update_source(
  engine: State<'_, Engine>,
  id: String,
  source: DownloadSource,
) -> Result<DownloadTask> {
  engine.update_source(&id, &source).await
}

#[cfg(target_os = "android")]
#[tauri::command]
pub(crate) async fn update_source(
  engine: State<'_, Engine>,
  app: tauri::AppHandle,
  id: String,
  source: DownloadSource,
) -> Result<DownloadTask> {
  let task = engine.update_source(&id, &source).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}
