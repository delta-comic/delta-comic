use std::{
  path::{Path, PathBuf},
  sync::Arc,
};

#[cfg(feature = "bittorrent")]
use std::{collections::HashMap, path::Component, sync::Mutex as StdMutex, time::Duration};

use futures_util::future::BoxFuture;
#[cfg(feature = "bittorrent")]
use tokio::io::AsyncWriteExt;
use tokio_util::sync::CancellationToken;

use crate::{
  domain::{DownloadTask, DownloaderSettings, TorrentSource},
  error::{Error, Result},
};

#[cfg(feature = "bittorrent")]
use crate::domain::{SeedPolicy, TorrentInput};

#[cfg(feature = "bittorrent")]
const STATS_INTERVAL: Duration = Duration::from_millis(500);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TorrentSample {
  pub total_bytes: u64,
  pub downloaded_bytes: u64,
  pub speed_bytes_per_second: u64,
  pub uploaded_bytes: u64,
  pub peer_count: u64,
  pub info_hash: Option<String>,
  pub session_id: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(not(feature = "bittorrent"), allow(dead_code))]
pub(crate) enum TorrentEvent {
  Initialized(TorrentSample),
  Progress(TorrentSample),
  Seeding(TorrentSample),
}

pub(crate) type TorrentEventSink =
  Arc<dyn Fn(TorrentEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>;

#[cfg(feature = "bittorrent")]
type TorrentOwnerKey = usize;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TorrentDownloadReport {
  downloaded_paths: Vec<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TorrentResumeIdentity {
  pub session_id: Option<u64>,
  pub info_hash: Option<String>,
}

impl TorrentDownloadReport {
  pub(crate) fn checksum_path(&self) -> Result<&Path> {
    match self.downloaded_paths.as_slice() {
      [path] => Ok(path),
      [] => Err(Error::InvalidInput(
        "torrent checksum requires one selected file, but no files were selected".into(),
      )),
      _ => Err(Error::InvalidInput(
        "torrent checksum requires exactly one selected file".into(),
      )),
    }
  }
}

#[cfg(feature = "bittorrent")]
struct TorrentLease {
  owners: Arc<StdMutex<HashMap<TorrentOwnerKey, String>>>,
  key: TorrentOwnerKey,
  task_id: String,
}

#[cfg(feature = "bittorrent")]
impl Drop for TorrentLease {
  fn drop(&mut self) {
    let mut owners = self
      .owners
      .lock()
      .unwrap_or_else(std::sync::PoisonError::into_inner);
    if owners.get(&self.key) == Some(&self.task_id) {
      owners.remove(&self.key);
    }
  }
}

#[derive(Clone)]
pub struct TorrentManager {
  #[cfg(feature = "bittorrent")]
  session: Arc<librqbit::Session>,
  #[cfg(feature = "bittorrent")]
  owners: Arc<StdMutex<HashMap<TorrentOwnerKey, String>>>,
  #[cfg(not(feature = "bittorrent"))]
  _session_dir: PathBuf,
}

impl TorrentManager {
  pub async fn new(session_dir: PathBuf, default_peer_limit: u8) -> Result<Self> {
    tokio::fs::create_dir_all(&session_dir).await?;
    #[cfg(not(feature = "bittorrent"))]
    let _ = default_peer_limit;
    #[cfg(feature = "bittorrent")]
    {
      use librqbit::{Session, SessionOptions, SessionPersistenceConfig};

      pause_persisted_torrents(&session_dir).await?;
      let session = Session::new_with_opts(
        session_dir.join("unused-default-output"),
        SessionOptions {
          fastresume: true,
          peer_limit: Some(usize::from(default_peer_limit.max(1))),
          persistence: Some(SessionPersistenceConfig::Json {
            folder: Some(session_dir),
          }),
          #[cfg(any(target_os = "android", test))]
          dht: None,
          #[cfg(target_os = "android")]
          disable_local_service_discovery: true,
          ..Default::default()
        },
      )
      .await
      .map_err(|error| Error::BitTorrent(error.to_string()))?;
      let restored_active = session.with_torrents(|torrents| {
        for (_, handle) in torrents {
          if !handle.is_paused() {
            return true;
          }
        }
        false
      });
      if restored_active {
        session.stop().await;
        return Err(Error::BitTorrent(
          "restored torrent escaped the paused startup state".into(),
        ));
      }
      Ok(Self {
        session,
        owners: Arc::new(StdMutex::new(HashMap::new())),
      })
    }
    #[cfg(not(feature = "bittorrent"))]
    {
      Ok(Self {
        _session_dir: session_dir,
      })
    }
  }

  #[allow(clippy::too_many_arguments)]
  pub async fn download(
    &self,
    _task: &DownloadTask,
    source: &TorrentSource,
    settings: &DownloaderSettings,
    resume_identity: Option<&TorrentResumeIdentity>,
    destination: &Path,
    cancellation: CancellationToken,
    events: TorrentEventSink,
  ) -> Result<TorrentDownloadReport> {
    #[cfg(feature = "bittorrent")]
    {
      use base64::{Engine as _, engine::general_purpose::STANDARD};
      use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse};

      tokio::fs::create_dir_all(destination).await?;
      let session = &self.session;
      let input = match &source.input {
        TorrentInput::Magnet { uri } => AddTorrent::from_url(uri.clone()),
        TorrentInput::Url { url } => AddTorrent::from_url(url.clone()),
        TorrentInput::Bytes { base64 } => AddTorrent::from_bytes(
          STANDARD
            .decode(base64)
            .map_err(|_| Error::InvalidInput("torrent bytes are not valid base64".into()))?,
        ),
      };
      let only_files = normalize_only_files(&source.only_files);
      let response = session
        .add_torrent(
          input,
          Some(AddTorrentOptions {
            // librqbit defines None as all files; Some(empty) selects no files.
            only_files: only_files.clone(),
            overwrite: true,
            output_folder: Some(destination.to_string_lossy().into_owned()),
            peer_limit: Some(torrent_peer_limit(settings)),
            ..Default::default()
          }),
        )
        .await
        .map_err(|error| Error::BitTorrent(error.to_string()))?;
      let (torrent_id, handle, was_managed) = match response {
        AddTorrentResponse::Added(id, handle) => (id, handle, false),
        AddTorrentResponse::AlreadyManaged(id, handle) => {
          validate_resume_identity(id, &handle.info_hash().as_string(), resume_identity)?;
          (id, handle, true)
        }
        AddTorrentResponse::ListOnly(_) => {
          return Err(Error::BitTorrent(
            "unexpected list-only torrent response".into(),
          ));
        }
      };
      let _lease = self.claim(torrent_id, &_task.id)?;
      let download_result = async {
        handle
          .wait_until_initialized()
          .await
          .map_err(|error| Error::BitTorrent(error.to_string()))?;
        if !same_file_selection(handle.only_files(), &only_files) {
          let context = if was_managed {
            "restored torrent"
          } else {
            "new torrent"
          };
          return Err(Error::BitTorrent(format!(
            "{context} file selection does not match the requested selection"
          )));
        }

        let downloaded_paths = selected_download_paths(&handle, destination, &only_files)?;
        let initialized = handle.stats();
        events(TorrentEvent::Initialized(torrent_sample(&handle, 0))).await?;
        if !initialized.finished && handle.is_paused() {
          session
            .unpause(&handle)
            .await
            .map_err(|error| Error::BitTorrent(error.to_string()))?;
        }
        self
          .download_until_complete(&handle, cancellation.clone(), &events)
          .await?;

        let policy = effective_seed_policy(source.seed_policy.as_ref(), settings);
        if !matches!(policy, SeedPolicy::None) {
          events(TorrentEvent::Seeding(torrent_sample(&handle, 0))).await?;
          self
            .seed_until(&policy, &handle, cancellation.clone(), &events)
            .await?;
        }
        Ok(TorrentDownloadReport { downloaded_paths })
      }
      .await;

      // Completion, cancellation and failures all leave the handle paused. This is
      // also the default no-seeding policy and prevents unnoticed background upload.
      let pause_result = if handle.is_paused() {
        Ok(())
      } else {
        session
          .pause(&handle)
          .await
          .map_err(|error| Error::BitTorrent(error.to_string()))
      };
      pause_result?;
      download_result
    }
    #[cfg(not(feature = "bittorrent"))]
    {
      let _ = (
        _task,
        source,
        settings,
        resume_identity,
        destination,
        cancellation,
        events,
      );
      Err(Error::BitTorrentUnavailable)
    }
  }

  #[cfg(feature = "bittorrent")]
  fn claim(&self, torrent_id: usize, task_id: &str) -> Result<TorrentLease> {
    let key = torrent_id;
    let mut owners = self
      .owners
      .lock()
      .unwrap_or_else(std::sync::PoisonError::into_inner);
    if let Some(owner) = owners.get(&key) {
      return Err(Error::BitTorrent(format!(
        "torrent is already active for task {owner}"
      )));
    }
    owners.insert(key, task_id.to_owned());
    Ok(TorrentLease {
      owners: self.owners.clone(),
      key,
      task_id: task_id.to_owned(),
    })
  }

  #[cfg(feature = "bittorrent")]
  async fn download_until_complete(
    &self,
    handle: &Arc<librqbit::ManagedTorrent>,
    cancellation: CancellationToken,
    events: &TorrentEventSink,
  ) -> Result<()> {
    let initial = handle.stats();
    if initial.finished {
      return Ok(());
    }

    let mut previous_bytes = initial.progress_bytes;
    let mut previous_at = tokio::time::Instant::now();
    let mut interval = tokio::time::interval(STATS_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    // Tokio intervals tick immediately once; consume that tick so sampling is
    // paced at 500ms instead of emitting two initialization snapshots.
    interval.tick().await;
    let completed = handle.wait_until_completed();
    tokio::pin!(completed);
    loop {
      tokio::select! {
        () = cancellation.cancelled() => return Err(Error::Cancelled),
        result = &mut completed => {
          result.map_err(|error| Error::BitTorrent(error.to_string()))?;
          events(TorrentEvent::Progress(torrent_sample(handle, 0))).await?;
          return Ok(());
        },
        _ = interval.tick() => {
          let now = tokio::time::Instant::now();
          let stats = handle.stats();
          let speed = transfer_rate(previous_bytes, stats.progress_bytes, now - previous_at);
          previous_bytes = stats.progress_bytes;
          previous_at = now;
          events(TorrentEvent::Progress(torrent_sample(handle, speed))).await?;
        },
      }
    }
  }

  #[cfg(feature = "bittorrent")]
  async fn seed_until(
    &self,
    policy: &SeedPolicy,
    handle: &std::sync::Arc<librqbit::ManagedTorrent>,
    cancellation: CancellationToken,
    events: &TorrentEventSink,
  ) -> Result<()> {
    let started = tokio::time::Instant::now();
    let initial = handle.stats();
    let mut previous_bytes = initial.uploaded_bytes;
    let mut previous_at = started;
    let mut interval = tokio::time::interval(STATS_INTERVAL);
    interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
    loop {
      let stats = handle.stats();
      let elapsed = started.elapsed().as_secs();
      if seed_target_reached(policy, stats.uploaded_bytes, stats.total_bytes, elapsed) {
        return Ok(());
      }
      tokio::select! {
        () = cancellation.cancelled() => return Err(Error::Cancelled),
        _ = interval.tick() => {
          let now = tokio::time::Instant::now();
          let stats = handle.stats();
          let speed = transfer_rate(previous_bytes, stats.uploaded_bytes, now - previous_at);
          previous_bytes = stats.uploaded_bytes;
          previous_at = now;
          events(TorrentEvent::Seeding(torrent_sample(handle, speed))).await?;
        },
      }
    }
  }

  pub async fn stop(&self) -> Result<()> {
    #[cfg(feature = "bittorrent")]
    self.session.stop().await;
    Ok(())
  }

  pub async fn remove(
    &self,
    session_id: Option<u64>,
    info_hash: Option<&str>,
    delete_files: bool,
  ) -> Result<()> {
    #[cfg(feature = "bittorrent")]
    {
      let by_id = session_id
        .and_then(|id| usize::try_from(id).ok())
        .and_then(|id| self.session.get(id.into()))
        .filter(|handle| {
          info_hash.is_none_or(|expected| handle.info_hash().as_string() == expected)
        });
      let handle = by_id.or_else(|| {
        info_hash
          .and_then(|hash| librqbit::api::TorrentIdOrHash::try_from(hash).ok())
          .and_then(|hash| self.session.get(hash))
      });
      if let Some(handle) = handle {
        self
          .session
          .delete(handle.id().into(), delete_files)
          .await
          .map_err(|error| Error::BitTorrent(error.to_string()))?;
      }
      Ok(())
    }
    #[cfg(not(feature = "bittorrent"))]
    {
      let _ = (session_id, info_hash, delete_files);
      Ok(())
    }
  }
}

#[cfg(feature = "bittorrent")]
async fn pause_persisted_torrents(session_dir: &Path) -> Result<()> {
  let database_path = session_dir.join("session.json");
  let bytes = match tokio::fs::read(&database_path).await {
    Ok(bytes) => bytes,
    Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
    Err(error) => return Err(error.into()),
  };
  let mut database = serde_json::from_slice::<serde_json::Value>(&bytes)?;
  let torrents = database
    .get_mut("torrents")
    .and_then(serde_json::Value::as_object_mut)
    .ok_or_else(|| Error::BitTorrent("invalid fast-resume session structure".into()))?;
  let mut changed = false;
  for torrent in torrents.values_mut() {
    let paused = torrent
      .get_mut("is_paused")
      .ok_or_else(|| Error::BitTorrent("invalid fast-resume torrent state".into()))?;
    let was_paused = paused
      .as_bool()
      .ok_or_else(|| Error::BitTorrent("invalid fast-resume pause state".into()))?;
    if !was_paused {
      *paused = true.into();
      changed = true;
    }
  }
  if !changed {
    return Ok(());
  }

  // A process can be killed before the engine checkpoints active torrents.
  // Rewrite the persisted state atomically before librqbit sees it, otherwise
  // restored handles can connect or seed before the scheduler acquires a slot.
  let temporary_path = session_dir.join(format!(
    ".session-pause-{}.tmp",
    uuid::Uuid::new_v4().as_simple()
  ));
  let payload = serde_json::to_vec(&database)?;
  let write_result = async {
    let mut temporary = tokio::fs::OpenOptions::new()
      .create_new(true)
      .write(true)
      .open(&temporary_path)
      .await?;
    temporary.write_all(&payload).await?;
    temporary.sync_all().await
  }
  .await;
  if let Err(error) = write_result {
    let _ = tokio::fs::remove_file(&temporary_path).await;
    return Err(error.into());
  }
  if let Err(error) = crate::target_file::replace(&temporary_path, &database_path).await {
    let _ = tokio::fs::remove_file(&temporary_path).await;
    return Err(error);
  }
  Ok(())
}

#[cfg(feature = "bittorrent")]
fn torrent_peer_limit(settings: &DownloaderSettings) -> usize {
  usize::from(settings.per_task_connections.max(1))
}

#[cfg(feature = "bittorrent")]
fn validate_resume_identity(
  session_id: usize,
  info_hash: &str,
  identity: Option<&TorrentResumeIdentity>,
) -> Result<()> {
  let Some(identity) = identity else {
    return Err(Error::BitTorrent(
      "torrent is already managed by another download task".into(),
    ));
  };
  if identity.session_id.is_none() && identity.info_hash.is_none() {
    return Err(Error::BitTorrent(
      "persisted torrent identity is incomplete".into(),
    ));
  }
  if identity
    .session_id
    .is_some_and(|expected| usize::try_from(expected).ok() != Some(session_id))
    || identity
      .info_hash
      .as_deref()
      .is_some_and(|expected| expected != info_hash)
  {
    return Err(Error::BitTorrent(
      "persisted torrent identity does not match the managed torrent".into(),
    ));
  }
  Ok(())
}

#[cfg(feature = "bittorrent")]
fn selected_download_paths(
  handle: &Arc<librqbit::ManagedTorrent>,
  destination: &Path,
  only_files: &Option<Vec<usize>>,
) -> Result<Vec<PathBuf>> {
  handle
    .with_metadata(|metadata| {
      metadata
        .file_infos
        .iter()
        .enumerate()
        .filter(|(index, _)| {
          only_files
            .as_ref()
            .is_none_or(|selected| selected.binary_search(index).is_ok())
        })
        .map(|(_, file)| safe_torrent_path(destination, &file.relative_filename))
        .collect()
    })
    .map_err(|error| Error::BitTorrent(error.to_string()))?
}

#[cfg(feature = "bittorrent")]
fn safe_torrent_path(destination: &Path, relative: &Path) -> Result<PathBuf> {
  if relative.as_os_str().is_empty()
    || relative
      .components()
      .any(|component| !matches!(component, Component::Normal(_)))
  {
    return Err(Error::BitTorrent(
      "torrent metadata contains an unsafe file path".into(),
    ));
  }
  Ok(destination.join(relative))
}

#[cfg(feature = "bittorrent")]
fn torrent_sample(handle: &Arc<librqbit::ManagedTorrent>, speed: u64) -> TorrentSample {
  let stats = handle.stats();
  let peer_count = stats
    .live
    .as_ref()
    .map(|live| live.snapshot.peer_stats.live)
    .unwrap_or(0);
  TorrentSample {
    total_bytes: stats.total_bytes,
    downloaded_bytes: stats.progress_bytes,
    speed_bytes_per_second: speed,
    uploaded_bytes: stats.uploaded_bytes,
    peer_count: u64::from(peer_count),
    info_hash: Some(handle.info_hash().as_string()),
    session_id: u64::try_from(handle.id()).ok(),
  }
}

#[cfg(feature = "bittorrent")]
fn normalize_only_files(only_files: &[usize]) -> Option<Vec<usize>> {
  if only_files.is_empty() {
    return None;
  }
  let mut normalized = only_files.to_vec();
  normalized.sort_unstable();
  normalized.dedup();
  Some(normalized)
}

#[cfg(feature = "bittorrent")]
fn same_file_selection(actual: Option<Vec<usize>>, expected: &Option<Vec<usize>>) -> bool {
  actual.map(|mut files| {
    files.sort_unstable();
    files.dedup();
    files
  }) == *expected
}

#[cfg(feature = "bittorrent")]
fn transfer_rate(previous: u64, current: u64, elapsed: Duration) -> u64 {
  if elapsed.is_zero() {
    return 0;
  }
  (current.saturating_sub(previous) as f64 / elapsed.as_secs_f64()).round() as u64
}

#[cfg(feature = "bittorrent")]
fn effective_seed_policy(
  source_policy: Option<&SeedPolicy>,
  settings: &DownloaderSettings,
) -> SeedPolicy {
  if !settings.seed_on_complete {
    return SeedPolicy::None;
  }
  if let Some(policy) = source_policy {
    return policy.clone();
  }
  match (settings.seed_ratio, settings.seed_seconds) {
    (Some(ratio), Some(duration_seconds)) => SeedPolicy::RatioOrDuration {
      ratio,
      duration_seconds,
    },
    (Some(ratio), None) => SeedPolicy::Ratio { ratio },
    (None, Some(duration_seconds)) => SeedPolicy::Duration { duration_seconds },
    (None, None) => SeedPolicy::None,
  }
}

#[cfg(feature = "bittorrent")]
fn seed_target_reached(
  policy: &SeedPolicy,
  uploaded_bytes: u64,
  total_bytes: u64,
  elapsed_seconds: u64,
) -> bool {
  let ratio = if total_bytes == 0 {
    0.0
  } else {
    uploaded_bytes as f64 / total_bytes as f64
  };
  match policy {
    SeedPolicy::None => true,
    SeedPolicy::Ratio { ratio: target } => ratio >= *target,
    SeedPolicy::Duration { duration_seconds } => elapsed_seconds >= *duration_seconds,
    SeedPolicy::RatioOrDuration {
      ratio: target,
      duration_seconds,
    } => ratio >= *target || elapsed_seconds >= *duration_seconds,
  }
}

#[cfg(test)]
#[path = "../test/src/torrent.rs"]
mod tests;
