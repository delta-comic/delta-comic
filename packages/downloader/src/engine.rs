use std::{
  collections::{BTreeMap, HashMap, HashSet},
  fs::File,
  path::{Path, PathBuf},
  sync::Arc,
  time::Duration,
};

use reqwest::Client;
use tokio::sync::{Mutex, Notify};
use tokio_util::sync::CancellationToken;
use url::Url;
use uuid::Uuid;

use crate::{
  checksum,
  domain::{
    AttentionEvent, Destination, DestinationKind, DownloadAsset, DownloadSource, DownloadTask,
    DownloaderSettings, EnqueuePlanInput, EnqueueTorrentInput, EnqueueUrlInput, HttpHeaderValue,
    HttpMirror, HttpSource, TaskKind, TaskRemovedEvent, TaskStatus, TaskUpsertEvent, TorrentInput,
    sanitize_file_name, sanitize_relative_path, validate_priority,
  },
  ephemeral::{EphemeralDownloadRequest, download as download_ephemeral},
  error::{Error, Result},
  http,
  persistence::{Repository, now_millis},
  target_file,
  torrent::{TorrentEvent, TorrentManager, TorrentResumeIdentity},
};

#[cfg(not(target_os = "android"))]
const NETWORK_REPROBE_INTERVAL: Duration = Duration::from_secs(15);

#[derive(Debug, Clone)]
pub enum EngineEvent {
  TaskUpsert(Box<TaskUpsertEvent>),
  TaskRemoved(TaskRemovedEvent),
  Attention(AttentionEvent),
}

type EventSink = Arc<dyn Fn(EngineEvent) + Send + Sync>;

#[cfg(any(target_os = "android", test))]
enum BackgroundClaim {
  Claimed(CancellationToken),
  Wait,
  Stopped,
}

#[cfg(any(target_os = "android", test))]
#[derive(Clone)]
pub(crate) struct DirectSafTarget {
  pub file: Arc<File>,
  pub document_uri: String,
}

#[derive(Clone)]
pub struct DownloaderHandle {
  engine: Engine,
}

impl DownloaderHandle {
  pub async fn list_tasks(&self) -> Result<Vec<DownloadTask>> {
    self.engine.repository.list_tasks().await
  }

  pub async fn enqueue_url(&self, input: EnqueueUrlInput) -> Result<DownloadTask> {
    self.engine.enqueue_url(input).await
  }

  pub async fn update_settings(&self, settings: DownloaderSettings) -> Result<DownloaderSettings> {
    self.engine.update_settings(settings).await
  }

  pub async fn has_active_tasks(&self) -> Result<bool> {
    Ok(self.engine.repository.count_active().await? > 0)
  }

  pub async fn checkpoint(&self) -> Result<()> {
    self.engine.repository.checkpoint().await
  }

  pub async fn shutdown(&self) -> Result<()> {
    self.engine.shutdown().await
  }
}

#[derive(Clone)]
pub struct Engine {
  pub(crate) repository: Repository,
  staging_root: PathBuf,
  client: Client,
  torrent: TorrentManager,
  controls: Arc<Mutex<HashMap<String, CancellationToken>>>,
  #[cfg(any(target_os = "android", test))]
  background_stop_generations: Arc<Mutex<HashMap<String, u64>>>,
  workers_changed: Arc<Notify>,
  wake: Arc<Notify>,
  shutdown: CancellationToken,
  events: EventSink,
  secret_resolver: Option<Arc<dyn crate::SecretResolver>>,
}

impl Engine {
  pub async fn open(
    database_path: &Path,
    default_download_dir: &Path,
    secret_resolver: Option<Arc<dyn crate::SecretResolver>>,
    events: impl Fn(EngineEvent) + Send + Sync + 'static,
  ) -> Result<Self> {
    tokio::fs::create_dir_all(default_download_dir).await?;
    let repository = Repository::open(database_path).await?;
    let default_destination = Destination {
      id: "default".into(),
      label: "Downloads".into(),
      kind: DestinationKind::Managed,
      path: default_download_dir.to_string_lossy().into_owned(),
      is_default: true,
    };
    repository
      .initialize(
        &default_destination,
        &DownloaderSettings::platform_default(),
      )
      .await?;
    let client = Client::builder()
      .user_agent(concat!(
        "delta-comic-downloader/",
        env!("CARGO_PKG_VERSION")
      ))
      .redirect(reqwest::redirect::Policy::limited(10))
      .connect_timeout(Duration::from_secs(20))
      .read_timeout(Duration::from_secs(60))
      .build()?;
    let settings = repository.get_settings().await?;
    let torrent = TorrentManager::new(
      default_download_dir.join(".torrent-session"),
      Self::fair_connection_limit(&settings),
    )
    .await?;
    let staging_root = default_download_dir.join(".saf-staging");
    tokio::fs::create_dir_all(&staging_root).await?;
    Ok(Self {
      repository,
      staging_root,
      client,
      torrent,
      controls: Arc::new(Mutex::new(HashMap::new())),
      #[cfg(any(target_os = "android", test))]
      background_stop_generations: Arc::new(Mutex::new(HashMap::new())),
      workers_changed: Arc::new(Notify::new()),
      wake: Arc::new(Notify::new()),
      shutdown: CancellationToken::new(),
      events: Arc::new(events),
      secret_resolver,
    })
  }

  pub fn handle(&self) -> DownloaderHandle {
    DownloaderHandle {
      engine: self.clone(),
    }
  }

  #[cfg(not(target_os = "android"))]
  pub fn start(&self) {
    let engine = self.clone();
    tauri::async_runtime::spawn(async move { engine.dispatch_loop().await });
  }

  pub(crate) async fn download_ephemeral(
    &self,
    temporary_root: &Path,
    request: EphemeralDownloadRequest,
    cancellation: CancellationToken,
  ) -> Result<Vec<u8>> {
    download_ephemeral(
      &self.client,
      self.secret_resolver.as_ref(),
      temporary_root,
      request,
      cancellation,
    )
    .await
  }

  pub async fn enqueue_url(&self, input: EnqueueUrlInput) -> Result<DownloadTask> {
    let parsed = Url::parse(&input.url)?;
    if !matches!(parsed.scheme(), "http" | "https") {
      return Err(Error::InvalidInput("url must use http or https".into()));
    }
    let file_name = parsed
      .path_segments()
      .and_then(|mut segments| segments.next_back())
      .filter(|value| !value.is_empty())
      .map(sanitize_file_name)
      .filter(|value| !value.is_empty())
      .unwrap_or_else(|| "download".into());
    let title = input.title.unwrap_or_else(|| file_name.clone());
    let relative_path =
      sanitize_relative_path(input.relative_path.as_deref().unwrap_or(&file_name))?;
    let mut mirrors = input.mirrors;
    mirrors.push(HttpMirror {
      url: input.url,
      priority: i32::MAX,
      headers: Default::default(),
    });
    let asset = DownloadAsset {
      key: Uuid::new_v4().to_string(),
      relative_path,
      size: None,
      checksum: input.checksum,
      source: DownloadSource::Http(HttpSource {
        mirrors,
        expected_size: None,
        etag: None,
        last_modified: None,
        expires_at: None,
      }),
    };
    self
      .create_task(None, title, asset, input.destination_id, input.priority)
      .await
  }

  pub async fn enqueue_torrent(&self, input: EnqueueTorrentInput) -> Result<DownloadTask> {
    let title = input.title.unwrap_or_else(|| "BitTorrent download".into());
    let default_relative_path = sanitize_file_name(&title);
    let relative_path = sanitize_relative_path(
      input
        .relative_path
        .as_deref()
        .unwrap_or(&default_relative_path),
    )?;
    let asset = DownloadAsset {
      key: Uuid::new_v4().to_string(),
      relative_path,
      size: None,
      checksum: None,
      source: DownloadSource::Torrent(input.source),
    };
    self
      .create_task(None, title, asset, input.destination_id, input.priority)
      .await
  }

  pub async fn enqueue_plan(&self, input: EnqueuePlanInput) -> Result<Vec<DownloadTask>> {
    if input.assets.is_empty() {
      return Err(Error::InvalidInput(
        "download plan contains no assets".into(),
      ));
    }
    let collection_dir = sanitize_file_name(&input.title);
    if collection_dir.is_empty() {
      return Err(Error::InvalidInput(
        "download plan title is not a valid directory name".into(),
      ));
    }
    if input.key.trim().is_empty() {
      return Err(Error::InvalidInput(
        "download plan key must not be empty".into(),
      ));
    }
    let destination_id = input.destination_id.unwrap_or_else(|| "default".into());
    let mut tasks = Vec::with_capacity(input.assets.len());
    let mut asset_keys = HashSet::with_capacity(input.assets.len());
    let mut relative_paths = HashSet::with_capacity(input.assets.len());
    for mut asset in input.assets {
      if asset.key.trim().is_empty() || !asset_keys.insert(asset.key.clone()) {
        return Err(Error::InvalidInput(
          "download plan contains an empty or duplicate asset key".into(),
        ));
      }
      asset.relative_path =
        sanitize_relative_path(&format!("{collection_dir}/{}", asset.relative_path))?;
      if !relative_paths.insert(asset.relative_path.clone()) {
        return Err(Error::InvalidInput(
          "download plan contains duplicate destination paths".into(),
        ));
      }
      let title = asset
        .relative_path
        .rsplit('/')
        .next()
        .map(str::to_string)
        .unwrap_or_else(|| input.title.clone());
      tasks.push(
        self
          .build_task(
            Some(input.key.clone()),
            title,
            asset,
            Some(destination_id.clone()),
            input.priority,
          )
          .await?,
      );
    }
    self
      .repository
      .insert_collection_tasks(
        &input.key,
        &input.title,
        &destination_id,
        input.refresh_context.as_ref(),
        &mut tasks,
      )
      .await?;
    for task in &tasks {
      self.emit_task(task.clone());
    }
    self.wake.notify_one();
    Ok(tasks)
  }

  async fn create_task(
    &self,
    collection_key: Option<String>,
    title: String,
    asset: DownloadAsset,
    destination_id: Option<String>,
    priority: Option<u8>,
  ) -> Result<DownloadTask> {
    let mut task = self
      .build_task(collection_key, title, asset, destination_id, priority)
      .await?;
    self.repository.insert_task(&mut task).await?;
    self.emit_task(task.clone());
    self.wake.notify_one();
    Ok(task)
  }

  async fn build_task(
    &self,
    collection_key: Option<String>,
    title: String,
    asset: DownloadAsset,
    destination_id: Option<String>,
    priority: Option<u8>,
  ) -> Result<DownloadTask> {
    let destination_id = destination_id.unwrap_or_else(|| "default".into());
    let destination = self.repository.destination(&destination_id).await?;
    let id = Uuid::new_v4().to_string();
    let root = match destination.kind {
      DestinationKind::AndroidSaf => self.staging_root.join(&id),
      _ => PathBuf::from(destination.path),
    };
    let relative_path = sanitize_relative_path(&asset.relative_path)?;
    let final_path = root.join(&relative_path);
    if !final_path.starts_with(&root) {
      return Err(Error::InvalidInput(
        "download path escapes its registered destination".into(),
      ));
    }
    let timestamp = now_millis();
    let kind = match &asset.source {
      DownloadSource::Http(_) => TaskKind::Http,
      DownloadSource::Torrent(_) => TaskKind::Torrent,
    };
    let task = DownloadTask {
      id,
      collection_key,
      asset_key: Some(asset.key),
      kind,
      title,
      source: asset.source,
      destination_id,
      relative_path,
      status: TaskStatus::Queued,
      priority: validate_priority(priority.unwrap_or(5))?,
      queue_position: timestamp,
      total_bytes: asset.size,
      downloaded_bytes: 0,
      speed_bytes_per_second: 0,
      error_code: None,
      error_message: None,
      checksum: asset.checksum,
      etag: None,
      last_modified: None,
      final_path: Some(final_path.to_string_lossy().into_owned()),
      retry_count: 0,
      created_at: timestamp,
      updated_at: timestamp,
      revision: 0,
    };
    Ok(task)
  }

  pub async fn pause(&self, id: &str) -> Result<DownloadTask> {
    if let Some(control) = self.controls.lock().await.get(id) {
      control.cancel();
    }
    let task = self.repository.pause_task(id).await?;
    self.emit_task(task.clone());
    Ok(task)
  }

  pub async fn resume(&self, id: &str) -> Result<DownloadTask> {
    let task = self.repository.resume_task(id).await?;
    self.emit_task(task.clone());
    self.wake.notify_one();
    Ok(task)
  }

  pub async fn retry(&self, id: &str) -> Result<DownloadTask> {
    let task = self.repository.retry_task(id).await?;
    self.emit_task(task.clone());
    self.wake.notify_one();
    Ok(task)
  }

  pub async fn update_source(&self, id: &str, source: &DownloadSource) -> Result<DownloadTask> {
    let task = self.repository.update_source(id, source).await?;
    self.emit_task(task.clone());
    self.wake.notify_one();
    Ok(task)
  }

  pub async fn set_priority(&self, id: &str, priority: u8) -> Result<DownloadTask> {
    let task = self
      .repository
      .set_priority(id, validate_priority(priority)?)
      .await?;
    self.emit_task(task.clone());
    self.wake.notify_one();
    Ok(task)
  }

  pub async fn move_queue(&self, id: &str, before_task_id: Option<&str>) -> Result<DownloadTask> {
    let task = self.repository.move_queue(id, before_task_id).await?;
    self.emit_task(task.clone());
    self.wake.notify_one();
    Ok(task)
  }

  pub async fn update_settings(
    &self,
    mut settings: DownloaderSettings,
  ) -> Result<DownloaderSettings> {
    self.repository.update_settings(&mut settings).await?;
    self.wake.notify_one();
    Ok(settings)
  }

  pub async fn cancel(&self, id: &str) -> Result<DownloadTask> {
    if let Some(control) = self.controls.lock().await.get(id) {
      control.cancel();
    }
    let task = self.repository.cancel_task(id).await?;
    self.emit_task(task.clone());
    Ok(task)
  }

  pub async fn forget(&self, id: &str) -> Result<()> {
    if self.controls.lock().await.contains_key(id) {
      return Err(Error::InvalidInput(
        "pause an active task before forgetting it".into(),
      ));
    }
    let task = self
      .repository
      .get_task(id)
      .await?
      .ok_or_else(|| Error::NotFound(id.into()))?;
    if matches!(task.source, DownloadSource::Torrent(_)) {
      self.remove_torrent_session(id, false).await?;
    }
    let revision = self.repository.forget(id).await?;
    (self.events)(EngineEvent::TaskRemoved(TaskRemovedEvent {
      task_id: id.into(),
      revision,
    }));
    Ok(())
  }

  #[cfg(not(target_os = "android"))]
  pub async fn delete_files(&self, id: &str) -> Result<()> {
    self
      .delete_files_with_external(id, |_destination, _export| Ok(()))
      .await
  }

  pub(crate) async fn delete_files_with_external<F>(&self, id: &str, external: F) -> Result<()>
  where
    F: FnOnce(&Destination, Option<&crate::persistence::SafExportRecord>) -> Result<()>,
  {
    let task = self
      .repository
      .get_task(id)
      .await?
      .ok_or_else(|| Error::NotFound(id.into()))?;
    if task.status.is_active() {
      return Err(Error::InvalidInput(
        "pause an active task before deleting its files".into(),
      ));
    }
    let Some(_control) = self.try_claim_control(id).await else {
      return Err(Error::InvalidInput(
        "pause an active task before deleting its files".into(),
      ));
    };

    let result = async {
      let destination = self.repository.destination(&task.destination_id).await?;
      let export = self.repository.saf_export_record(id).await?;
      external(&destination, export.as_ref())?;
      let root = match destination.kind {
        DestinationKind::AndroidSaf => self.staging_root.join(&task.id),
        _ => PathBuf::from(destination.path),
      };
      if matches!(task.source, DownloadSource::Torrent(_)) {
        self.remove_torrent_session(id, true).await?;
      }
      if let Some(final_path) = task.final_path.map(PathBuf::from) {
        if !final_path.starts_with(&root) {
          return Err(Error::InvalidInput(
            "stored task path escapes its destination".into(),
          ));
        }
        remove_path_if_exists(&final_path).await?;
        remove_path_if_exists(PathBuf::from(format!("{}.part", final_path.display())).as_path())
          .await?;
      }
      let reset = self.repository.reset_after_file_deletion(id).await?;
      self.emit_task(reset);
      Ok(())
    }
    .await;

    self.controls.lock().await.remove(id);
    self.workers_changed.notify_waiters();
    self.wake.notify_one();
    result
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn complete_saf_export(&self, id: &str, document_uri: &str) -> Result<()> {
    let record = self
      .repository
      .saf_export_record(id)
      .await?
      .ok_or_else(|| Error::InvalidInput("SAF export record is missing".into()))?;
    let completed = self
      .repository
      .complete_saf_export(id, document_uri)
      .await?;
    self.emit_task(completed);
    let task_root = self.staging_root.join(id);
    if Path::new(&record.staging_path).starts_with(&task_root)
      && let Err(error) = remove_path_if_exists(&task_root).await
    {
      tracing::warn!("completed SAF staging cleanup failed for task {id}: {error}");
    }
    Ok(())
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn resume_saf_commit(&self, id: &str) -> Result<()> {
    if !self.repository.has_pending_saf_commit(id).await? {
      return Err(Error::InvalidInput("SAF commit is not pending".into()));
    }
    let task = self
      .repository
      .get_task(id)
      .await?
      .ok_or_else(|| Error::NotFound(id.into()))?;
    if task.status.is_active() {
      return Ok(());
    }
    let verifying = self.repository.resume_pending_export(id).await?;
    self.emit_task(verifying);
    Ok(())
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn abandon_direct_saf_transfer(&self, id: &str) -> Result<()> {
    self.repository.abandon_direct_saf_transfer(id).await
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn fail_saf_export(&self, id: &str, message: &str) -> Result<()> {
    let failed = self.repository.fail_saf_export(id, message).await?;
    let attention = AttentionEvent {
      task_id: id.into(),
      code: "destinationExport".into(),
      message: message.into(),
      revision: failed.revision,
    };
    self.emit_task(failed);
    (self.events)(EngineEvent::Attention(attention));
    Ok(())
  }

  async fn remove_torrent_session(&self, id: &str, delete_files: bool) -> Result<()> {
    let Some(identity) = self.repository.torrent_session_identity(id).await? else {
      return Ok(());
    };
    self
      .torrent
      .remove(
        identity.session_id,
        identity.info_hash.as_deref(),
        delete_files,
      )
      .await
  }

  pub async fn shutdown(&self) -> Result<()> {
    self.shutdown.cancel();
    for token in self.controls.lock().await.values() {
      token.cancel();
    }
    self.wait_for_workers().await;

    let mut first_error = None;
    match self.repository.list_tasks().await {
      Ok(tasks) => {
        for task in tasks.into_iter().filter(|task| task.status.is_active()) {
          if let Err(error) = self.repository.requeue_after_system_stop(&task.id).await
            && first_error.is_none()
          {
            first_error = Some(error);
          }
        }
      }
      Err(error) => first_error = Some(error),
    }
    if let Err(error) = self.torrent.stop().await
      && first_error.is_none()
    {
      first_error = Some(error);
    }
    let checkpoint = self.repository.checkpoint().await;
    match (first_error, checkpoint) {
      (Some(error), _) => Err(error),
      (None, result) => result,
    }
  }

  async fn wait_for_workers(&self) {
    loop {
      let notified = self.workers_changed.notified();
      tokio::pin!(notified);
      notified.as_mut().enable();
      if self.controls.lock().await.is_empty() {
        return;
      }
      notified.await;
    }
  }

  #[cfg(not(target_os = "android"))]
  async fn dispatch_loop(self) {
    #[cfg(not(target_os = "android"))]
    let mut next_network_reprobe = tokio::time::Instant::now() + NETWORK_REPROBE_INTERVAL;
    loop {
      tokio::select! {
        () = self.shutdown.cancelled() => break,
        () = self.wake.notified() => {},
        () = tokio::time::sleep(Duration::from_millis(500)) => {},
      }
      if self.shutdown.is_cancelled() {
        break;
      }
      #[cfg(not(target_os = "android"))]
      if tokio::time::Instant::now() >= next_network_reprobe {
        let interval_millis =
          i64::try_from(NETWORK_REPROBE_INTERVAL.as_millis()).unwrap_or(i64::MAX);
        match self
          .repository
          .requeue_due_network_tasks(now_millis().saturating_sub(interval_millis), 20)
          .await
        {
          Ok(tasks) => {
            for task in tasks {
              self.emit_task(task);
            }
          }
          Err(error) => tracing::warn!("network recovery probe could not requeue tasks: {error}"),
        }
        next_network_reprobe = tokio::time::Instant::now() + NETWORK_REPROBE_INTERVAL;
      }
      let settings = match self.repository.get_settings().await {
        Ok(settings) => settings,
        Err(error) => {
          tracing::error!("downloader scheduler could not read settings: {error}");
          continue;
        }
      };
      if let Ok(tasks) = self.repository.list_tasks().await {
        for task in tasks.into_iter().filter(|task| task.status.is_active()) {
          self.emit_task(task);
        }
      }
      let active = self.controls.lock().await.len();
      let effective_task_limit = Self::effective_task_limit(&settings);
      let available = effective_task_limit.saturating_sub(active);
      if available == 0 {
        continue;
      }
      let queued = match self.repository.next_queued(available).await {
        Ok(tasks) => tasks,
        Err(error) => {
          tracing::error!("downloader scheduler could not read queue: {error}");
          continue;
        }
      };
      for task in queued {
        let Some(token) = self.try_claim_control(&task.id).await else {
          continue;
        };
        let engine = self.clone();
        let mut task_settings = settings.clone();
        task_settings.per_task_connections = Self::fair_connection_limit(&settings);
        tauri::async_runtime::spawn(async move {
          engine.run_task(task, task_settings, token).await;
        });
      }
    }
  }

  #[cfg(not(target_os = "android"))]
  async fn run_task(
    &self,
    task: DownloadTask,
    settings: DownloaderSettings,
    token: CancellationToken,
  ) {
    let result = self.run_task_inner(&task, &settings, token, None).await;
    match result {
      Ok(()) => {
        if let Err(error) = self.complete_task_if_active(&task.id).await {
          tracing::error!(
            "download task {} could not commit completion: {error}",
            task.id
          );
        }
      }
      Err(error) => {
        if self.shutdown.is_cancelled() && matches!(&error, Error::Cancelled) {
          self.controls.lock().await.remove(&task.id);
          self.workers_changed.notify_waiters();
          self.wake.notify_one();
          return;
        }
        let current = self.repository.get_task(&task.id).await.ok().flatten();
        if !current.is_some_and(|value| Self::should_preserve_external_status(value.status))
          && let Ok(failed) = self.repository.set_failure(&task.id, &error).await
        {
          let attention = AttentionEvent {
            task_id: failed.id.clone(),
            code: error.code().into(),
            message: error.to_string(),
            revision: failed.revision,
          };
          self.emit_task(failed);
          (self.events)(EngineEvent::Attention(attention));
        }
      }
    }
    self.controls.lock().await.remove(&task.id);
    self.workers_changed.notify_waiters();
    self.wake.notify_one();
  }

  async fn try_claim_control(&self, id: &str) -> Option<CancellationToken> {
    self.try_claim_control_with_limit(id, usize::MAX).await
  }

  async fn try_claim_control_with_limit(
    &self,
    id: &str,
    task_limit: usize,
  ) -> Option<CancellationToken> {
    let mut controls = self.controls.lock().await;
    if self.shutdown.is_cancelled() || controls.contains_key(id) || controls.len() >= task_limit {
      return None;
    }
    let token = self.shutdown.child_token();
    controls.insert(id.into(), token.clone());
    Some(token)
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn run_task_now(&self, id: &str) -> Result<()> {
    self.run_task_now_with_target(id, None).await
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn run_task_now_with_direct_saf(
    &self,
    id: &str,
    target: DirectSafTarget,
  ) -> Result<()> {
    self
      .repository
      .begin_direct_saf_transfer(id, &target.document_uri)
      .await?;
    self.run_task_now_with_target(id, Some(target)).await
  }

  #[cfg(any(target_os = "android", test))]
  async fn run_task_now_with_target(
    &self,
    id: &str,
    direct_target: Option<DirectSafTarget>,
  ) -> Result<()> {
    let mut direct_abandoned = false;
    let stop_generation = self.background_stop_generation(id).await;
    self.prepare_background_task(id).await?;
    loop {
      let task = self
        .repository
        .get_task(id)
        .await?
        .ok_or_else(|| Error::NotFound(id.into()))?;
      if task.status == TaskStatus::Completed {
        return Ok(());
      }
      if !Self::should_wait_for_controlled_task(task.status) {
        return Err(Self::background_task_stopped(task.status));
      }
      if direct_target.is_none() && !direct_abandoned {
        self.repository.abandon_direct_saf_transfer(id).await?;
        direct_abandoned = true;
      }
      if direct_target.is_none()
        && let Some(export) = self.repository.pending_saf_export(id).await?
      {
        if tokio::fs::try_exists(&export.staging_path).await? {
          if task.status != TaskStatus::Verifying {
            let verifying = self.repository.resume_pending_export(id).await?;
            self.emit_task(verifying);
          }
          return Ok(());
        }
        self.repository.clear_saf_export(id).await?;
      }

      let mut settings = self.repository.get_settings().await?;
      let (task_limit, per_task_connections) = Self::background_resource_limits(&settings);
      let token = match self
        .try_claim_background_control(id, task_limit, stop_generation)
        .await
      {
        BackgroundClaim::Claimed(token) => token,
        BackgroundClaim::Stopped => return Err(Error::Cancelled),
        BackgroundClaim::Wait => {
          tokio::select! {
            () = self.shutdown.cancelled() => return Err(Error::Cancelled),
            () = self.workers_changed.notified() => {},
            () = tokio::time::sleep(Duration::from_millis(250)) => {},
          }
          continue;
        }
      };
      settings.per_task_connections = per_task_connections;
      let result = self
        .run_task_inner(&task, &settings, token, direct_target.clone())
        .await;
      let outcome = self.finish_task_now(id, result).await;
      self.controls.lock().await.remove(id);
      self.workers_changed.notify_waiters();
      self.wake.notify_one();
      return outcome;
    }
  }

  #[cfg(any(target_os = "android", test))]
  fn background_resource_limits(settings: &DownloaderSettings) -> (usize, u8) {
    (
      Self::effective_task_limit(settings),
      Self::fair_connection_limit(settings),
    )
  }

  fn effective_task_limit(settings: &DownloaderSettings) -> usize {
    usize::from(settings.max_active_tasks)
      .min(usize::from(settings.connection_budget))
      .max(1)
  }

  fn fair_connection_limit(settings: &DownloaderSettings) -> u8 {
    let task_limit = Self::effective_task_limit(settings);
    let fair_share =
      (settings.connection_budget / u16::try_from(task_limit).unwrap_or(u16::MAX)).max(1) as u8;
    settings.per_task_connections.min(fair_share).max(1)
  }

  #[cfg(any(target_os = "android", test))]
  async fn background_stop_generation(&self, id: &str) -> u64 {
    self
      .background_stop_generations
      .lock()
      .await
      .get(id)
      .copied()
      .unwrap_or(0)
  }

  #[cfg(any(target_os = "android", test))]
  async fn try_claim_background_control(
    &self,
    id: &str,
    task_limit: usize,
    expected_stop_generation: u64,
  ) -> BackgroundClaim {
    let generations = self.background_stop_generations.lock().await;
    if generations.get(id).copied().unwrap_or(0) != expected_stop_generation {
      return BackgroundClaim::Stopped;
    }
    let mut controls = self.controls.lock().await;
    if self.shutdown.is_cancelled() {
      return BackgroundClaim::Stopped;
    }
    if controls.contains_key(id) || controls.len() >= task_limit {
      return BackgroundClaim::Wait;
    }
    let token = self.shutdown.child_token();
    controls.insert(id.into(), token.clone());
    BackgroundClaim::Claimed(token)
  }

  #[cfg(any(target_os = "android", test))]
  async fn prepare_background_task(&self, id: &str) -> Result<()> {
    if let Some(queued) = self.repository.requeue_waiting_for_network(id).await? {
      self.emit_task(queued);
    }
    Ok(())
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn system_stop_task(&self, id: &str) -> Result<()> {
    let mut generations = self.background_stop_generations.lock().await;
    let generation = generations.entry(id.to_owned()).or_default();
    *generation = generation.saturating_add(1);
    if let Some(control) = self.controls.lock().await.get(id).cloned() {
      control.cancel();
    }
    drop(generations);
    self.workers_changed.notify_waiters();
    if let Some(queued) = self.repository.requeue_after_system_stop(id).await? {
      self.emit_task(queued);
    }
    self.repository.checkpoint().await
  }

  #[cfg(any(target_os = "android", test))]
  async fn finish_task_now(&self, id: &str, result: Result<()>) -> Result<()> {
    match result {
      Ok(()) => {
        if self.repository.has_pending_saf_commit(id).await? {
          let current = self
            .repository
            .get_task(id)
            .await?
            .ok_or_else(|| Error::NotFound(id.into()))?;
          if Self::should_preserve_external_status(current.status) {
            return Err(Self::background_task_stopped(current.status));
          }
          return Ok(());
        }
        if self.complete_task_if_active(id).await? {
          Ok(())
        } else {
          let current = self
            .repository
            .get_task(id)
            .await?
            .ok_or_else(|| Error::NotFound(id.into()))?;
          Err(Self::background_task_stopped(current.status))
        }
      }
      Err(error) => {
        if self.shutdown.is_cancelled() && matches!(&error, Error::Cancelled) {
          return Err(error);
        }
        let current = self
          .repository
          .get_task(id)
          .await?
          .ok_or_else(|| Error::NotFound(id.into()))?;
        if Self::should_preserve_external_status(current.status) {
          return Err(error);
        }
        let failed = self.repository.set_failure(id, &error).await?;
        self.emit_task(failed);
        Err(error)
      }
    }
  }

  #[cfg(any(target_os = "android", test))]
  fn should_wait_for_controlled_task(status: TaskStatus) -> bool {
    status == TaskStatus::Queued || status.is_active()
  }

  #[cfg(any(target_os = "android", test))]
  fn background_task_stopped(status: TaskStatus) -> Error {
    Error::InvalidInput(format!(
      "background task stopped with status {}",
      status.as_db()
    ))
  }

  fn should_preserve_external_status(status: TaskStatus) -> bool {
    !status.is_active()
  }

  async fn complete_task_if_active(&self, id: &str) -> Result<bool> {
    let Some(completed) = self.repository.complete_if_active(id).await? else {
      return Ok(false);
    };
    self.emit_task(completed);
    Ok(true)
  }

  async fn run_task_inner(
    &self,
    task: &DownloadTask,
    settings: &DownloaderSettings,
    token: CancellationToken,
    #[cfg(any(target_os = "android", test))] direct_target: Option<DirectSafTarget>,
    #[cfg(not(any(target_os = "android", test)))] _direct_target: Option<()>,
  ) -> Result<()> {
    if token.is_cancelled() {
      return Err(Error::Cancelled);
    }
    let probing = self.repository.begin_probe(&task.id).await?;
    self.emit_task(probing);
    let final_path = task
      .final_path
      .as_ref()
      .map(PathBuf::from)
      .ok_or_else(|| Error::InvalidInput("task has no destination path".into()))?;
    let temp_path = PathBuf::from(format!("{}.part", final_path.display()));
    #[cfg(any(target_os = "android", test))]
    let is_direct_saf = direct_target.is_some();
    #[cfg(not(any(target_os = "android", test)))]
    let is_direct_saf = false;
    #[cfg(any(target_os = "android", test))]
    let direct_file = direct_target.as_ref().map(|target| target.file.clone());
    #[cfg(not(any(target_os = "android", test)))]
    let direct_file: Option<Arc<File>> = None;
    if is_direct_saf && !matches!(task.source, DownloadSource::Http(_)) {
      return Err(Error::InvalidInput(
        "direct SAF targets support HTTP tasks only".into(),
      ));
    }
    self
      .repository
      .set_paths(&task.id, &final_path, &temp_path)
      .await?;
    if !is_direct_saf && let Some(parent) = final_path.parent() {
      tokio::fs::create_dir_all(parent).await?;
    }

    let torrent_report = match &task.source {
      DownloadSource::Http(source) => {
        let mut attempts = 0_u8;
        loop {
          match http::download(
            &self.client,
            http::DownloadRequest {
              repository: &self.repository,
              task,
              source,
              settings,
              temp_path: &temp_path,
              target_file: direct_file.clone(),
              cancellation: token.clone(),
              secret_resolver: self.secret_resolver.as_deref(),
              maximum_bytes: None,
              progress: Some({
                let engine = self.clone();
                Arc::new(move |task| engine.emit_task(task))
              }),
            },
          )
          .await
          {
            Ok(report) => {
              tracing::info!(
                "download task {} transferred {} bytes in {:?}",
                task.id,
                report.total_bytes,
                report.elapsed
              );
              break;
            }
            Err(error) if error.is_connectivity_loss() => return Err(error),
            Err(error) if error.is_transient() && attempts < 5 => {
              attempts += 1;
              if let Ok(retrying) = self
                .repository
                .record_retry(&task.id, attempts, &error)
                .await
              {
                self.emit_task(retrying);
              }
              let delay = Duration::from_secs(1_u64 << (attempts - 1)).max(error.retry_after());
              let jitter = rand::random_range(0..=500);
              tokio::select! {
                () = token.cancelled() => return Err(Error::Cancelled),
                () = tokio::time::sleep(delay + Duration::from_millis(jitter)) => {},
              }
              tracing::warn!(
                "retrying download task {} after transient error: {error}",
                task.id
              );
            }
            Err(error) => return Err(error),
          }
        }
        None
      }
      DownloadSource::Torrent(source) => {
        let resume_identity = self
          .repository
          .torrent_session_identity(&task.id)
          .await?
          .map(|identity| TorrentResumeIdentity {
            session_id: identity.session_id,
            info_hash: identity.info_hash,
          });
        let repository = self.repository.clone();
        let events = self.events.clone();
        let task_id = task.id.clone();
        let torrent_events = Arc::new(move |event| {
          let repository = repository.clone();
          let events = events.clone();
          let task_id = task_id.clone();
          Box::pin(async move {
            let (status, seed_started_at, sample) = match event {
              TorrentEvent::Initialized(sample) | TorrentEvent::Progress(sample) => {
                (TaskStatus::Downloading, None, sample)
              }
              TorrentEvent::Seeding(sample) => (TaskStatus::Seeding, Some(now_millis()), sample),
            };
            repository
              .update_torrent_session(
                &task_id,
                sample.info_hash.as_deref(),
                sample.session_id,
                sample.uploaded_bytes,
                sample.peer_count,
                seed_started_at,
              )
              .await?;
            let task = repository
              .update_transfer_progress(
                &task_id,
                status,
                sample.total_bytes,
                sample.downloaded_bytes,
                sample.speed_bytes_per_second,
              )
              .await?;
            let task = Engine::event_snapshot(task);
            let revision = task.revision;
            events(EngineEvent::TaskUpsert(Box::new(TaskUpsertEvent {
              task,
              revision,
            })));
            Ok(())
          }) as futures_util::future::BoxFuture<'static, Result<()>>
        });
        let report = self
          .torrent
          .download(
            task,
            source,
            settings,
            resume_identity.as_ref(),
            &final_path,
            token.clone(),
            torrent_events,
          )
          .await?;
        Some(report)
      }
    };

    if let Some(checksum) = &task.checksum {
      let verifying = self.repository.begin_verification(&task.id).await?;
      self.emit_task(verifying);
      if let Some(file) = &direct_file {
        checksum::verify_file(file, checksum).await?;
      } else {
        let checksum_path = match &torrent_report {
          Some(report) => report.checksum_path()?,
          None => temp_path.as_path(),
        };
        checksum::verify(checksum_path, checksum).await?;
      }
    }
    if matches!(task.source, DownloadSource::Http(_)) && !is_direct_saf {
      target_file::replace(&temp_path, &final_path).await?;
    }
    let destination = self.repository.destination(&task.destination_id).await?;
    if destination.kind == DestinationKind::AndroidSaf {
      #[cfg(any(target_os = "android", test))]
      if let Some(target) = direct_target {
        target.file.sync_all()?;
        self
          .repository
          .mark_direct_saf_ready(&task.id, &target.document_uri)
          .await?;
      } else {
        self
          .repository
          .upsert_pending_saf_export(&task.id, &task.destination_id, &final_path)
          .await?;
      }
      #[cfg(not(any(target_os = "android", test)))]
      self
        .repository
        .upsert_pending_saf_export(&task.id, &task.destination_id, &final_path)
        .await?;
    }
    Ok(())
  }

  fn emit_task(&self, task: DownloadTask) {
    let task = Self::event_snapshot(task);
    let revision = task.revision;
    (self.events)(EngineEvent::TaskUpsert(Box::new(TaskUpsertEvent {
      task,
      revision,
    })));
  }

  fn event_snapshot(mut task: DownloadTask) -> DownloadTask {
    const REDACTED: &str = "[redacted]";

    task.final_path = None;
    match &mut task.source {
      DownloadSource::Http(source) => {
        for mirror in &mut source.mirrors {
          mirror.url = REDACTED.into();
          let mut headers = BTreeMap::new();
          for value in mirror.headers.values() {
            match value {
              HttpHeaderValue::Value { .. } => {
                headers.insert(
                  "[redacted-value-header]".into(),
                  HttpHeaderValue::Value {
                    value: REDACTED.into(),
                  },
                );
              }
              HttpHeaderValue::SecretRef { .. } => {
                headers.insert(
                  "[redacted-secret-header]".into(),
                  HttpHeaderValue::SecretRef {
                    secret_ref: REDACTED.into(),
                  },
                );
              }
            }
          }
          mirror.headers = headers;
        }
      }
      DownloadSource::Torrent(source) => match &mut source.input {
        TorrentInput::Magnet { uri } => *uri = REDACTED.into(),
        TorrentInput::Url { url } => *url = REDACTED.into(),
        TorrentInput::Bytes { base64 } => *base64 = REDACTED.into(),
      },
    }
    task
  }
}

async fn remove_path_if_exists(path: &Path) -> Result<()> {
  let metadata = match tokio::fs::symlink_metadata(path).await {
    Ok(metadata) => metadata,
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
    Err(error) => return Err(error.into()),
  };
  if metadata.is_dir() {
    tokio::fs::remove_dir_all(path).await?;
  } else {
    tokio::fs::remove_file(path).await?;
  }
  Ok(())
}

#[cfg(test)]
#[path = "../test/src/engine.rs"]
mod tests;
