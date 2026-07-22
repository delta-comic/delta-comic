use std::{
  collections::BTreeMap,
  io,
  sync::{
    Arc, Mutex,
    atomic::{AtomicBool, AtomicUsize, Ordering},
  },
  time::Duration,
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
  ShiftOnce(i64),
  IgnoreRange,
  Overflow,
  UnknownLength,
  NoValidator,
  LastModified,
  RetryAfter,
  Status(StatusCode),
  StatusAfterProbe(StatusCode),
  ChangedEtagAfterProbe,
  ChangedLastModifiedAfterProbe,
  ChangedTotalAfterProbe,
  ShortBody,
  Disconnect,
  Slow,
}

#[derive(Clone)]
struct FaultState {
  bytes: Arc<Vec<u8>>,
  mode: FaultMode,
  mismatch_pending: Arc<AtomicBool>,
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
      mismatch_pending: Arc::new(AtomicBool::new(true)),
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

  fn clear_requests(&self) {
    self.requests.lock().unwrap().clear();
  }
}

async fn serve_file(State(state): State<FaultState>, headers: HeaderMap) -> Response<Body> {
  if let FaultMode::Status(status) = state.mode {
    return Response::builder()
      .status(status)
      .body(Body::empty())
      .unwrap();
  }
  if matches!(state.mode, FaultMode::RetryAfter) {
    return Response::builder()
      .status(StatusCode::SERVICE_UNAVAILABLE)
      .header(header::RETRY_AFTER, "0")
      .body(Body::empty())
      .unwrap();
  }
  if matches!(state.mode, FaultMode::IgnoreRange) {
    return Response::builder()
      .status(StatusCode::OK)
      .header(header::CONTENT_LENGTH, state.bytes.len())
      .body(Body::from(state.bytes.as_ref().clone()))
      .unwrap();
  }
  if matches!(state.mode, FaultMode::UnknownLength) {
    let midpoint = state.bytes.len() / 2;
    let chunks = vec![
      Ok::<_, std::convert::Infallible>(state.bytes[..midpoint].to_vec()),
      Ok(state.bytes[midpoint..].to_vec()),
    ];
    return Response::builder()
      .status(StatusCode::OK)
      .body(Body::from_stream(stream::iter(chunks)))
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

  if request_index > 0
    && let FaultMode::StatusAfterProbe(status) = state.mode
  {
    return Response::builder()
      .status(status)
      .body(Body::empty())
      .unwrap();
  }

  let total = state.bytes.len() as u64;
  let mut start = requested_start.min(total.saturating_sub(1));
  let mut end = requested_end.min(total);
  if requested_start != 0
    && state.mismatch_pending.swap(false, Ordering::AcqRel)
    && let FaultMode::ShiftOnce(delta) = state.mode
  {
    if delta.is_negative() {
      start = start.saturating_sub(delta.unsigned_abs());
    } else {
      start = start
        .saturating_add(delta as u64)
        .min(total.saturating_sub(1));
      end = end.saturating_add(delta as u64).min(total);
    }
  }
  if start >= end {
    end = (start + 1).min(total);
  }

  let declared_end = if matches!(state.mode, FaultMode::Overflow)
    && requested_start != 0
    && end.saturating_sub(start) > 1
  {
    end - 1
  } else {
    end
  };
  let declared_total =
    if request_index > 0 && matches!(state.mode, FaultMode::ChangedTotalAfterProbe) {
      total + 1
    } else {
      total
    };
  let mut response = Response::builder()
    .status(StatusCode::PARTIAL_CONTENT)
    .header(
      header::CONTENT_RANGE,
      format!("bytes {start}-{}/{declared_total}", declared_end - 1),
    );
  match state.mode {
    FaultMode::NoValidator => {}
    FaultMode::LastModified => {
      response = response.header(header::LAST_MODIFIED, "Wed, 21 Oct 2015 07:28:00 GMT");
    }
    FaultMode::ChangedLastModifiedAfterProbe => {
      let value = if request_index == 0 {
        "Wed, 21 Oct 2015 07:28:00 GMT"
      } else {
        "Thu, 22 Oct 2015 07:28:00 GMT"
      };
      response = response.header(header::LAST_MODIFIED, value);
    }
    FaultMode::ChangedEtagAfterProbe => {
      let value = if request_index == 0 {
        "\"fixture-v1\""
      } else {
        "\"fixture-v2\""
      };
      response = response.header(header::ETAG, value);
    }
    _ => {
      response = response.header(header::ETAG, "\"fixture-v1\"");
    }
  }
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
    FaultMode::Slow if request_index > 0 => Body::from_stream(stream::unfold(
      (bytes, 0_usize),
      |(bytes, offset)| async move {
        if offset >= bytes.len() {
          return None;
        }
        tokio::time::sleep(Duration::from_millis(5)).await;
        let end = (offset + 64 * 1024).min(bytes.len());
        let chunk = bytes[offset..end].to_vec();
        Some((Ok::<_, io::Error>(chunk), (bytes, end)))
      },
    )),
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
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
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
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
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

  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
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
async fn obeys_earlier_and_later_content_range_offsets() {
  let size = 9 * 1024 * 1024 + 37;
  for shift in [-257, 257] {
    assert_eq!(
      run_fixture(FaultMode::ShiftOnce(shift), size, Some(size as u64)).await,
      fixture(size),
    );
  }
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
async fn accepts_unknown_length_sequential_responses() {
  let size = 512 * 1024 + 13;
  assert_eq!(
    run_fixture(FaultMode::UnknownLength, size, None).await,
    fixture(size),
  );
}

#[tokio::test]
async fn maps_416_during_probe_or_transfer_to_remote_changed() {
  let size = 512 * 1024 + 13;
  for mode in [
    FaultMode::Status(StatusCode::RANGE_NOT_SATISFIABLE),
    FaultMode::StatusAfterProbe(StatusCode::RANGE_NOT_SATISFIABLE),
  ] {
    assert!(matches!(
      run_error(mode, size, Some(size as u64)).await,
      Error::RemoteChanged
    ));
  }
}

#[tokio::test]
async fn maps_401_and_403_during_probe_or_transfer_to_source_expired() {
  let size = 512 * 1024 + 13;
  for status in [StatusCode::UNAUTHORIZED, StatusCode::FORBIDDEN] {
    for mode in [
      FaultMode::Status(status),
      FaultMode::StatusAfterProbe(status),
    ] {
      assert!(matches!(
        run_error(mode, size, Some(size as u64)).await,
        Error::SourceExpired
      ));
    }
  }
}

#[tokio::test]
async fn detects_validator_and_total_changes_after_probe() {
  let size = 512 * 1024 + 13;
  for mode in [
    FaultMode::ChangedEtagAfterProbe,
    FaultMode::ChangedLastModifiedAfterProbe,
    FaultMode::ChangedTotalAfterProbe,
  ] {
    assert!(matches!(
      run_error(mode, size, Some(size as u64)).await,
      Error::RemoteChanged
    ));
  }
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
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
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
async fn exposes_retry_after_for_scheduler_backoff() {
  let error = run_error(FaultMode::RetryAfter, 1024, Some(1024)).await;
  assert!(matches!(
    error,
    Error::RetryableHttp {
      status: 503,
      retry_after_millis: Some(0),
    }
  ));
}

#[tokio::test]
async fn rejects_a_body_that_exceeds_content_range() {
  let size = 9 * 1024 * 1024 + 37;
  let bytes = fixture(size);
  let server = FaultServer::start(bytes, FaultMode::Overflow).await;
  let root = TempDir::new().unwrap();
  let (repository, task, source, settings) =
    setup_task(&root, &server.url, Some(size as u64)).await;
  let error = download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &root.path().join("fixture.bin.part"),
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
    },
  )
  .await
  .unwrap_err();
  assert!(
    matches!(error, Error::InvalidInput(message) if message.contains("exceeded Content-Range"))
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

  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
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

#[tokio::test]
async fn cancellation_checkpoints_and_resume_only_requests_missing_ranges() {
  let size = 16 * 1024 * 1024 + 37;
  let bytes = fixture(size);
  let server = FaultServer::start(bytes.clone(), FaultMode::Slow).await;
  let root = TempDir::new().unwrap();
  let (repository, task, source, mut settings) =
    setup_task(&root, &server.url, Some(size as u64)).await;
  settings.per_task_connections = 2;
  let partial = root.path().join("fixture.bin.part");
  let cancellation = CancellationToken::new();

  let download_repository = repository.clone();
  let download_task = task.clone();
  let download_source = source.clone();
  let download_settings = settings.clone();
  let download_partial = partial.clone();
  let download_cancellation = cancellation.clone();
  let first_run = tokio::spawn(async move {
    download(
      &reqwest::Client::new(),
      DownloadRequest {
        repository: &download_repository,
        task: &download_task,
        source: &download_source,
        settings: &download_settings,
        temp_path: &download_partial,
        cancellation: download_cancellation,
        secret_resolver: None,
        maximum_bytes: None,
      },
    )
    .await
  });

  tokio::time::timeout(Duration::from_secs(5), async {
    loop {
      let completed = repository.completed_ranges(&task.id).await.unwrap();
      let completed_bytes = completed
        .iter()
        .map(|range| range.end - range.start)
        .sum::<u64>();
      if completed_bytes >= super::CHECKPOINT_BYTES && completed_bytes < size as u64 {
        break;
      }
      tokio::time::sleep(Duration::from_millis(10)).await;
    }
  })
  .await
  .expect("download should checkpoint before completing");
  cancellation.cancel();
  assert!(matches!(first_run.await.unwrap(), Err(Error::Cancelled)));

  let checkpointed = repository.completed_ranges(&task.id).await.unwrap();
  let checkpointed_bytes = checkpointed
    .iter()
    .map(|range| range.end - range.start)
    .sum::<u64>();
  assert!(checkpointed_bytes >= super::CHECKPOINT_BYTES);
  assert!(checkpointed_bytes < size as u64);

  server.clear_requests();
  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
    },
  )
  .await
  .unwrap();

  assert_eq!(tokio::fs::read(partial).await.unwrap(), bytes);
  let resumed_requests = server
    .requested_ranges()
    .into_iter()
    .filter(|range| *range != (0, 1))
    .collect::<Vec<_>>();
  assert!(!resumed_requests.is_empty());
  assert!(resumed_requests.iter().all(|&(start, end)| {
    checkpointed
      .iter()
      .all(|completed| end <= completed.start || start >= completed.end)
  }));
}

#[tokio::test]
async fn resumes_without_validators_only_after_sample_verification() {
  let size = 5 * 1024 * 1024 + 37;
  let completed = 2 * 1024 * 1024_u64;
  let bytes = fixture(size);
  let server = FaultServer::start(bytes.clone(), FaultMode::NoValidator).await;
  let root = TempDir::new().unwrap();
  let (repository, mut task, source, settings) =
    setup_task(&root, &server.url, Some(size as u64)).await;
  task.total_bytes = Some(size as u64);
  repository
    .update_probe(&task.id, task.total_bytes, None, None)
    .await
    .unwrap();
  let range = CompletedRange {
    start: 0,
    end: completed,
  };
  repository
    .replace_completed_ranges(&task.id, &[range])
    .await
    .unwrap();
  let partial = root.path().join("fixture.bin.part");
  let file = std::fs::OpenOptions::new()
    .create(true)
    .truncate(true)
    .read(true)
    .write(true)
    .open(&partial)
    .unwrap();
  file.set_len(size as u64).unwrap();
  super::write_all_at(&file, &bytes[..completed as usize], 0).unwrap();
  persist_integrity_samples(&repository, &task.id, &file, &[range])
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
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
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
      .filter(|(start, end)| *end - *start > super::INTEGRITY_SAMPLE_BYTES)
      .all(|(start, _)| start >= completed),
  );
}

#[tokio::test]
async fn falls_back_to_the_next_mirror_by_priority() {
  let size = 512 * 1024 + 13;
  let bytes = fixture(size);
  let unavailable = FaultServer::start(Vec::new(), FaultMode::RetryAfter).await;
  let healthy = FaultServer::start(bytes.clone(), FaultMode::Standard).await;
  let root = TempDir::new().unwrap();
  let (repository, task, mut source, settings) =
    setup_task(&root, &healthy.url, Some(size as u64)).await;
  source.mirrors = vec![
    HttpMirror {
      url: unavailable.url.clone(),
      priority: 10,
      headers: BTreeMap::new(),
    },
    HttpMirror {
      url: healthy.url.clone(),
      priority: 1,
      headers: BTreeMap::new(),
    },
  ];
  let partial = root.path().join("fixture.bin.part");
  download(
    &reqwest::Client::new(),
    DownloadRequest {
      repository: &repository,
      task: &task,
      source: &source,
      settings: &settings,
      temp_path: &partial,
      cancellation: CancellationToken::new(),
      secret_resolver: None,
      maximum_bytes: None,
    },
  )
  .await
  .unwrap();
  assert_eq!(tokio::fs::read(partial).await.unwrap(), bytes);
}
