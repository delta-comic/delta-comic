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

fn engine<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> Engine {
  app_handle.state::<Engine>().inner().clone()
}

fn credentials<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) -> CredentialVault {
  app_handle.state::<CredentialVault>().inner().clone()
}

fn ipc<T>(result: Result<T>) -> std::result::Result<T, String> {
  result.map_err(|error| error.to_string())
}

/// Hands newly runnable tasks to the Android foreground service; a no-op elsewhere.
#[cfg_attr(not(target_os = "android"), allow(unused_variables))]
async fn schedule<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  engine: &Engine,
  tasks: &[DownloadTask],
) -> Result<()> {
  #[cfg(target_os = "android")]
  for task in tasks {
    schedule_android(app, engine, task).await?;
  }
  Ok(())
}

async fn scheduled<R: tauri::Runtime>(
  app: &tauri::AppHandle<R>,
  engine: &Engine,
  task: Result<DownloadTask>,
) -> std::result::Result<DownloadTask, String> {
  let task = ipc(task)?;
  ipc(schedule(app, engine, std::slice::from_ref(&task)).await)?;
  Ok(task)
}

#[taurpc::resolvers]
impl DownloaderApi for DownloaderApiImpl {
  async fn store_secret<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    value: String,
  ) -> std::result::Result<String, String> {
    // Wrap before the first await so the IPC-owned allocation is cleared on every exit path.
    let value = Zeroizing::new(value);
    let credentials = credentials(&app_handle);
    ipc(
      tauri::async_runtime::spawn_blocking(move || credentials.store(value.as_str()))
        .await
        .map_err(|_| credential_worker_error())
        .and_then(|result| result),
    )
  }

  async fn delete_secret<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    secret_ref: String,
  ) -> std::result::Result<(), String> {
    let secret_ref = Zeroizing::new(secret_ref);
    let credentials = credentials(&app_handle);
    ipc(
      tauri::async_runtime::spawn_blocking(move || credentials.delete(secret_ref.as_str()))
        .await
        .map_err(|_| credential_worker_error())
        .and_then(|result| result),
    )
  }

  async fn download_ephemeral<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    url: String,
    headers: Option<BTreeMap<String, String>>,
    secret_ref: Option<String>,
    max_bytes: Option<u64>,
  ) -> std::result::Result<Vec<u8>, String> {
    let temporary_root = app_handle.state::<EphemeralRoot>();
    ipc(
      engine(&app_handle)
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
        .await,
    )
  }

  async fn list_tasks<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<DownloadTask>, String> {
    ipc(engine(&app_handle).repository.list_tasks().await)
  }

  async fn get_task_detail<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTaskDetail, String> {
    ipc(get_task_detail(&engine(&app_handle), id).await)
  }

  async fn get_collections<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<DownloadCollection>, String> {
    ipc(engine(&app_handle).repository.list_collections().await)
  }

  async fn list_destinations<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Vec<Destination>, String> {
    ipc(engine(&app_handle).repository.list_destinations().await)
  }

  async fn get_settings<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<DownloaderSettings, String> {
    ipc(engine(&app_handle).repository.get_settings().await)
  }

  async fn get_capabilities<R: tauri::Runtime>(
    self,
    _app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<DownloaderCapabilities, String> {
    Ok(DownloaderCapabilities::platform())
  }

  async fn update_settings<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    settings: DownloaderSettings,
  ) -> std::result::Result<DownloaderSettings, String> {
    ipc(engine(&app_handle).update_settings(settings).await)
  }

  async fn enqueue_url<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    input: EnqueueUrlInput,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = engine(&app_handle);
    scheduled(&app_handle, &engine, engine.enqueue_url(input).await).await
  }

  async fn enqueue_torrent<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    input: EnqueueTorrentInput,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = engine(&app_handle);
    scheduled(&app_handle, &engine, engine.enqueue_torrent(input).await).await
  }

  async fn enqueue_plan<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    input: EnqueuePlanInput,
  ) -> std::result::Result<Vec<DownloadTask>, String> {
    let engine = engine(&app_handle);
    let tasks = ipc(engine.enqueue_plan(input).await)?;
    ipc(schedule(&app_handle, &engine, &tasks).await)?;
    Ok(tasks)
  }

  async fn pause_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    ipc(engine(&app_handle).pause(&id).await)
  }

  async fn resume_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = engine(&app_handle);
    scheduled(&app_handle, &engine, engine.resume(&id).await).await
  }

  async fn retry_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = engine(&app_handle);
    scheduled(&app_handle, &engine, engine.retry(&id).await).await
  }

  async fn cancel_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<DownloadTask, String> {
    ipc(engine(&app_handle).cancel(&id).await)
  }

  async fn forget_task<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<(), String> {
    ipc(engine(&app_handle).forget(&id).await)
  }

  async fn delete_task_files<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
  ) -> std::result::Result<(), String> {
    let engine = engine(&app_handle);
    #[cfg(target_os = "android")]
    let result = delete_task_files(engine, app_handle, id).await;
    #[cfg(not(target_os = "android"))]
    let result = engine.delete_files(&id).await;
    ipc(result)
  }

  async fn set_priority<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
    priority: u8,
  ) -> std::result::Result<DownloadTask, String> {
    ipc(engine(&app_handle).set_priority(&id, priority).await)
  }

  async fn move_queue<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
    before_task_id: Option<String>,
  ) -> std::result::Result<DownloadTask, String> {
    ipc(
      engine(&app_handle)
        .move_queue(&id, before_task_id.as_deref())
        .await,
    )
  }

  async fn pick_destination<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
  ) -> std::result::Result<Option<Destination>, String> {
    ipc(pick_destination(engine(&app_handle), app_handle).await)
  }

  async fn update_source<R: tauri::Runtime>(
    self,
    app_handle: tauri::AppHandle<R>,
    id: String,
    source: DownloadSource,
  ) -> std::result::Result<DownloadTask, String> {
    let engine = engine(&app_handle);
    scheduled(
      &app_handle,
      &engine,
      engine.update_source(&id, &source).await,
    )
    .await
  }
}

fn credential_worker_error() -> crate::Error {
  crate::Error::CredentialStore("native credential worker could not complete".into())
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

async fn get_task_detail(engine: &Engine, id: String) -> Result<DownloadTaskDetail> {
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

#[cfg(target_os = "android")]
async fn delete_task_files<R: tauri::Runtime>(
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

#[cfg(not(target_os = "android"))]
async fn pick_destination<R: tauri::Runtime>(
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
async fn pick_destination<R: tauri::Runtime>(
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
