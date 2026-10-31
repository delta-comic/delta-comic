use std::{
  collections::BTreeMap,
  io,
  sync::{
    Arc, Mutex,
    atomic::{AtomicUsize, Ordering},
  },
};

use axum::{
  Router,
  body::Body,
  extract::State,
  http::{HeaderMap, Response, StatusCode, header},
  routing::get,
};
use futures_util::stream;
use tempfile::TempDir;
use tokio::{net::TcpListener, task::JoinHandle};
use tokio_util::sync::CancellationToken;

use super::{DownloadRequest, download, persist_integrity_samples};
use crate::{
  domain::{
    Destination, DestinationKind, DownloadSource, DownloadTask, DownloaderSettings, HttpMirror,
    HttpSource, TaskKind, TaskStatus,
  },
  error::Error,
  persistence::{CompletedRange, Repository, now_millis},
};

#[derive(Clone, Copy)]
enum FaultMode {
  Standard,
  IgnoreRange,
  LastModified,
  ShortBody,
  Disconnect,
}

#[derive(Clone)]
struct FaultState {
  bytes: Arc<Vec<u8>>,
  mode: FaultMode,
  request_count: Arc<AtomicUsize>,
  requests: Arc<Mutex<Vec<(u64, u64)>>>,
}

struct FaultServer {
  handle: JoinHandle<()>,
  requests: Arc<Mutex<Vec<(u64, u64)>>>,
  url: String,
}

impl Drop for FaultServer {
  fn drop(&mut self) {
    self.handle.abort();
  }
}

impl FaultServer {
  async fn start(bytes: Vec<u8>, mode: FaultMode) -> Self {
    let requests = Arc::new(Mutex::new(Vec::new()));
    let state = FaultState {
      bytes: Arc::new(bytes),
      mode,
      request_count: Arc::new(AtomicUsize::new(0)),
      requests: requests.clone(),
    };
    let app = Router::new()
      .route("/file", get(serve_file))
      .with_state(state);
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    let handle = tokio::spawn(async move {
      axum::serve(listener, app).await.unwrap();
    });
    Self {
      handle,
      requests,
      url: format!("http://{address}/file"),
    }
  }

  fn requested_ranges(&self) -> Vec<(u64, u64)> {
    self.requests.lock().unwrap().clone()
  }
}

async fn serve_file(State(state): State<FaultState>, headers: HeaderMap) -> Response<Body> {
  if matches!(state.mode, FaultMode::IgnoreRange) {
    return Response::builder()
      .status(StatusCode::OK)
      .header(header::CONTENT_LENGTH, state.bytes.len())
      .body(Body::from(state.bytes.as_ref().clone()))
      .unwrap();
  }

  let Some((requested_start, requested_end)) = headers
    .get(header::RANGE)
    .and_then(|value| value.to_str().ok())
    .and_then(parse_request_range)
  else {
    return Response::builder()
      .status(StatusCode::BAD_REQUEST)
      .body(Body::empty())
      .unwrap();
  };
  state
    .requests
    .lock()
    .unwrap()
    .push((requested_start, requested_end));
  let request_index = state.request_count.fetch_add(1, Ordering::AcqRel);

  let total = state.bytes.len() as u64;
  let start = requested_start.min(total.saturating_sub(1));
  let mut end = requested_end.min(total);
  if start >= end {
    end = (start + 1).min(total);
  }

  let mut response = Response::builder()
    .status(StatusCode::PARTIAL_CONTENT)
    .header(
      header::CONTENT_RANGE,
      format!("bytes {start}-{}/{total}", end - 1),
    );
  response = match state.mode {
    FaultMode::LastModified => {
      response.header(header::LAST_MODIFIED, "Wed, 21 Oct 2015 07:28:00 GMT")
    }
    _ => response.header(header::ETAG, "\"fixture-v1\""),
  };
  let bytes = state.bytes[start as usize..end as usize].to_vec();
  let body = match state.mode {
    FaultMode::ShortBody if request_index > 0 => {
      let shortened = bytes[..bytes.len() / 2].to_vec();
      Body::from_stream(stream::iter([Ok::<_, io::Error>(shortened)]))
    }
    FaultMode::Disconnect if request_index > 0 => {
      let prefix_end = (bytes.len() / 2).max(1).min(bytes.len());
      Body::from_stream(stream::iter([
        Ok(bytes[..prefix_end].to_vec()),
        Err(io::Error::new(
          io::ErrorKind::ConnectionReset,
          "injected response interruption",
        )),
      ]))
    }
    _ => Body::from(bytes),
  };
  response.body(body).unwrap()
}

fn parse_request_range(value: &str) -> Option<(u64, u64)> {
  let (start, inclusive_end) = value.strip_prefix("bytes=")?.split_once('-')?;
  Some((
    start.parse().ok()?,
    inclusive_end.parse::<u64>().ok()?.checked_add(1)?,
  ))
}

fn fixture(size: usize) -> Vec<u8> {
  (0..size).map(|index| (index % 251) as u8).collect()
}

async fn setup_task(
  root: &TempDir,
  url: &str,
  expected_size: Option<u64>,
) -> (Repository, DownloadTask, HttpSource, DownloaderSettings) {
  let repository = Repository::memory().await.unwrap();
  let destination = Destination {
    id: "default".into(),
    label: "test".into(),
    kind: DestinationKind::Managed,
    path: root.path().to_string_lossy().into_owned(),
    is_default: true,
  };
  let mut settings = DownloaderSettings::platform_default();
  settings.per_task_connections = 4;
  repository
    .initialize(&destination, &settings)
    .await
    .unwrap();
  let source = HttpSource {
    mirrors: vec![HttpMirror {
      url: url.into(),
      priority: 1,
      headers: BTreeMap::new(),
    }],
    expected_size,
    etag: None,
    last_modified: None,
    expires_at: None,
  };
  let timestamp = now_millis();
  let mut task = DownloadTask {
    id: uuid::Uuid::new_v4().to_string(),
    collection_key: None,
    asset_key: Some("fixture".into()),
    kind: TaskKind::Http,
    title: "fixture".into(),
    source: DownloadSource::Http(source.clone()),
    destination_id: "default".into(),
    relative_path: "fixture.bin".into(),
    status: TaskStatus::Queued,
    priority: 5,
    queue_position: timestamp,
    total_bytes: None,
    downloaded_bytes: 0,
    speed_bytes_per_second: 0,
    error_code: None,
    error_message: None,
    checksum: None,
    etag: None,
    last_modified: None,
    final_path: Some(
      root
        .path()
        .join("fixture.bin")
        .to_string_lossy()
        .into_owned(),
    ),
    retry_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
    revision: 0,
  };
  repository.insert_task(&mut task).await.unwrap();
  (repository, task, source, settings)
}

async fn run_fixture(mode: FaultMode, size: usize, expected_size: Option<u64>) -> Vec<u8> {
  let bytes = fixture(size);
  let server = FaultServer::start(bytes.clone(), mode).await;
  let root = TempDir::new().unwrap();
  let (repository, task, source, settings) = setup_task(&root, &server.url, expected_size).await;
  let partial = root.path().join("fixture.bin.part");
  let report = download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      target_file: None,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
      progress: None,
    },
  )
  .await
  .unwrap();
  assert_eq!(report.total_bytes, bytes.len() as u64);
  tokio::fs::read(partial).await.unwrap()
}

async fn run_error(mode: FaultMode, size: usize, expected_size: Option<u64>) -> Error {
  let server = FaultServer::start(fixture(size), mode).await;
  let root = TempDir::new().unwrap();
  let (repository, task, source, settings) = setup_task(&root, &server.url, expected_size).await;
  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &root.path().join("fixture.bin.part"),
      target_file: None,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
      progress: None,
    },
  )
  .await
  .unwrap_err()
}

async fn assert_stale_resume_restarts(
  mode: FaultMode,
  size: usize,
  previous_total: u64,
  previous_etag: Option<&str>,
  previous_last_modified: Option<&str>,
) {
  let bytes = fixture(size);
  let server = FaultServer::start(bytes.clone(), mode).await;
  let root = TempDir::new().unwrap();
  let (repository, mut task, source, settings) = setup_task(&root, &server.url, None).await;
  let completed = 1024 * 1024_u64;
  task.total_bytes = Some(previous_total);
  task.etag = previous_etag.map(str::to_owned);
  task.last_modified = previous_last_modified.map(str::to_owned);
  repository
    .update_probe(
      &task.id,
      task.total_bytes,
      task.etag.as_deref(),
      task.last_modified.as_deref(),
    )
    .await
    .unwrap();
  repository
    .replace_completed_ranges(
      &task.id,
      &[CompletedRange {
        start: 0,
        end: completed,
      }],
    )
    .await
    .unwrap();
  let partial = root.path().join("fixture.bin.part");
  tokio::fs::write(&partial, &bytes[..completed as usize])
    .await
    .unwrap();
  let partial_file = std::fs::OpenOptions::new()
    .read(true)
    .write(true)
    .open(&partial)
    .unwrap();
  persist_integrity_samples(
    &repository,
    &task.id,
    &partial_file,
    &[CompletedRange {
      start: 0,
      end: completed,
    }],
  )
  .await
  .unwrap();

  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      target_file: None,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
      progress: None,
    },
  )
  .await
  .unwrap();

  assert_eq!(tokio::fs::read(partial).await.unwrap(), bytes);
  assert!(
    server
      .requested_ranges()
      .into_iter()
      .filter(|range| *range != (0, 1))
      .any(|(start, end)| start == 0 && end > 1),
    "stale metadata must restart transfer from byte zero",
  );
}

#[tokio::test]
async fn downloads_parallel_standard_ranges() {
  let size = 9 * 1024 * 1024 + 37;
  assert_eq!(
    run_fixture(FaultMode::Standard, size, Some(size as u64)).await,
    fixture(size),
  );
}

#[tokio::test]
async fn falls_back_when_server_ignores_ranges() {
  let size = 512 * 1024 + 13;
  assert_eq!(
    run_fixture(FaultMode::IgnoreRange, size, Some(size as u64)).await,
    fixture(size),
  );
}

#[tokio::test]
async fn stale_etag_last_modified_or_length_restart_from_zero() {
  let size = 9 * 1024 * 1024 + 37;
  assert_stale_resume_restarts(
    FaultMode::Standard,
    size,
    size as u64,
    Some("\"fixture-v0\""),
    None,
  )
  .await;
  assert_stale_resume_restarts(
    FaultMode::LastModified,
    size,
    size as u64,
    None,
    Some("Tue, 20 Oct 2015 07:28:00 GMT"),
  )
  .await;
  assert_stale_resume_restarts(
    FaultMode::Standard,
    size,
    size as u64 - 4096,
    Some("\"fixture-v1\""),
    None,
  )
  .await;
}

#[tokio::test]
async fn rejects_short_or_interrupted_range_bodies_without_committing_them_as_complete() {
  let size = 9 * 1024 * 1024 + 37;
  assert!(matches!(
    run_error(FaultMode::ShortBody, size, Some(size as u64)).await,
    Error::InvalidInput(message) if message.contains("ended before Content-Range")
  ));
  assert!(matches!(
    run_error(FaultMode::Disconnect, size, Some(size as u64)).await,
    Error::Network(_)
  ));
}

#[cfg(unix)]
#[tokio::test]
async fn refuses_a_symlinked_partial_file_without_touching_its_target() {
  use std::os::unix::fs::symlink;

  let size = 512 * 1024 + 13;
  let server = FaultServer::start(fixture(size), FaultMode::Standard).await;
  let root = TempDir::new().unwrap();
  let outside = TempDir::new().unwrap();
  let escaped = outside.path().join("escaped.bin");
  tokio::fs::write(&escaped, b"must remain unchanged")
    .await
    .unwrap();
  let partial = root.path().join("fixture.bin.part");
  symlink(&escaped, &partial).unwrap();
  let (repository, task, source, settings) =
    setup_task(&root, &server.url, Some(size as u64)).await;

  let error = download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      target_file: None,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
      progress: None,
    },
  )
  .await
  .unwrap_err();

  assert!(matches!(error, Error::InvalidInput(message) if message.contains("symbolic link")));
  assert_eq!(
    tokio::fs::read(&escaped).await.unwrap(),
    b"must remain unchanged"
  );
}

#[tokio::test]
async fn resume_requests_only_missing_ranges() {
  let size = 9 * 1024 * 1024 + 37;
  let completed = 2 * 1024 * 1024_u64;
  let bytes = fixture(size);
  let server = FaultServer::start(bytes.clone(), FaultMode::Standard).await;
  let root = TempDir::new().unwrap();
  let (repository, mut task, source, settings) =
    setup_task(&root, &server.url, Some(size as u64)).await;
  task.total_bytes = Some(size as u64);
  task.etag = Some("\"fixture-v1\"".into());
  repository
    .update_probe(
      &task.id,
      task.total_bytes,
      task.etag.as_deref(),
      task.last_modified.as_deref(),
    )
    .await
    .unwrap();
  repository
    .replace_completed_ranges(
      &task.id,
      &[CompletedRange {
        start: 0,
        end: completed,
      }],
    )
    .await
    .unwrap();
  let partial = root.path().join("fixture.bin.part");
  tokio::fs::write(&partial, &bytes[..completed as usize])
    .await
    .unwrap();
  let partial_file = std::fs::OpenOptions::new()
    .read(true)
    .write(true)
    .open(&partial)
    .unwrap();
  persist_integrity_samples(
    &repository,
    &task.id,
    &partial_file,
    &[CompletedRange {
      start: 0,
      end: completed,
    }],
  )
  .await
  .unwrap();

  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      target_file: None,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
      progress: None,
    },
  )
  .await
  .unwrap();

  assert_eq!(tokio::fs::read(&partial).await.unwrap(), bytes);
  assert!(
    server
      .requested_ranges()
      .into_iter()
      .filter(|range| *range != (0, 1))
      .all(|(start, _)| start >= completed),
  );
}
