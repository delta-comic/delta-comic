use std::{
  path::{Path, PathBuf},
  sync::Arc,
};

#[cfg(feature = "bittorrent")]
use std::{collections::HashMap, path::Component, sync::Mutex as StdMutex, time::Duration};

use futures_util::future::BoxFuture;
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
  pub async fn new(session_dir: PathBuf) -> Result<Self> {
    tokio::fs::create_dir_all(&session_dir).await?;
    #[cfg(feature = "bittorrent")]
    {
      use librqbit::{Session, SessionOptions, SessionPersistenceConfig};

      let session = Session::new_with_opts(
        session_dir.join("unused-default-output"),
        SessionOptions {
          fastresume: true,
          persistence: Some(SessionPersistenceConfig::Json {
            folder: Some(session_dir),
          }),
          #[cfg(any(target_os = "android", test))]
          disable_dht: true,
          #[cfg(any(target_os = "android", test))]
          disable_dht_persistence: true,
          #[cfg(any(target_os = "android", test))]
          listen_port_range: None,
          #[cfg(any(target_os = "android", test))]
          enable_upnp_port_forwarding: false,
          ..Default::default()
        },
      )
      .await
      .map_err(|error| Error::BitTorrent(error.to_string()))?;
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
    peer_count: u64::try_from(peer_count).unwrap_or(u64::MAX),
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
mod tests {
  use super::*;

  #[test]
  fn torrent_checksum_uses_the_single_actual_downloaded_file() {
    let report = TorrentDownloadReport {
      downloaded_paths: vec![PathBuf::from("download-root/actual-name.cbz")],
    };
    assert_eq!(
      report.checksum_path().unwrap(),
      Path::new("download-root/actual-name.cbz")
    );

    assert!(
      TorrentDownloadReport {
        downloaded_paths: Vec::new()
      }
      .checksum_path()
      .is_err()
    );
    assert!(
      TorrentDownloadReport {
        downloaded_paths: vec![PathBuf::from("one"), PathBuf::from("two")]
      }
      .checksum_path()
      .is_err()
    );
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn already_managed_torrent_requires_the_same_persisted_task_identity() {
    let identity = TorrentResumeIdentity {
      session_id: Some(7),
      info_hash: Some("0123456789abcdef0123456789abcdef01234567".into()),
    };
    assert!(
      validate_resume_identity(
        7,
        "0123456789abcdef0123456789abcdef01234567",
        Some(&identity)
      )
      .is_ok()
    );
    assert!(validate_resume_identity(7, "0123456789abcdef0123456789abcdef01234567", None).is_err());
    assert!(
      validate_resume_identity(
        8,
        "0123456789abcdef0123456789abcdef01234567",
        Some(&identity)
      )
      .is_err()
    );
    assert!(
      validate_resume_identity(
        7,
        "ffffffffffffffffffffffffffffffffffffffff",
        Some(&identity)
      )
      .is_err()
    );
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn rejects_unsafe_torrent_metadata_paths() {
    let root = Path::new("download-root");
    assert_eq!(
      safe_torrent_path(root, Path::new("chapter/001.cbz")).unwrap(),
      root.join("chapter/001.cbz")
    );
    assert!(safe_torrent_path(root, Path::new("../outside")).is_err());
    assert!(safe_torrent_path(root, Path::new("/absolute")).is_err());
    assert!(safe_torrent_path(root, Path::new("")).is_err());
  }

  #[cfg(feature = "bittorrent")]
  #[tokio::test]
  async fn removing_a_torrent_clears_its_handle_and_fast_resume() {
    use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, CreateTorrentOptions};
    use tempfile::TempDir;

    let root = TempDir::new().unwrap();
    let source_path = root.path().join("payload.bin");
    let payload = b"local torrent cleanup fixture";
    tokio::fs::write(&source_path, payload).await.unwrap();
    let torrent = librqbit::create_torrent(&source_path, CreateTorrentOptions::default())
      .await
      .unwrap();
    let torrent_bytes = torrent.as_bytes().unwrap();
    let info_hash = torrent.info_hash().as_string();
    let destination = root.path().join("destination");
    tokio::fs::create_dir_all(&destination).await.unwrap();
    let downloaded_path = destination.join("payload.bin");
    tokio::fs::write(&downloaded_path, payload).await.unwrap();

    let session_dir = root.path().join("session");
    let manager = TorrentManager::new(session_dir.clone()).await.unwrap();
    let add_precompleted = || {
      manager.session.add_torrent(
        AddTorrent::from_bytes(torrent_bytes.clone()),
        Some(AddTorrentOptions {
          output_folder: Some(destination.to_string_lossy().into_owned()),
          overwrite: true,
          ..Default::default()
        }),
      )
    };

    let response = add_precompleted().await.unwrap();
    let (id, handle) = match response {
      AddTorrentResponse::Added(id, handle) => (id, handle),
      _ => panic!("fresh torrent was not added"),
    };
    tokio::time::timeout(Duration::from_secs(5), handle.wait_until_initialized())
      .await
      .expect("precompleted torrent initialization timed out")
      .unwrap();
    assert!(handle.stats().finished);

    manager
      .remove(Some(id as u64), Some(&info_hash), false)
      .await
      .unwrap();
    assert!(manager.session.get(id.into()).is_none());
    assert!(tokio::fs::try_exists(&downloaded_path).await.unwrap());
    let persisted = tokio::fs::read_to_string(session_dir.join("session.json"))
      .await
      .unwrap();
    assert!(!persisted.contains(&info_hash));

    let response = add_precompleted().await.unwrap();
    let (id, handle) = match response {
      AddTorrentResponse::Added(id, handle) => (id, handle),
      _ => panic!("deleted torrent handle was not re-added"),
    };
    tokio::time::timeout(Duration::from_secs(5), handle.wait_until_initialized())
      .await
      .expect("re-added torrent initialization timed out")
      .unwrap();
    manager
      .remove(Some(id as u64), Some(&info_hash), true)
      .await
      .unwrap();
    assert!(manager.session.get(id.into()).is_none());
    assert!(!tokio::fs::try_exists(&downloaded_path).await.unwrap());
    manager.stop().await.unwrap();
  }

  #[cfg(feature = "bittorrent")]
  fn reserve_loopback_port() -> u16 {
    loop {
      let listener = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).unwrap();
      let port = listener.local_addr().unwrap().port();
      drop(listener);
      if port < u16::MAX {
        return port;
      }
    }
  }

  #[cfg(feature = "bittorrent")]
  fn offline_session_options(
    listen_port_range: Option<std::ops::Range<u16>>,
    persistence: Option<librqbit::SessionPersistenceConfig>,
  ) -> librqbit::SessionOptions {
    librqbit::SessionOptions {
      disable_dht: true,
      disable_dht_persistence: true,
      enable_upnp_port_forwarding: false,
      fastresume: persistence.is_some(),
      listen_port_range,
      persistence,
      ..Default::default()
    }
  }

  #[cfg(feature = "bittorrent")]
  #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
  async fn local_sessions_transfer_a_selected_file_from_magnet_after_resume() {
    use librqbit::{AddTorrent, AddTorrentOptions, CreateTorrentOptions, Magnet, Session};
    use tempfile::TempDir;

    let root = TempDir::new().unwrap();
    let source = root.path().join("seed");
    tokio::fs::create_dir_all(&source).await.unwrap();
    let ignored_payload = vec![0x31; 32 * 1024];
    let selected_payload = (0..64 * 1024)
      .map(|index| (index % 251) as u8)
      .collect::<Vec<_>>();
    tokio::fs::write(source.join("ignored.bin"), ignored_payload)
      .await
      .unwrap();
    tokio::fs::write(source.join("selected.bin"), &selected_payload)
      .await
      .unwrap();

    let torrent = librqbit::create_torrent(
      &source,
      CreateTorrentOptions {
        name: Some("offline-transfer"),
        piece_length: Some(4 * 1024),
      },
    )
    .await
    .unwrap();
    let torrent_bytes = torrent.as_bytes().unwrap();

    let listen_port = reserve_loopback_port();
    let seeder = Session::new_with_opts(
      root.path().join("unused-seeder-output"),
      offline_session_options(Some(listen_port..listen_port + 1), None),
    )
    .await
    .unwrap();
    let seeder_handle = tokio::time::timeout(
      Duration::from_secs(5),
      seeder.add_torrent(
        AddTorrent::from_bytes(torrent_bytes),
        Some(AddTorrentOptions {
          output_folder: Some(source.to_string_lossy().into_owned()),
          overwrite: true,
          ..Default::default()
        }),
      ),
    )
    .await
    .expect("seeder add timed out")
    .unwrap()
    .into_handle()
    .unwrap();
    tokio::time::timeout(Duration::from_secs(5), seeder_handle.wait_until_completed())
      .await
      .expect("seeder initialization timed out")
      .unwrap();

    let (selected_index, selected_relative_path) = seeder_handle
      .with_metadata(|metadata| {
        metadata
          .file_infos
          .iter()
          .enumerate()
          .find(|(_, file)| file.relative_filename.file_name() == Some("selected.bin".as_ref()))
          .map(|(index, file)| (index, file.relative_filename.clone()))
      })
      .unwrap()
      .expect("selected fixture file is missing from torrent metadata");

    let destination = root.path().join("leecher-output");
    let leecher = Session::new_with_opts(
      root.path().join("unused-leecher-output"),
      offline_session_options(None, None),
    )
    .await
    .unwrap();
    let magnet = Magnet::from_id20(torrent.info_hash(), Vec::new(), None).to_string();
    let peer = std::net::SocketAddr::from((std::net::Ipv4Addr::LOCALHOST, listen_port));
    let leecher_handle = tokio::time::timeout(
      Duration::from_secs(8),
      leecher.add_torrent(
        AddTorrent::from_url(magnet),
        Some(AddTorrentOptions {
          paused: true,
          only_files: Some(vec![selected_index]),
          output_folder: Some(destination.to_string_lossy().into_owned()),
          initial_peers: Some(vec![peer]),
          overwrite: true,
          ..Default::default()
        }),
      ),
    )
    .await
    .expect("magnet metadata resolution timed out")
    .unwrap()
    .into_handle()
    .unwrap();
    tokio::time::timeout(
      Duration::from_secs(5),
      leecher_handle.wait_until_initialized(),
    )
    .await
    .expect("paused leecher initialization timed out")
    .unwrap();
    assert!(leecher_handle.is_paused());
    assert_eq!(leecher_handle.only_files(), Some(vec![selected_index]));

    leecher.unpause(&leecher_handle).await.unwrap();
    tokio::time::timeout(
      Duration::from_secs(10),
      leecher_handle.wait_until_completed(),
    )
    .await
    .expect("local torrent transfer timed out")
    .unwrap();
    assert!(leecher_handle.stats().finished);
    assert_eq!(
      tokio::fs::read(destination.join(selected_relative_path))
        .await
        .unwrap(),
      selected_payload
    );

    leecher.stop().await;
    seeder.stop().await;
  }

  #[cfg(feature = "bittorrent")]
  #[tokio::test(flavor = "multi_thread", worker_threads = 2)]
  async fn json_fast_resume_restores_identity_pause_selection_and_destination() {
    use librqbit::{
      AddTorrent, AddTorrentOptions, AddTorrentResponse, CreateTorrentOptions, Session,
      SessionPersistenceConfig,
    };
    use tempfile::TempDir;

    let root = TempDir::new().unwrap();
    let source = root.path().join("source.bin");
    tokio::fs::write(&source, vec![0x7a; 32 * 1024])
      .await
      .unwrap();
    let torrent = librqbit::create_torrent(
      &source,
      CreateTorrentOptions {
        name: Some("resume.bin"),
        piece_length: Some(4 * 1024),
      },
    )
    .await
    .unwrap();
    let torrent_bytes = torrent.as_bytes().unwrap();
    let persistence_dir = root.path().join("session");
    let destination = root.path().join("restored-output");
    let persistence = || SessionPersistenceConfig::Json {
      folder: Some(persistence_dir.clone()),
    };

    let first = Session::new_with_opts(
      root.path().join("unused-default-output"),
      offline_session_options(None, Some(persistence())),
    )
    .await
    .unwrap();
    let response = first
      .add_torrent(
        AddTorrent::from_bytes(torrent_bytes),
        Some(AddTorrentOptions {
          paused: true,
          only_files: Some(vec![0]),
          output_folder: Some(destination.to_string_lossy().into_owned()),
          overwrite: true,
          ..Default::default()
        }),
      )
      .await
      .unwrap();
    let (id, handle) = match response {
      AddTorrentResponse::Added(id, handle) => (id, handle),
      _ => panic!("fresh persisted torrent was not added"),
    };
    tokio::time::timeout(Duration::from_secs(5), handle.wait_until_initialized())
      .await
      .expect("persisted torrent initialization timed out")
      .unwrap();
    assert!(handle.is_paused());
    assert_eq!(handle.only_files(), Some(vec![0]));
    let info_hash = handle.info_hash();
    first.stop().await;
    drop(handle);
    drop(first);

    let persisted = tokio::fs::read_to_string(persistence_dir.join("session.json"))
      .await
      .unwrap();
    assert!(persisted.contains(&destination.to_string_lossy().into_owned()));

    let restored_session = Session::new_with_opts(
      root.path().join("different-unused-default"),
      offline_session_options(None, Some(persistence())),
    )
    .await
    .unwrap();
    let restored = restored_session
      .get(id.into())
      .expect("persisted torrent handle was not restored");
    tokio::time::timeout(Duration::from_secs(5), restored.wait_until_initialized())
      .await
      .expect("restored torrent initialization timed out")
      .unwrap();
    assert_eq!(restored.id(), id);
    assert_eq!(restored.info_hash(), info_hash);
    assert_eq!(restored.only_files(), Some(vec![0]));
    assert!(restored.is_paused());
    restored_session.stop().await;
  }

  #[cfg(feature = "bittorrent")]
  fn settings() -> DownloaderSettings {
    DownloaderSettings {
      seed_on_complete: true,
      seed_ratio: Some(1.5),
      seed_seconds: Some(3_600),
      ..DownloaderSettings::platform_default()
    }
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn empty_file_selection_means_all_files() {
    assert_eq!(normalize_only_files(&[]), None);
    assert!(same_file_selection(None, &None));
    assert!(!same_file_selection(Some(Vec::new()), &None));
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn file_selection_is_compared_as_a_set() {
    let expected = normalize_only_files(&[4, 1, 4]);
    assert_eq!(expected, Some(vec![1, 4]));
    assert!(same_file_selection(Some(vec![4, 1]), &expected));
    assert!(!same_file_selection(Some(vec![1, 3]), &expected));
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn seeding_is_opt_in_and_source_policy_overrides_thresholds() {
    let mut disabled = settings();
    disabled.seed_on_complete = false;
    assert!(matches!(
      effective_seed_policy(
        Some(&SeedPolicy::Duration {
          duration_seconds: 5
        }),
        &disabled
      ),
      SeedPolicy::None
    ));

    assert!(matches!(
      effective_seed_policy(
        Some(&SeedPolicy::Duration {
          duration_seconds: 5
        }),
        &settings()
      ),
      SeedPolicy::Duration {
        duration_seconds: 5
      }
    ));
    assert!(matches!(
      effective_seed_policy(None, &settings()),
      SeedPolicy::RatioOrDuration {
        ratio: 1.5,
        duration_seconds: 3_600
      }
    ));
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn ratio_uses_the_real_selected_total() {
    let policy = SeedPolicy::Ratio { ratio: 1.5 };
    assert!(!seed_target_reached(&policy, 1_499, 1_000, 0));
    assert!(seed_target_reached(&policy, 1_500, 1_000, 0));
    assert!(!seed_target_reached(&policy, 1, 0, 0));
  }

  #[cfg(feature = "bittorrent")]
  #[test]
  fn ratio_or_duration_stops_at_either_threshold() {
    let policy = SeedPolicy::RatioOrDuration {
      ratio: 2.0,
      duration_seconds: 60,
    };
    assert!(seed_target_reached(&policy, 2_000, 1_000, 5));
    assert!(seed_target_reached(&policy, 0, 1_000, 60));
    assert!(!seed_target_reached(&policy, 1_000, 1_000, 59));
  }
}
