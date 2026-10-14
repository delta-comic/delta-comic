use std::collections::BTreeMap;

use tauri::Manager;
use tokio_util::sync::CancellationToken;
use zeroize::Zeroizing;

use crate::{
  credentials::CredentialVault,
  domain::{
    AttentionEvent, ByteRange, Destination, DownloadCollection, DownloadSource, DownloadTask,
    DownloadTaskDetail, DownloaderCapabilities, DownloaderSettings, EnqueuePlanInput,
    EnqueueTorrentInput, EnqueueUrlInput, TaskRemovedEvent, TaskUpsertEvent,
  },
  engine::Engine,
  ephemeral::{EphemeralDownloadRequest, EphemeralRoot},
  error::Result,
};

/// Typed IPC surface for the downloader plugin.
#[taurpc::procedures(path = "downloader", event_trigger = DownloaderEventTrigger)]
pub trait DownloaderApi {
  async fn store_secret<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    value: String,
  ) -> std::result::Result<String, String>;
  async fn delete_secret<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    secret_ref: String,
  ) -> std::result::Result<(), String>;
  async fn download_ephemeral<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    url: String,
    headers: Option<BTreeMap<String, String>>,
    secret_ref: Option<String>,
    max_bytes: Option<u64>,
  ) -> std::result::Result<Vec<u8>, String>;
  async fn list_tasks<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<DownloadTask>, String>;
  async fn get_task<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<Option<DownloadTask>, String>;
  async fn get_task_detail<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTaskDetail, String>;
  async fn get_collections<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<DownloadCollection>, String>;
  async fn list_destinations<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<Destination>, String>;
  async fn get_settings<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<DownloaderSettings, String>;
  async fn get_capabilities<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<DownloaderCapabilities, String>;
  async fn update_settings<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    settings: DownloaderSettings,
  ) -> std::result::Result<DownloaderSettings, String>;
  async fn enqueue_url<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    input: EnqueueUrlInput,
  ) -> std::result::Result<DownloadTask, String>;
  async fn enqueue_torrent<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    input: EnqueueTorrentInput,
  ) -> std::result::Result<DownloadTask, String>;
  async fn enqueue_plan<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    input: EnqueuePlanInput,
  ) -> std::result::Result<Vec<DownloadTask>, String>;
  async fn pause_task<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String>;
  async fn resume_task<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String>;
  async fn retry_task<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String>;
  async fn cancel_task<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String>;
  async fn forget_task<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<(), String>;
  async fn delete_task_files<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<(), String>;
  async fn set_priority<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
    priority: u8,
  ) -> std::result::Result<DownloadTask, String>;
  async fn move_queue<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
    before_task_id: Option<String>,
  ) -> std::result::Result<DownloadTask, String>;
  async fn pick_destination<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Option<Destination>, String>;
  async fn update_source<R: tauri::Runtime>(
    #[app_handle] app_handle: tauri::AppHandle<R>,
    id: String,
    source: DownloadSource,
  ) -> std::result::Result<DownloadTask, String>;

  #[taurpc(event)]
  async fn task_upsert(event: TaskUpsertEvent);
  #[taurpc(event)]
  async fn task_removed(event: TaskRemovedEvent);
  #[taurpc(event)]
  async fn attention(event: AttentionEvent);
}

#[derive(Clone)]
pub(crate) struct DownloaderApiImpl;

#[taurpc::resolvers]
impl DownloaderApi for DownloaderApiImpl {
  async fn store_secret<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    value: String,
  ) -> std::result::Result<String, String> {
    store_secret(app_handle.state::<CredentialVault>().inner().clone(), value)
      .await
      .map_err(|error| error.to_string())
  }

  async fn delete_secret<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    secret_ref: String,
  ) -> std::result::Result<(), String> {
    delete_secret(
      app_handle.state::<CredentialVault>().inner().clone(),
      secret_ref,
    )
    .await
    .map_err(|error| error.to_string())
  }

  async fn download_ephemeral<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    url: String,
    headers: Option<BTreeMap<String, String>>,
    secret_ref: Option<String>,
    max_bytes: Option<u64>,
  ) -> std::result::Result<Vec<u8>, String> {
    download_ephemeral(
      app_handle.state::<Engine>().inner().clone(),
      app_handle.state::<EphemeralRoot>().inner().clone(),
      url,
      headers,
      secret_ref,
      max_bytes,
    )
    .await
    .map_err(|error| error.to_string())
  }

  async fn list_tasks<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<DownloadTask>, String> {
    list_tasks(app_handle.state::<Engine>().inner().clone())
      .await
      .map_err(|error| error.to_string())
  }

  async fn get_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<Option<DownloadTask>, String> {
    get_task(app_handle.state::<Engine>().inner().clone(), id)
      .await
      .map_err(|error| error.to_string())
  }

  async fn get_task_detail<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTaskDetail, String> {
    get_task_detail(app_handle.state::<Engine>().inner().clone(), id)
      .await
      .map_err(|error| error.to_string())
  }

  async fn get_collections<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<DownloadCollection>, String> {
    get_collections(app_handle.state::<Engine>().inner().clone())
      .await
      .map_err(|error| error.to_string())
  }

  async fn list_destinations<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<Destination>, String> {
    list_destinations(app_handle.state::<Engine>().inner().clone())
      .await
      .map_err(|error| error.to_string())
  }

  async fn get_settings<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<DownloaderSettings, String> {
    get_settings(app_handle.state::<Engine>().inner().clone())
      .await
      .map_err(|error| error.to_string())
  }

  async fn get_capabilities<R: tauri::Runtime>(
    self,
    _app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<DownloaderCapabilities, String> {
    Ok(get_capabilities())
  }

  async fn update_settings<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    settings: DownloaderSettings,
  ) -> std::result::Result<DownloaderSettings, String> {
    update_settings(app_handle.state::<Engine>().inner().clone(), settings)
      .await
      .map_err(|error| error.to_string())
  }

  async fn enqueue_url<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    input: EnqueueUrlInput,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = enqueue_url(engine, app_handle, input).await;
    #[cfg(not(target_os = "android"))]
    let result = enqueue_url(engine, input).await;
    result.map_err(|error| error.to_string())
  }

  async fn enqueue_torrent<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    input: EnqueueTorrentInput,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = enqueue_torrent(engine, app_handle, input).await;
    #[cfg(not(target_os = "android"))]
    let result = enqueue_torrent(engine, input).await;
    result.map_err(|error| error.to_string())
  }

  async fn enqueue_plan<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    input: EnqueuePlanInput,
  ) -> std::result::Result<Vec<DownloadTask>, String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = enqueue_plan(engine, app_handle, input).await;
    #[cfg(not(target_os = "android"))]
    let result = enqueue_plan(engine, input).await;
    result.map_err(|error| error.to_string())
  }

  async fn pause_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    pause_task(app_handle.state::<Engine>().inner().clone(), id)
      .await
      .map_err(|error| error.to_string())
  }

  async fn resume_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = resume_task(engine, app_handle, id).await;
    #[cfg(not(target_os = "android"))]
    let result = resume_task(engine, id).await;
    result.map_err(|error| error.to_string())
  }

  async fn retry_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = retry_task(engine, app_handle, id).await;
    #[cfg(not(target_os = "android"))]
    let result = retry_task(engine, id).await;
    result.map_err(|error| error.to_string())
  }

  async fn cancel_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    cancel_task(app_handle.state::<Engine>().inner().clone(), id)
      .await
      .map_err(|error| error.to_string())
  }

  async fn forget_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<(), String> {
    forget_task(app_handle.state::<Engine>().inner().clone(), id)
      .await
      .map_err(|error| error.to_string())
  }

  async fn delete_task_files<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<(), String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = delete_task_files(engine, app_handle, id).await;
    #[cfg(not(target_os = "android"))]
    let result = delete_task_files(engine, id).await;
    result.map_err(|error| error.to_string())
  }

  async fn set_priority<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
    priority: u8,
  ) -> std::result::Result<DownloadTask, String> {
    set_priority(app_handle.state::<Engine>().inner().clone(), id, priority)
      .await
      .map_err(|error| error.to_string())
  }

  async fn move_queue<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
    before_task_id: Option<String>,
  ) -> std::result::Result<DownloadTask, String> {
    move_queue(
      app_handle.state::<Engine>().inner().clone(),
      id,
      before_task_id,
    )
    .await
    .map_err(|error| error.to_string())
  }

  async fn pick_destination<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Option<Destination>, String> {
    pick_destination(app_handle.state::<Engine>().inner().clone(), app_handle)
      .await
      .map_err(|error| error.to_string())
  }

  async fn update_source<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
    source: DownloadSource,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = app_handle.state::<Engine>().inner().clone();
    #[cfg(target_os = "android")]
    let result = update_source(engine, app_handle, id, source).await;
    #[cfg(not(target_os = "android"))]
    let result = update_source(engine, id, source).await;
    result.map_err(|error| error.to_string())
  }
}

pub(crate) async fn store_secret(credentials: CredentialVault, value: String) -> Result<String> {
  // Wrap before the first await so the IPC-owned allocation is cleared on every exit path.
  let value = Zeroizing::new(value);
  let credentials = credentials.clone();
  tauri::async_runtime::spawn_blocking(move || credentials.store(value.as_str()))
    .await
    .map_err(|_| {
      crate::Error::CredentialStore("native credential worker could not complete".into())
    })?
}

pub(crate) async fn delete_secret(credentials: CredentialVault, secret_ref: String) -> Result<()> {
  let secret_ref = Zeroizing::new(secret_ref);
  let credentials = credentials.clone();
  tauri::async_runtime::spawn_blocking(move || credentials.delete(secret_ref.as_str()))
    .await
    .map_err(|_| {
      crate::Error::CredentialStore("native credential worker could not complete".into())
    })?
}

pub(crate) async fn download_ephemeral(
  engine: Engine,
  temporary_root: EphemeralRoot,
  url: String,
  headers: Option<BTreeMap<String, String>>,
  secret_ref: Option<String>,
  max_bytes: Option<u64>,
) -> Result<Vec<u8>> {
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
  Ok(bytes)
}

#[cfg(target_os = "android")]
async fn schedule_android<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  engine: &Engine,
  task: &DownloadTask,
) -> Result<()> {
  let settings = engine.repository.get_settings().await?;
  let mobile = app.state::<crate::mobile::MobileDownloader<R>>();
  let allow_metered =
    crate::mobile_contract::android_task_allows_metered_network(&task.source, &settings);
  let notification_permission = mobile
    .schedule(task.id.clone(), task.total_bytes, allow_metered)
    .map_err(crate::Error::InvalidInput)?;
  if notification_permission == crate::mobile_contract::AndroidNotificationPermission::Denied {
    let events = DownloaderEventTrigger::new(app.clone());
    let _ = events.attention(crate::AttentionEvent {
      task_id: task.id.clone(),
      code: "notificationPermissionDenied".into(),
      message: "Android notification permission is denied; notification pause and cancel actions are unavailable".into(),
      revision: task.revision,
    });
  }
  Ok(())
}

pub(crate) async fn list_tasks(engine: Engine) -> Result<Vec<DownloadTask>> {
  engine.repository.list_tasks().await
}

pub(crate) async fn get_task(engine: Engine, id: String) -> Result<Option<DownloadTask>> {
  engine.repository.get_task(&id).await
}

pub(crate) async fn get_task_detail(engine: Engine, id: String) -> Result<DownloadTaskDetail> {
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

pub(crate) async fn get_collections(engine: Engine) -> Result<Vec<DownloadCollection>> {
  engine.repository.list_collections().await
}

pub(crate) async fn list_destinations(engine: Engine) -> Result<Vec<Destination>> {
  engine.repository.list_destinations().await
}

pub(crate) async fn get_settings(engine: Engine) -> Result<DownloaderSettings> {
  engine.repository.get_settings().await
}

pub(crate) fn get_capabilities() -> DownloaderCapabilities {
  DownloaderCapabilities::platform()
}

pub(crate) async fn update_settings(
  engine: Engine,
  settings: DownloaderSettings,
) -> Result<DownloaderSettings> {
  engine.update_settings(settings).await
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn enqueue_url(engine: Engine, input: EnqueueUrlInput) -> Result<DownloadTask> {
  engine.enqueue_url(input).await
}

#[cfg(target_os = "android")]
pub(crate) async fn enqueue_url<R: tauri::Runtime>(
  engine: Engine,
  app: tauri::AppHandle<R>,
  input: EnqueueUrlInput,
) -> Result<DownloadTask> {
  let task = engine.enqueue_url(input).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn enqueue_torrent(
  engine: Engine,
  input: EnqueueTorrentInput,
) -> Result<DownloadTask> {
  engine.enqueue_torrent(input).await
}

#[cfg(target_os = "android")]
pub(crate) async fn enqueue_torrent<R: tauri::Runtime>(
  engine: Engine,
  app: tauri::AppHandle<R>,
  input: EnqueueTorrentInput,
) -> Result<DownloadTask> {
  let task = engine.enqueue_torrent(input).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn enqueue_plan(
  engine: Engine,
  input: EnqueuePlanInput,
) -> Result<Vec<DownloadTask>> {
  engine.enqueue_plan(input).await
}

#[cfg(target_os = "android")]
pub(crate) async fn enqueue_plan<R: tauri::Runtime>(
  engine: Engine,
  app: tauri::AppHandle<R>,
  input: EnqueuePlanInput,
) -> Result<Vec<DownloadTask>> {
  let tasks = engine.enqueue_plan(input).await?;
  for task in &tasks {
    schedule_android(&app, &engine, task).await?;
  }
  Ok(tasks)
}

pub(crate) async fn pause_task(engine: Engine, id: String) -> Result<DownloadTask> {
  engine.pause(&id).await
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn resume_task(engine: Engine, id: String) -> Result<DownloadTask> {
  engine.resume(&id).await
}

#[cfg(target_os = "android")]
pub(crate) async fn resume_task<R: tauri::Runtime>(
  engine: Engine,
  app: tauri::AppHandle<R>,
  id: String,
) -> Result<DownloadTask> {
  let task = engine.resume(&id).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn retry_task(engine: Engine, id: String) -> Result<DownloadTask> {
  engine.retry(&id).await
}

#[cfg(target_os = "android")]
pub(crate) async fn retry_task<R: tauri::Runtime>(
  engine: Engine,
  app: tauri::AppHandle<R>,
  id: String,
) -> Result<DownloadTask> {
  let task = engine.retry(&id).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}

pub(crate) async fn cancel_task(engine: Engine, id: String) -> Result<DownloadTask> {
  engine.cancel(&id).await
}

pub(crate) async fn forget_task(engine: Engine, id: String) -> Result<()> {
  engine.forget(&id).await
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn delete_task_files(engine: Engine, id: String) -> Result<()> {
  engine.delete_files(&id).await
}

#[cfg(target_os = "android")]
pub(crate) async fn delete_task_files<R: tauri::Runtime>(
  engine: Engine,
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

pub(crate) async fn set_priority(engine: Engine, id: String, priority: u8) -> Result<DownloadTask> {
  engine.set_priority(&id, priority).await
}

pub(crate) async fn move_queue(
  engine: Engine,
  id: String,
  before_task_id: Option<String>,
) -> Result<DownloadTask> {
  engine.move_queue(&id, before_task_id.as_deref()).await
}

#[cfg(not(target_os = "android"))]
pub(crate) async fn pick_destination<R: tauri::Runtime>(
  engine: Engine,
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
pub(crate) async fn pick_destination<R: tauri::Runtime>(
  engine: Engine,
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
pub(crate) async fn update_source(
  engine: Engine,
  id: String,
  source: DownloadSource,
) -> Result<DownloadTask> {
  engine.update_source(&id, &source).await
}

#[cfg(target_os = "android")]
pub(crate) async fn update_source<R: tauri::Runtime>(
  engine: Engine,
  app: tauri::AppHandle<R>,
  id: String,
  source: DownloadSource,
) -> Result<DownloadTask> {
  let task = engine.update_source(&id, &source).await?;
  schedule_android(&app, &engine, &task).await?;
  Ok(task)
}
