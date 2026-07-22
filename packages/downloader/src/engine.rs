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
      log::warn!("completed SAF staging cleanup failed for task {id}: {error}");
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
          Err(error) => log::warn!("network recovery probe could not requeue tasks: {error}"),
        }
        next_network_reprobe = tokio::time::Instant::now() + NETWORK_REPROBE_INTERVAL;
      }
      let settings = match self.repository.get_settings().await {
        Ok(settings) => settings,
        Err(error) => {
          log::error!("downloader scheduler could not read settings: {error}");
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
          log::error!("downloader scheduler could not read queue: {error}");
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
          log::error!(
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
            },
          )
          .await
          {
            Ok(report) => {
              log::info!(
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
              log::warn!(
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
mod tests {
  use std::{
    collections::BTreeMap,
    fs::OpenOptions,
    path::PathBuf,
    sync::{Arc, Mutex as StdMutex},
    time::Duration,
  };

  use tempfile::TempDir;
  use tokio::time::timeout;
  use tokio_util::sync::CancellationToken;

  use super::{BackgroundClaim, DirectSafTarget, Engine, EngineEvent};
  #[cfg(feature = "bittorrent")]
  use crate::domain::{Checksum, ChecksumAlgorithm};
  use crate::{
    domain::{
      ContentRefreshContext, Destination, DestinationKind, DownloadAsset, DownloadSource,
      EnqueuePlanInput, HttpHeaderValue, HttpMirror, HttpSource, TaskStatus, TorrentInput,
      TorrentSource,
    },
    error::Error,
    persistence::CompletedRange,
  };

  fn asset(key: &str, relative_path: &str, size: u64) -> DownloadAsset {
    DownloadAsset {
      key: key.into(),
      relative_path: relative_path.into(),
      size: Some(size),
      checksum: None,
      source: DownloadSource::Http(HttpSource {
        mirrors: vec![HttpMirror {
          url: "https://example.invalid/file".into(),
          priority: 0,
          headers: BTreeMap::new(),
        }],
        expected_size: Some(size),
        etag: None,
        last_modified: None,
        expires_at: None,
      }),
    }
  }

  #[test]
  fn preserves_user_and_terminal_states_after_a_worker_stops() {
    for status in [
      TaskStatus::Queued,
      TaskStatus::WaitingForNetwork,
      TaskStatus::WaitingForSource,
      TaskStatus::Paused,
      TaskStatus::Completed,
      TaskStatus::Failed,
      TaskStatus::Cancelled,
    ] {
      assert!(Engine::should_preserve_external_status(status));
    }
    for status in [
      TaskStatus::Probing,
      TaskStatus::Downloading,
      TaskStatus::Verifying,
      TaskStatus::Seeding,
    ] {
      assert!(!Engine::should_preserve_external_status(status));
    }
  }

  #[test]
  fn controlled_task_waits_only_for_queued_and_active_states() {
    for status in [
      TaskStatus::Queued,
      TaskStatus::Probing,
      TaskStatus::Downloading,
      TaskStatus::Verifying,
      TaskStatus::Seeding,
    ] {
      assert!(Engine::should_wait_for_controlled_task(status));
    }
    for status in [
      TaskStatus::WaitingForNetwork,
      TaskStatus::WaitingForSource,
      TaskStatus::Paused,
      TaskStatus::Completed,
      TaskStatus::Failed,
      TaskStatus::Cancelled,
    ] {
      assert!(!Engine::should_wait_for_controlled_task(status));
    }
  }

  async fn engine(root: &TempDir) -> Engine {
    Engine::open(
      &root.path().join("downloader.sqlite"),
      &root.path().join("downloads"),
      None,
      |_| {},
    )
    .await
    .unwrap()
  }

  async fn enqueue_test_task(engine: &Engine) -> crate::DownloadTask {
    engine
      .enqueue_plan(EnqueuePlanInput {
        key: "comic:control-test".into(),
        title: "Control test".into(),
        assets: vec![asset("ep-1", "001.cbz", 10)],
        destination_id: None,
        priority: None,
        refresh_context: None,
      })
      .await
      .unwrap()
      .remove(0)
  }

  #[tokio::test]
  async fn claims_a_task_control_only_once_under_concurrency() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let mut claims = tokio::task::JoinSet::new();
    for _ in 0..16 {
      let engine = engine.clone();
      claims.spawn(async move { engine.try_claim_control("same-task").await.is_some() });
    }

    let mut successful_claims = 0;
    while let Some(result) = claims.join_next().await {
      successful_claims += usize::from(result.unwrap());
    }

    assert_eq!(successful_claims, 1);
    assert_eq!(engine.controls.lock().await.len(), 1);
  }

  #[tokio::test]
  async fn shutdown_waits_for_worker_checkpoint_and_requeues_only_interrupted_tasks() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let interrupted = enqueue_test_task(&engine).await;
    let paused = engine
      .enqueue_plan(EnqueuePlanInput {
        key: "comic:user-paused".into(),
        title: "User paused".into(),
        assets: vec![asset("ep-2", "002.cbz", 10)],
        destination_id: None,
        priority: None,
        refresh_context: None,
      })
      .await
      .unwrap()
      .remove(0);
    engine
      .repository
      .set_status(&interrupted.id, TaskStatus::Downloading)
      .await
      .unwrap();
    engine
      .repository
      .set_status(&paused.id, TaskStatus::Paused)
      .await
      .unwrap();
    let control = engine.try_claim_control(&interrupted.id).await.unwrap();

    let shutting_down = engine.clone();
    let mut shutdown = tokio::spawn(async move { shutting_down.shutdown().await });
    timeout(Duration::from_secs(1), control.cancelled())
      .await
      .expect("shutdown did not cancel the active worker");
    assert!(
      timeout(Duration::from_millis(50), &mut shutdown)
        .await
        .is_err(),
      "shutdown returned before the worker released its control"
    );

    engine
      .repository
      .replace_completed_ranges(&interrupted.id, &[CompletedRange { start: 0, end: 8 }])
      .await
      .unwrap();
    engine.controls.lock().await.remove(&interrupted.id);
    engine.workers_changed.notify_waiters();

    timeout(Duration::from_secs(3), shutdown)
      .await
      .expect("shutdown did not finish after the worker stopped")
      .unwrap()
      .unwrap();
    assert_eq!(
      engine
        .repository
        .get_task(&interrupted.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Queued
    );
    assert_eq!(
      engine
        .repository
        .get_task(&paused.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Paused
    );
    assert!(engine.try_claim_control("after-shutdown").await.is_none());
    drop(engine);

    let reopened = self::engine(&root).await;
    assert_eq!(
      reopened
        .repository
        .get_task(&interrupted.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Queued
    );
    assert_eq!(
      reopened
        .repository
        .completed_ranges(&interrupted.id)
        .await
        .unwrap(),
      vec![CompletedRange { start: 0, end: 8 }]
    );
  }

  #[test]
  fn background_resource_limits_enforce_both_task_and_connection_budgets() {
    let mut settings = crate::DownloaderSettings::platform_default();
    settings.max_active_tasks = 20;
    settings.connection_budget = 8;
    settings.per_task_connections = 4;
    assert_eq!(Engine::background_resource_limits(&settings), (8, 1));

    settings.max_active_tasks = 2;
    settings.connection_budget = 16;
    assert_eq!(Engine::background_resource_limits(&settings), (2, 4));
  }

  #[tokio::test]
  async fn background_claims_atomically_respect_the_global_task_limit() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let mut claims = tokio::task::JoinSet::new();
    for index in 0..16 {
      let engine = engine.clone();
      claims.spawn(async move {
        matches!(
          engine
            .try_claim_background_control(&format!("task-{index}"), 3, 0)
            .await,
          BackgroundClaim::Claimed(_)
        )
      });
    }

    let mut successful_claims = 0;
    while let Some(result) = claims.join_next().await {
      successful_claims += usize::from(result.unwrap());
    }
    assert_eq!(successful_claims, 3);
    assert_eq!(engine.controls.lock().await.len(), 3);
  }

  #[tokio::test]
  async fn system_stop_invalidates_a_background_worker_waiting_for_capacity() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;
    let generation = engine.background_stop_generation(&task.id).await;

    engine.system_stop_task(&task.id).await.unwrap();

    assert!(matches!(
      engine
        .try_claim_background_control(&task.id, 1, generation)
        .await,
      BackgroundClaim::Stopped
    ));
    assert!(!engine.controls.lock().await.contains_key(&task.id));
  }

  #[tokio::test]
  async fn run_task_now_waits_when_an_existing_control_is_still_queued() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;
    engine
      .controls
      .lock()
      .await
      .insert(task.id.clone(), CancellationToken::new());

    let waiting_engine = engine.clone();
    let task_id = task.id.clone();
    let mut execution = tokio::spawn(async move { waiting_engine.run_task_now(&task_id).await });

    assert!(
      timeout(Duration::from_millis(50), &mut execution)
        .await
        .is_err()
    );
    engine
      .repository
      .set_status(&task.id, TaskStatus::Completed)
      .await
      .unwrap();

    timeout(Duration::from_secs(1), execution)
      .await
      .expect("queued control waiter did not observe completion")
      .unwrap()
      .unwrap();
    assert!(engine.controls.lock().await.contains_key(&task.id));
  }

  #[tokio::test]
  async fn run_task_now_rejects_source_waiting_and_terminal_states_without_claiming_them() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;

    for status in [
      TaskStatus::WaitingForSource,
      TaskStatus::Paused,
      TaskStatus::Failed,
      TaskStatus::Cancelled,
    ] {
      engine
        .repository
        .set_status(&task.id, status)
        .await
        .unwrap();
      let error = engine.run_task_now(&task.id).await.unwrap_err();
      assert!(matches!(error, Error::InvalidInput(_)));
      assert!(error.to_string().contains(status.as_db()));
      assert!(!engine.controls.lock().await.contains_key(&task.id));
    }

    engine
      .repository
      .set_status(&task.id, TaskStatus::Completed)
      .await
      .unwrap();
    engine.run_task_now(&task.id).await.unwrap();
    assert!(!engine.controls.lock().await.contains_key(&task.id));
  }

  #[tokio::test]
  async fn network_constraint_recovery_only_requeues_waiting_for_network() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;
    engine
      .repository
      .set_failure(&task.id, &Error::Network("offline"))
      .await
      .unwrap();

    engine.prepare_background_task(&task.id).await.unwrap();
    let queued = engine.repository.get_task(&task.id).await.unwrap().unwrap();
    assert_eq!(queued.status, TaskStatus::Queued);
    assert_eq!(queued.error_code, None);
    assert_eq!(queued.error_message, None);

    let paused = engine
      .repository
      .set_status(&task.id, TaskStatus::Paused)
      .await
      .unwrap();
    engine.prepare_background_task(&task.id).await.unwrap();
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .revision,
      paused.revision,
    );
  }

  #[tokio::test]
  async fn system_stop_cancels_the_worker_and_requeues_only_system_owned_states() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;

    for status in [
      TaskStatus::Probing,
      TaskStatus::Downloading,
      TaskStatus::WaitingForNetwork,
      TaskStatus::Verifying,
      TaskStatus::Seeding,
    ] {
      engine
        .repository
        .set_status(&task.id, status)
        .await
        .unwrap();
      let token = CancellationToken::new();
      engine
        .controls
        .lock()
        .await
        .insert(task.id.clone(), token.clone());

      engine.system_stop_task(&task.id).await.unwrap();

      assert!(token.is_cancelled());
      assert_eq!(
        engine
          .repository
          .get_task(&task.id)
          .await
          .unwrap()
          .unwrap()
          .status,
        TaskStatus::Queued,
      );
      engine.controls.lock().await.remove(&task.id);
    }

    for status in [
      TaskStatus::Paused,
      TaskStatus::Cancelled,
      TaskStatus::Completed,
      TaskStatus::Failed,
      TaskStatus::WaitingForSource,
    ] {
      let protected = engine
        .repository
        .set_status(&task.id, status)
        .await
        .unwrap();
      engine.system_stop_task(&task.id).await.unwrap();
      let current = engine.repository.get_task(&task.id).await.unwrap().unwrap();
      assert_eq!(current.status, status);
      assert_eq!(current.revision, protected.revision);
    }
  }

  #[tokio::test]
  async fn completion_does_not_overwrite_a_concurrent_external_state() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;

    engine
      .repository
      .set_status(&task.id, TaskStatus::Downloading)
      .await
      .unwrap();
    engine
      .repository
      .set_status(&task.id, TaskStatus::Paused)
      .await
      .unwrap();

    assert!(!engine.complete_task_if_active(&task.id).await.unwrap());
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Paused,
    );

    engine
      .repository
      .set_status(&task.id, TaskStatus::Verifying)
      .await
      .unwrap();
    assert!(engine.complete_task_if_active(&task.id).await.unwrap());
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Completed,
    );
  }

  #[tokio::test]
  async fn update_source_emits_the_committed_task_and_wakes_the_scheduler() {
    let root = TempDir::new().unwrap();
    let events = Arc::new(StdMutex::new(Vec::new()));
    let captured_events = events.clone();
    let engine = Engine::open(
      &root.path().join("downloader.sqlite"),
      &root.path().join("downloads"),
      None,
      move |event| captured_events.lock().unwrap().push(event),
    )
    .await
    .unwrap();
    let task = enqueue_test_task(&engine).await;
    engine.wake.notified().await;
    events.lock().unwrap().clear();
    engine
      .repository
      .set_failure(&task.id, &Error::SourceExpired)
      .await
      .unwrap();
    let refreshed_source = DownloadSource::Http(HttpSource {
      mirrors: vec![HttpMirror {
        url: "https://refreshed.example/file".into(),
        priority: 10,
        headers: BTreeMap::new(),
      }],
      expected_size: Some(10),
      etag: Some("refreshed-etag".into()),
      last_modified: None,
      expires_at: None,
    });

    let updated = engine
      .update_source(&task.id, &refreshed_source)
      .await
      .unwrap();

    timeout(Duration::from_millis(50), engine.wake.notified())
      .await
      .expect("source update did not wake the scheduler");
    assert_eq!(updated.status, TaskStatus::Queued);
    assert!(updated.error_code.is_none());
    assert!(updated.error_message.is_none());
    match &updated.source {
      DownloadSource::Http(source) => {
        assert_eq!(source.mirrors[0].url, "https://refreshed.example/file");
      }
      DownloadSource::Torrent(_) => panic!("source update changed the source kind"),
    }

    let events = events.lock().unwrap();
    assert_eq!(events.len(), 1);
    match &events[0] {
      EngineEvent::TaskUpsert(payload) => {
        assert_eq!(payload.task.id, task.id);
        assert_eq!(payload.task.status, TaskStatus::Queued);
        assert_eq!(payload.revision, updated.revision);
      }
      event => panic!("unexpected source update event: {event:?}"),
    }
  }

  #[tokio::test]
  async fn update_source_cannot_revive_a_task_that_is_no_longer_waiting_for_source() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;
    let original_source = task.source.clone();
    let refreshed_source = DownloadSource::Http(HttpSource {
      mirrors: vec![HttpMirror {
        url: "https://refreshed.example/file".into(),
        priority: 10,
        headers: BTreeMap::new(),
      }],
      expected_size: Some(10),
      etag: None,
      last_modified: None,
      expires_at: None,
    });

    let paused = engine.pause(&task.id).await.unwrap();
    let error = engine
      .update_source(&task.id, &refreshed_source)
      .await
      .unwrap_err();

    assert!(matches!(error, Error::InvalidInput(_)));
    let persisted = engine.repository.get_task(&task.id).await.unwrap().unwrap();
    assert_eq!(persisted.status, TaskStatus::Paused);
    assert_eq!(persisted.revision, paused.revision);
    assert_eq!(
      serde_json::to_value(&persisted.source).unwrap(),
      serde_json::to_value(&original_source).unwrap()
    );
  }

  #[tokio::test]
  async fn task_events_redact_sources_headers_and_local_paths() {
    const SECRET_URL: &str = "https://secret.example/private?token=url-secret";
    const SECRET_AUTHORIZATION: &str = "Bearer authorization-secret";
    const SECRET_REFERENCE: &str = "credential:cookie-secret";
    const SECRET_MAGNET: &str = "magnet:?xt=urn:btih:secret-info-hash";
    const SECRET_TORRENT_URL: &str = "https://secret.example/private.torrent";
    const SECRET_TORRENT_BYTES: &str = "dG9ycmVudC1zZWNyZXQ=";
    const SECRET_FINAL_PATH: &str = "/private/user/downloads/secret-file";

    let root = TempDir::new().unwrap();
    let events = Arc::new(StdMutex::new(Vec::new()));
    let captured_events = events.clone();
    let engine = Engine::open(
      &root.path().join("downloader.sqlite"),
      &root.path().join("downloads"),
      None,
      move |event| captured_events.lock().unwrap().push(event),
    )
    .await
    .unwrap();
    let mut task = enqueue_test_task(&engine).await;
    events.lock().unwrap().clear();
    task.final_path = Some(SECRET_FINAL_PATH.into());
    task.source = DownloadSource::Http(HttpSource {
      mirrors: vec![HttpMirror {
        url: SECRET_URL.into(),
        priority: 0,
        headers: BTreeMap::from([
          (
            "Authorization".into(),
            HttpHeaderValue::Value {
              value: SECRET_AUTHORIZATION.into(),
            },
          ),
          (
            "Cookie".into(),
            HttpHeaderValue::SecretRef {
              secret_ref: SECRET_REFERENCE.into(),
            },
          ),
        ]),
      }],
      expected_size: Some(10),
      etag: None,
      last_modified: None,
      expires_at: None,
    });
    engine.emit_task(task.clone());

    for input in [
      TorrentInput::Magnet {
        uri: SECRET_MAGNET.into(),
      },
      TorrentInput::Url {
        url: SECRET_TORRENT_URL.into(),
      },
      TorrentInput::Bytes {
        base64: SECRET_TORRENT_BYTES.into(),
      },
    ] {
      task.source = DownloadSource::Torrent(TorrentSource {
        input,
        only_files: vec![0, 2],
        seed_policy: None,
      });
      engine.emit_task(task.clone());
    }

    let events = events.lock().unwrap();
    assert_eq!(events.len(), 4);
    for event in events.iter() {
      let EngineEvent::TaskUpsert(payload) = event else {
        panic!("unexpected redaction event: {event:?}");
      };
      assert!(payload.task.final_path.is_none());
      let serialized = serde_json::to_string(payload).unwrap();
      for secret in [
        SECRET_URL,
        "Authorization",
        SECRET_AUTHORIZATION,
        "Cookie",
        SECRET_REFERENCE,
        SECRET_MAGNET,
        SECRET_TORRENT_URL,
        SECRET_TORRENT_BYTES,
        SECRET_FINAL_PATH,
      ] {
        assert!(!serialized.contains(secret), "event leaked {secret}");
      }
    }
    match &events[0] {
      EngineEvent::TaskUpsert(payload) => match &payload.task.source {
        DownloadSource::Http(source) => {
          assert_eq!(source.mirrors[0].url, "[redacted]");
          assert_eq!(source.mirrors[0].headers.len(), 2);
          assert!(source.mirrors[0].headers.values().all(|value| match value {
            HttpHeaderValue::Value { value } => value == "[redacted]",
            HttpHeaderValue::SecretRef { secret_ref } => secret_ref == "[redacted]",
          }));
        }
        DownloadSource::Torrent(_) => panic!("HTTP event changed its source variant"),
      },
      event => panic!("unexpected redaction event: {event:?}"),
    }
    for (event, expected_variant) in events[1..].iter().zip(["magnet", "url", "bytes"]) {
      let EngineEvent::TaskUpsert(payload) = event else {
        panic!("unexpected redaction event: {event:?}");
      };
      let DownloadSource::Torrent(source) = &payload.task.source else {
        panic!("torrent event changed its source variant");
      };
      match (&source.input, expected_variant) {
        (TorrentInput::Magnet { uri }, "magnet") => assert_eq!(uri, "[redacted]"),
        (TorrentInput::Url { url }, "url") => assert_eq!(url, "[redacted]"),
        (TorrentInput::Bytes { base64 }, "bytes") => assert_eq!(base64, "[redacted]"),
        _ => panic!("torrent input variant was not preserved"),
      }
    }
  }

  #[tokio::test]
  async fn queue_mutations_emit_committed_tasks_and_wake_the_scheduler() {
    let root = TempDir::new().unwrap();
    let events = Arc::new(StdMutex::new(Vec::new()));
    let captured_events = events.clone();
    let engine = Engine::open(
      &root.path().join("downloader.sqlite"),
      &root.path().join("downloads"),
      None,
      move |event| captured_events.lock().unwrap().push(event),
    )
    .await
    .unwrap();
    let task = enqueue_test_task(&engine).await;
    engine.wake.notified().await;
    events.lock().unwrap().clear();

    let prioritized = engine.set_priority(&task.id, 10).await.unwrap();
    timeout(Duration::from_millis(50), engine.wake.notified())
      .await
      .expect("priority update did not wake the scheduler");
    assert_eq!(prioritized.priority, 10);
    {
      let mut events = events.lock().unwrap();
      assert_eq!(events.len(), 1);
      match events.remove(0) {
        EngineEvent::TaskUpsert(payload) => {
          assert_eq!(payload.task.id, task.id);
          assert_eq!(payload.task.priority, 10);
          assert_eq!(payload.revision, prioritized.revision);
        }
        event => panic!("unexpected priority event: {event:?}"),
      }
    }

    let moved = engine.move_queue(&task.id, None).await.unwrap();
    timeout(Duration::from_millis(50), engine.wake.notified())
      .await
      .expect("queue move did not wake the scheduler");
    {
      let mut events = events.lock().unwrap();
      assert_eq!(events.len(), 1);
      match events.remove(0) {
        EngineEvent::TaskUpsert(payload) => {
          assert_eq!(payload.task.id, task.id);
          assert_eq!(payload.task.queue_position, moved.queue_position);
          assert_eq!(payload.revision, moved.revision);
        }
        event => panic!("unexpected queue event: {event:?}"),
      }
    }

    assert!(engine.set_priority(&task.id, 0).await.is_err());
    assert!(
      timeout(Duration::from_millis(20), engine.wake.notified())
        .await
        .is_err()
    );
    assert!(events.lock().unwrap().is_empty());
  }

  #[tokio::test]
  async fn updating_settings_wakes_the_scheduler_after_commit() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let mut settings = engine.repository.get_settings().await.unwrap();
    let old_revision = settings.revision;
    settings.max_active_tasks = 7;

    let updated = engine.update_settings(settings).await.unwrap();

    timeout(Duration::from_millis(50), engine.wake.notified())
      .await
      .expect("settings update did not wake the scheduler");
    assert_eq!(updated.max_active_tasks, 7);
    assert!(updated.revision > old_revision);
    let persisted = engine.repository.get_settings().await.unwrap();
    assert_eq!(persisted.max_active_tasks, 7);
    assert_eq!(persisted.revision, updated.revision);
  }

  #[tokio::test]
  async fn enqueues_a_plan_atomically_with_collection_and_asset_keys() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let tasks = engine
      .enqueue_plan(EnqueuePlanInput {
        key: "comic:42".into(),
        title: "Example Comic".into(),
        assets: vec![asset("ep-1", "001.cbz", 10), asset("ep-2", "002.cbz", 20)],
        destination_id: None,
        priority: Some(8),
        refresh_context: None,
      })
      .await
      .unwrap();

    assert_eq!(tasks.len(), 2);
    assert_eq!(tasks[0].asset_key.as_deref(), Some("ep-1"));
    assert_eq!(tasks[1].asset_key.as_deref(), Some("ep-2"));
    assert!(tasks[0].queue_position < tasks[1].queue_position);
    let collections = engine.repository.list_collections().await.unwrap();
    assert_eq!(collections.len(), 1);
    assert_eq!(collections[0].task_count, 2);
    assert_eq!(collections[0].total_bytes, Some(30));
  }

  #[tokio::test]
  async fn deleting_files_resets_all_resume_state_and_keeps_a_retryable_record() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;
    let final_path = PathBuf::from(task.final_path.as_deref().unwrap());
    let temp_path = PathBuf::from(format!("{}.part", final_path.display()));
    tokio::fs::create_dir_all(final_path.parent().unwrap())
      .await
      .unwrap();
    tokio::fs::write(&final_path, b"completed").await.unwrap();
    tokio::fs::write(&temp_path, b"partial").await.unwrap();
    engine
      .repository
      .update_probe(
        &task.id,
        Some(10),
        Some("\"etag-v1\""),
        Some("last-modified-v1"),
      )
      .await
      .unwrap();
    engine
      .repository
      .replace_completed_ranges(&task.id, &[CompletedRange { start: 0, end: 10 }])
      .await
      .unwrap();
    engine
      .repository
      .update_torrent_session(&task.id, Some("info-hash"), Some(7), 5, 2, Some(1))
      .await
      .unwrap();
    engine
      .repository
      .update_transfer_progress(&task.id, TaskStatus::Downloading, 10, 10, 20)
      .await
      .unwrap();
    engine
      .repository
      .set_status(&task.id, TaskStatus::Completed)
      .await
      .unwrap();

    engine.delete_files(&task.id).await.unwrap();

    assert!(!tokio::fs::try_exists(&final_path).await.unwrap());
    assert!(!tokio::fs::try_exists(&temp_path).await.unwrap());
    assert!(
      engine
        .repository
        .completed_ranges(&task.id)
        .await
        .unwrap()
        .is_empty()
    );
    assert!(
      engine
        .repository
        .torrent_detail(&task.id)
        .await
        .unwrap()
        .is_none()
    );
    let reset = engine.repository.get_task(&task.id).await.unwrap().unwrap();
    assert_eq!(reset.status, TaskStatus::Cancelled);
    assert_eq!(reset.downloaded_bytes, 0);
    assert_eq!(reset.speed_bytes_per_second, 0);
    assert_eq!(reset.retry_count, 0);
    assert!(reset.etag.is_none());
    assert!(reset.last_modified.is_none());
    assert!(reset.error_code.is_none());
    assert!(reset.error_message.is_none());
  }

  #[cfg(feature = "bittorrent")]
  #[tokio::test]
  async fn torrent_checksum_verifies_the_selected_downloaded_file() {
    use base64::{Engine as _, engine::general_purpose::STANDARD};
    use librqbit::CreateTorrentOptions;
    use sha2::{Digest, Sha256};

    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let payload = b"torrent checksum payload";
    let source_path = root.path().join("payload.bin");
    tokio::fs::write(&source_path, payload).await.unwrap();
    let spawner = librqbit::spawn_utils::BlockingSpawner::new(2);
    let torrent = librqbit::create_torrent(&source_path, CreateTorrentOptions::default(), &spawner)
      .await
      .unwrap();
    let task = engine
      .enqueue_plan(EnqueuePlanInput {
        key: "torrent:checksum".into(),
        title: "Torrent checksum".into(),
        assets: vec![DownloadAsset {
          key: "payload".into(),
          relative_path: "torrent-output".into(),
          size: Some(payload.len() as u64),
          checksum: Some(Checksum {
            algorithm: ChecksumAlgorithm::Sha256,
            value: hex::encode(Sha256::digest(payload)),
          }),
          source: DownloadSource::Torrent(TorrentSource {
            input: TorrentInput::Bytes {
              base64: STANDARD.encode(torrent.as_bytes().unwrap()),
            },
            only_files: Vec::new(),
            seed_policy: None,
          }),
        }],
        destination_id: None,
        priority: None,
        refresh_context: None,
      })
      .await
      .unwrap()
      .remove(0);
    let torrent_root = PathBuf::from(task.final_path.as_deref().unwrap());
    tokio::fs::create_dir_all(&torrent_root).await.unwrap();
    let downloaded_path = torrent_root.join("payload.bin");
    tokio::fs::write(&downloaded_path, payload).await.unwrap();

    engine
      .run_task_inner(
        &task,
        &engine.repository.get_settings().await.unwrap(),
        CancellationToken::new(),
        None,
      )
      .await
      .unwrap();

    assert!(tokio::fs::try_exists(&downloaded_path).await.unwrap());
    assert!(
      !tokio::fs::try_exists(PathBuf::from(format!("{}.part", torrent_root.display())))
        .await
        .unwrap()
    );
    engine
      .repository
      .set_status(&task.id, TaskStatus::Completed)
      .await
      .unwrap();
    engine.delete_files(&task.id).await.unwrap();
    assert!(!tokio::fs::try_exists(&downloaded_path).await.unwrap());
    assert!(
      engine
        .repository
        .torrent_session_identity(&task.id)
        .await
        .unwrap()
        .is_none()
    );
    engine.torrent.stop().await.unwrap();
  }

  #[tokio::test]
  async fn rejects_a_plan_before_writing_any_partial_tasks() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let result = engine
      .enqueue_plan(EnqueuePlanInput {
        key: "comic:42".into(),
        title: "Example Comic".into(),
        assets: vec![asset("ep-1", "same.cbz", 10), asset("ep-2", "same.cbz", 20)],
        destination_id: None,
        priority: None,
        refresh_context: None,
      })
      .await;

    assert!(result.is_err());
    assert!(engine.repository.list_tasks().await.unwrap().is_empty());
    assert!(
      engine
        .repository
        .list_collections()
        .await
        .unwrap()
        .is_empty()
    );
  }

  #[tokio::test]
  async fn reopens_interrupted_tasks_with_ranges_and_refresh_context() {
    let root = TempDir::new().unwrap();
    let first_engine = engine(&root).await;
    let refresh_context = ContentRefreshContext {
      plugin: "reader".into(),
      content_type: ["reader".into(), "comic".into()],
      content_id: "comic-42".into(),
      episode_id: "ep-7".into(),
      content_page_fingerprint: Some("sha256:content-page".into()),
      provider_fingerprint: "sha256:provider".into(),
      plugin_version: Some("1.2.3".into()),
      plugin_integrity: Some("sha256:archive".into()),
    };
    let tasks = first_engine
      .enqueue_plan(EnqueuePlanInput {
        key: "reader:comic-42".into(),
        title: "Persisted comic".into(),
        assets: vec![asset("ep-7", "007.cbz", 32)],
        destination_id: None,
        priority: Some(9),
        refresh_context: Some(refresh_context.clone()),
      })
      .await
      .unwrap();
    let task_id = tasks[0].id.clone();
    first_engine
      .repository
      .set_status(&task_id, TaskStatus::Downloading)
      .await
      .unwrap();
    first_engine
      .repository
      .replace_completed_ranges(
        &task_id,
        &[
          CompletedRange { start: 0, end: 8 },
          CompletedRange { start: 16, end: 24 },
        ],
      )
      .await
      .unwrap();
    first_engine.handle().checkpoint().await.unwrap();
    drop(first_engine);

    let reopened = engine(&root).await;
    let task = reopened
      .repository
      .get_task(&task_id)
      .await
      .unwrap()
      .unwrap();
    assert_eq!(task.status, TaskStatus::Queued);
    assert_eq!(task.priority, 9);
    assert_eq!(task.asset_key.as_deref(), Some("ep-7"));
    assert_eq!(
      reopened
        .repository
        .completed_ranges(&task_id)
        .await
        .unwrap(),
      vec![
        CompletedRange { start: 0, end: 8 },
        CompletedRange { start: 16, end: 24 },
      ]
    );
    let collections = reopened.repository.list_collections().await.unwrap();
    assert_eq!(collections.len(), 1);
    let restored_context = collections[0].refresh_context.as_ref().unwrap();
    assert_eq!(restored_context.plugin, refresh_context.plugin);
    assert_eq!(restored_context.content_type, refresh_context.content_type);
    assert_eq!(
      restored_context.content_page_fingerprint,
      refresh_context.content_page_fingerprint
    );
    assert_eq!(
      restored_context.provider_fingerprint,
      refresh_context.provider_fingerprint
    );
    assert_eq!(
      restored_context.plugin_version,
      refresh_context.plugin_version
    );
    assert_eq!(
      restored_context.plugin_integrity,
      refresh_context.plugin_integrity
    );
  }

  #[tokio::test]
  async fn saf_completion_waits_for_native_export_and_preserves_failed_staging() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let destination = Destination {
      id: "saf-shared".into(),
      label: "Shared".into(),
      kind: DestinationKind::AndroidSaf,
      path: "content://provider/tree/primary%3ADownloads".into(),
      is_default: false,
    };
    engine
      .repository
      .register_destination(&destination)
      .await
      .unwrap();
    let task = engine
      .enqueue_plan(EnqueuePlanInput {
        key: "comic:saf".into(),
        title: "SAF comic".into(),
        assets: vec![asset("ep-1", "001.cbz", 4)],
        destination_id: Some(destination.id.clone()),
        priority: None,
        refresh_context: None,
      })
      .await
      .unwrap()
      .remove(0);
    let staging = PathBuf::from(task.final_path.as_ref().unwrap());
    tokio::fs::create_dir_all(staging.parent().unwrap())
      .await
      .unwrap();
    tokio::fs::write(&staging, b"data").await.unwrap();
    engine
      .repository
      .upsert_pending_saf_export(&task.id, &destination.id, &staging)
      .await
      .unwrap();
    engine
      .repository
      .set_status(&task.id, TaskStatus::Verifying)
      .await
      .unwrap();

    engine
      .fail_saf_export(&task.id, "provider is full")
      .await
      .unwrap();
    assert!(tokio::fs::try_exists(&staging).await.unwrap());
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Failed
    );

    engine
      .repository
      .set_status(&task.id, TaskStatus::Verifying)
      .await
      .unwrap();
    engine
      .complete_saf_export(
        &task.id,
        "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2FSAF%20comic%2F001.cbz",
      )
      .await
      .unwrap();
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Completed
    );
    assert!(
      !tokio::fs::try_exists(engine.staging_root.join(&task.id))
        .await
        .unwrap()
    );
  }

  #[tokio::test]
  async fn direct_saf_transfer_persists_resume_identity_and_commit_state() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let destination = Destination {
      id: "saf-direct".into(),
      label: "Shared".into(),
      kind: DestinationKind::AndroidSaf,
      path: "content://provider/tree/primary%3ADownloads".into(),
      is_default: false,
    };
    engine
      .repository
      .register_destination(&destination)
      .await
      .unwrap();
    let mut direct_asset = asset("direct", "chapter.cbz", 4);
    let DownloadSource::Http(source) = &mut direct_asset.source else {
      unreachable!();
    };
    source.expires_at = Some(crate::persistence::now_millis() - 1);
    let task = engine
      .enqueue_plan(EnqueuePlanInput {
        key: "direct-plan".into(),
        title: "Direct".into(),
        assets: vec![direct_asset],
        destination_id: Some(destination.id.clone()),
        priority: None,
        refresh_context: None,
      })
      .await
      .unwrap()
      .remove(0);
    let partial_path = root.path().join("provider-document");
    let file = OpenOptions::new()
      .create(true)
      .truncate(false)
      .read(true)
      .write(true)
      .open(&partial_path)
      .unwrap();
    let document_uri =
      "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Fpartial";
    let result = engine
      .run_task_now_with_direct_saf(
        &task.id,
        DirectSafTarget {
          file: Arc::new(file),
          document_uri: document_uri.into(),
        },
      )
      .await;
    assert!(matches!(result, Err(Error::SourceExpired)));
    assert_eq!(
      engine
        .repository
        .saf_export_record(&task.id)
        .await
        .unwrap()
        .unwrap()
        .document_uri
        .as_deref(),
      Some(document_uri)
    );

    engine
      .repository
      .mark_direct_saf_ready(&task.id, document_uri)
      .await
      .unwrap();
    assert!(engine.finish_task_now(&task.id, Ok(())).await.is_err());
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::WaitingForSource
    );
    engine
      .repository
      .set_status(&task.id, TaskStatus::Queued)
      .await
      .unwrap();
    engine.resume_saf_commit(&task.id).await.unwrap();
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Verifying
    );
    engine.abandon_direct_saf_transfer(&task.id).await.unwrap();
    assert!(
      engine
        .repository
        .saf_export_record(&task.id)
        .await
        .unwrap()
        .is_none()
    );
  }

  #[tokio::test]
  async fn external_file_deletion_runs_only_after_the_task_is_claimed() {
    let root = TempDir::new().unwrap();
    let engine = engine(&root).await;
    let task = enqueue_test_task(&engine).await;
    let final_path = PathBuf::from(task.final_path.as_ref().unwrap());
    tokio::fs::create_dir_all(final_path.parent().unwrap())
      .await
      .unwrap();
    tokio::fs::write(&final_path, b"keep").await.unwrap();
    engine
      .repository
      .set_status(&task.id, TaskStatus::Downloading)
      .await
      .unwrap();
    let called = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let callback_called = called.clone();
    let result = engine
      .delete_files_with_external(&task.id, move |_, _| {
        callback_called.store(true, std::sync::atomic::Ordering::SeqCst);
        Ok(())
      })
      .await;
    assert!(result.is_err());
    assert!(!called.load(std::sync::atomic::Ordering::SeqCst));
    assert!(tokio::fs::try_exists(final_path).await.unwrap());
  }
}
