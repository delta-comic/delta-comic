use std::{
  collections::BTreeMap,
  path::{Path, PathBuf},
  sync::Arc,
  time::Duration,
};

use reqwest::Client;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::{
  SecretResolver,
  domain::{
    Destination, DestinationKind, DownloadSource, DownloadTask, DownloaderSettings,
    HttpHeaderValue, HttpMirror, HttpSource, TaskKind, TaskStatus,
  },
  error::{Error, Result},
  http,
  persistence::{Repository, now_millis},
};

pub(crate) const DEFAULT_MAX_BYTES: u64 = 64 * 1024 * 1024;
pub(crate) const HARD_MAX_BYTES: u64 = 128 * 1024 * 1024;

pub(crate) struct EphemeralRoot(PathBuf);

impl EphemeralRoot {
  pub(crate) fn new(path: PathBuf) -> Self {
    Self(path)
  }

  pub(crate) fn path(&self) -> &Path {
    &self.0
  }

  pub(crate) async fn clean_stale(&self) -> Result<usize> {
    tokio::fs::create_dir_all(&self.0).await?;
    let mut entries = tokio::fs::read_dir(&self.0).await?;
    let mut removed = 0;
    while let Some(entry) = entries.next_entry().await? {
      let name = entry.file_name();
      if !name.to_string_lossy().starts_with("request-") {
        continue;
      }
      let file_type = entry.file_type().await?;
      if file_type.is_dir() {
        tokio::fs::remove_dir_all(entry.path()).await?;
      } else {
        // A stale symlink is unlinked as an entry and is never followed.
        tokio::fs::remove_file(entry.path()).await?;
      }
      removed += 1;
    }
    Ok(removed)
  }
}

pub(crate) struct EphemeralDownloadRequest {
  pub url: String,
  pub headers: BTreeMap<String, String>,
  pub secret_ref: Option<String>,
  pub max_bytes: Option<u64>,
}

pub(crate) async fn download(
  client: &Client,
  secret_resolver: Option<&Arc<dyn SecretResolver>>,
  temporary_root: &Path,
  request: EphemeralDownloadRequest,
  cancellation: CancellationToken,
) -> Result<Vec<u8>> {
  let maximum_bytes = validate_maximum(request.max_bytes)?;
  let source = source_from_request(request)?;
  tokio::fs::create_dir_all(temporary_root).await?;
  let workspace = tempfile::Builder::new()
    .prefix("request-")
    .tempdir_in(temporary_root)?;
  let result = download_in_workspace(
    client,
    secret_resolver,
    workspace.path(),
    source,
    maximum_bytes,
    cancellation,
  )
  .await;
  workspace.close()?;
  result
}

async fn download_in_workspace(
  client: &Client,
  secret_resolver: Option<&Arc<dyn SecretResolver>>,
  workspace: &Path,
  source: HttpSource,
  maximum_bytes: u64,
  cancellation: CancellationToken,
) -> Result<Vec<u8>> {
  let payload_path = workspace.join("payload.part");
  let repository = Repository::memory().await?;
  let settings = DownloaderSettings::platform_default();
  let task = initialize_task(&repository, workspace, source.clone(), &settings).await?;

  let mut attempts = 0_u8;
  loop {
    let transfer = http::download(
      client,
      http::DownloadRequest {
        repository: &repository,
        task: &task,
        source: &source,
        settings: &settings,
        temp_path: &payload_path,
        target_file: None,
        cancellation: cancellation.clone(),
        secret_resolver: secret_resolver.map(Arc::as_ref),
        maximum_bytes: Some(maximum_bytes),
      },
    );
    let result = tokio::select! {
      () = cancellation.cancelled() => Err(Error::Cancelled),
      result = transfer => result,
    };
    match result {
      Ok(_) => break,
      Err(error) if error.is_transient() && attempts < 5 => {
        attempts += 1;
        let delay = Duration::from_secs(1_u64 << (attempts - 1)).max(error.retry_after());
        let jitter = rand::random_range(0..=500);
        tokio::select! {
          () = cancellation.cancelled() => return Err(Error::Cancelled),
          () = tokio::time::sleep(delay + Duration::from_millis(jitter)) => {},
        }
      }
      Err(error) => return Err(error),
    }
  }

  read_payload(&payload_path, maximum_bytes, &cancellation).await
}

fn validate_maximum(maximum_bytes: Option<u64>) -> Result<u64> {
  let maximum_bytes = maximum_bytes.unwrap_or(DEFAULT_MAX_BYTES);
  if maximum_bytes == 0 || maximum_bytes > HARD_MAX_BYTES {
    return Err(Error::InvalidInput(format!(
      "maxBytes must be between 1 and {HARD_MAX_BYTES}",
    )));
  }
  Ok(maximum_bytes)
}

fn source_from_request(request: EphemeralDownloadRequest) -> Result<HttpSource> {
  let mut headers = request
    .headers
    .into_iter()
    .map(|(name, value)| (name, HttpHeaderValue::Value { value }))
    .collect::<BTreeMap<_, _>>();
  if let Some(secret_ref) = request.secret_ref {
    if secret_ref.trim().is_empty() {
      return Err(Error::InvalidInput("secretRef must not be empty".into()));
    }
    if headers
      .keys()
      .any(|name| name.eq_ignore_ascii_case("authorization"))
    {
      return Err(Error::InvalidInput(
        "Authorization cannot be supplied by both headers and secretRef".into(),
      ));
    }
    headers.insert(
      "Authorization".into(),
      HttpHeaderValue::SecretRef { secret_ref },
    );
  }
  Ok(HttpSource {
    mirrors: vec![HttpMirror {
      url: request.url,
      priority: 0,
      headers,
    }],
    expected_size: None,
    etag: None,
    last_modified: None,
    expires_at: None,
  })
}

async fn initialize_task(
  repository: &Repository,
  workspace: &Path,
  source: HttpSource,
  settings: &DownloaderSettings,
) -> Result<DownloadTask> {
  let destination = Destination {
    id: "default".into(),
    label: "Ephemeral".into(),
    kind: DestinationKind::Managed,
    path: workspace.to_string_lossy().into_owned(),
    is_default: true,
  };
  repository.initialize(&destination, settings).await?;
  let now = now_millis();
  let mut task = DownloadTask {
    id: Uuid::new_v4().to_string(),
    collection_key: None,
    asset_key: None,
    kind: TaskKind::Http,
    title: "ephemeral".into(),
    source: DownloadSource::Http(source),
    destination_id: destination.id,
    relative_path: "payload".into(),
    status: TaskStatus::Queued,
    priority: 10,
    queue_position: 0,
    total_bytes: None,
    downloaded_bytes: 0,
    speed_bytes_per_second: 0,
    error_code: None,
    error_message: None,
    checksum: None,
    etag: None,
    last_modified: None,
    final_path: Some(workspace.join("payload").to_string_lossy().into_owned()),
    retry_count: 0,
    created_at: now,
    updated_at: now,
    revision: 0,
  };
  repository.insert_task(&mut task).await?;
  Ok(task)
}

async fn read_payload(
  path: &Path,
  maximum_bytes: u64,
  cancellation: &CancellationToken,
) -> Result<Vec<u8>> {
  let length = tokio::fs::metadata(path).await?.len();
  if length > maximum_bytes {
    return Err(Error::InvalidInput(format!(
      "download exceeds the {maximum_bytes} byte IPC limit",
    )));
  }
  tokio::select! {
    () = cancellation.cancelled() => Err(Error::Cancelled),
    result = tokio::fs::read(path) => result.map_err(Error::from),
  }
}

#[cfg(test)]
mod tests {
  use std::{
    collections::BTreeMap,
    convert::Infallible,
    sync::{
      Arc, Mutex as StdMutex,
      atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
  };

  use axum::{
    Router,
    body::Body,
    extract::State,
    http::{HeaderMap, Response, StatusCode, header::RANGE},
    routing::get,
  };
  use bytes::Bytes;
  use futures_util::stream;
  use tempfile::TempDir;
  use tokio::net::TcpListener;
  use tokio_util::sync::CancellationToken;

  use super::{
    DEFAULT_MAX_BYTES, EphemeralDownloadRequest, EphemeralRoot, HARD_MAX_BYTES, download,
    validate_maximum,
  };
  use crate::{engine::Engine, error::Error};

  #[derive(Clone)]
  struct RangeServerState {
    body: Arc<Vec<u8>>,
    requests: Arc<AtomicUsize>,
  }

  async fn range_response(
    State(state): State<RangeServerState>,
    headers: HeaderMap,
  ) -> Response<Body> {
    state.requests.fetch_add(1, Ordering::SeqCst);
    let Some(range) = headers
      .get(RANGE)
      .and_then(|value| value.to_str().ok())
      .and_then(|value| value.strip_prefix("bytes="))
    else {
      return Response::builder()
        .status(StatusCode::OK)
        .header("content-length", state.body.len())
        .body(Body::from(state.body.as_ref().clone()))
        .unwrap();
    };
    let (start, end) = range.split_once('-').unwrap();
    let start = start.parse::<usize>().unwrap();
    let end = end
      .parse::<usize>()
      .unwrap_or(state.body.len().saturating_sub(1))
      .min(state.body.len().saturating_sub(1));
    Response::builder()
      .status(StatusCode::PARTIAL_CONTENT)
      .header(
        "content-range",
        format!("bytes {start}-{end}/{}", state.body.len()),
      )
      .header("content-length", end - start + 1)
      .body(Body::from(state.body[start..=end].to_vec()))
      .unwrap()
  }

  async fn server(router: Router) -> String {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let address = listener.local_addr().unwrap();
    tokio::spawn(async move { axum::serve(listener, router).await.unwrap() });
    format!("http://{address}/payload")
  }

  fn request(url: String, max_bytes: Option<u64>) -> EphemeralDownloadRequest {
    EphemeralDownloadRequest {
      url,
      headers: BTreeMap::new(),
      secret_ref: None,
      max_bytes,
    }
  }

  async fn assert_empty(path: &std::path::Path) {
    if !tokio::fs::try_exists(path).await.unwrap() {
      return;
    }
    let mut entries = tokio::fs::read_dir(path).await.unwrap();
    assert!(entries.next_entry().await.unwrap().is_none());
  }

  #[test]
  fn validates_default_and_hard_ipc_limits() {
    assert_eq!(validate_maximum(None).unwrap(), DEFAULT_MAX_BYTES);
    assert_eq!(
      validate_maximum(Some(HARD_MAX_BYTES)).unwrap(),
      HARD_MAX_BYTES
    );
    assert!(validate_maximum(Some(0)).is_err());
    assert!(validate_maximum(Some(HARD_MAX_BYTES + 1)).is_err());
  }

  #[tokio::test]
  async fn downloads_through_the_range_core_and_removes_all_temporary_files() {
    let body: Arc<Vec<u8>> = Arc::new((0..1_000_000).map(|value| (value % 251) as u8).collect());
    let requests = Arc::new(AtomicUsize::new(0));
    let url = server(
      Router::new()
        .route("/payload", get(range_response))
        .with_state(RangeServerState {
          body: body.clone(),
          requests: requests.clone(),
        }),
    )
    .await;
    let root = TempDir::new().unwrap();
    let temporary_root = root.path().join("ephemeral");
    let client = reqwest::Client::new();

    let actual = download(
      &client,
      None,
      &temporary_root,
      request(url, Some(2_000_000)),
      CancellationToken::new(),
    )
    .await
    .unwrap();

    assert_eq!(actual, *body);
    assert!(requests.load(Ordering::SeqCst) >= 2);
    assert_empty(&temporary_root).await;
  }

  #[tokio::test]
  async fn rejects_oversized_probes_before_downloading_and_cleans_up() {
    let requests = Arc::new(AtomicUsize::new(0));
    let url = server(Router::new().route(
      "/payload",
      get({
        let requests = requests.clone();
        move || {
          let requests = requests.clone();
          async move {
            requests.fetch_add(1, Ordering::SeqCst);
            Response::builder()
              .status(StatusCode::PARTIAL_CONTENT)
              .header("content-range", "bytes 0-0/1000")
              .body(Body::from(vec![0]))
              .unwrap()
          }
        }
      }),
    ))
    .await;
    let root = TempDir::new().unwrap();
    let temporary_root = root.path().join("ephemeral");

    let error = download(
      &reqwest::Client::new(),
      None,
      &temporary_root,
      request(url, Some(100)),
      CancellationToken::new(),
    )
    .await
    .unwrap_err();

    assert!(error.to_string().contains("100 byte IPC limit"));
    assert_eq!(requests.load(Ordering::SeqCst), 1);
    assert_empty(&temporary_root).await;
  }

  #[tokio::test]
  async fn enforces_the_limit_for_unknown_length_sequential_responses() {
    let requests = Arc::new(AtomicUsize::new(0));
    let url = server(Router::new().route(
      "/payload",
      get({
        let requests = requests.clone();
        move || {
          let requests = requests.clone();
          async move {
            requests.fetch_add(1, Ordering::SeqCst);
            let chunks = stream::iter([
              Ok::<_, Infallible>(Bytes::from(vec![1_u8; 60])),
              Ok::<_, Infallible>(Bytes::from(vec![2_u8; 60])),
            ]);
            Response::builder()
              .status(StatusCode::OK)
              .body(Body::from_stream(chunks))
              .unwrap()
          }
        }
      }),
    ))
    .await;
    let root = TempDir::new().unwrap();
    let temporary_root = root.path().join("ephemeral");

    let error = download(
      &reqwest::Client::new(),
      None,
      &temporary_root,
      request(url, Some(100)),
      CancellationToken::new(),
    )
    .await
    .unwrap_err();

    assert!(error.to_string().contains("100 byte IPC limit"));
    assert_eq!(requests.load(Ordering::SeqCst), 2);
    assert_empty(&temporary_root).await;
  }

  #[tokio::test]
  async fn leaves_the_managed_repository_and_event_stream_untouched() {
    let body = Arc::new(b"isolated ephemeral payload".to_vec());
    let url = server(
      Router::new()
        .route("/payload", get(range_response))
        .with_state(RangeServerState {
          body: body.clone(),
          requests: Arc::new(AtomicUsize::new(0)),
        }),
    )
    .await;
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
    let temporary_root = root.path().join("ephemeral");

    let actual = engine
      .download_ephemeral(
        &temporary_root,
        request(url, None),
        CancellationToken::new(),
      )
      .await
      .unwrap();

    assert_eq!(actual, *body);
    assert!(engine.repository.list_tasks().await.unwrap().is_empty());
    assert!(events.lock().unwrap().is_empty());
    assert_empty(&temporary_root).await;
  }

  #[tokio::test]
  async fn failed_requests_and_cancellation_remove_the_workspace() {
    let failure_url =
      server(Router::new().route("/payload", get(|| async { StatusCode::NOT_FOUND }))).await;
    let root = TempDir::new().unwrap();
    let temporary_root = root.path().join("ephemeral");
    let error = download(
      &reqwest::Client::new(),
      None,
      &temporary_root,
      request(failure_url, None),
      CancellationToken::new(),
    )
    .await
    .unwrap_err();
    assert!(matches!(error, Error::InvalidInput(_)));
    assert_empty(&temporary_root).await;

    let cancellation = CancellationToken::new();
    let cancelled = cancellation.clone();
    let slow_url = server(Router::new().route(
      "/payload",
      get(|| async {
        std::future::pending::<()>().await;
        StatusCode::OK
      }),
    ))
    .await;
    let client = reqwest::Client::new();
    let operation = download(
      &client,
      None,
      &temporary_root,
      request(slow_url, None),
      cancellation,
    );
    tokio::pin!(operation);
    tokio::time::sleep(Duration::from_millis(25)).await;
    cancelled.cancel();
    let error = tokio::time::timeout(Duration::from_secs(1), operation)
      .await
      .unwrap()
      .unwrap_err();
    assert!(matches!(error, Error::Cancelled));
    assert_empty(&temporary_root).await;
  }

  #[tokio::test]
  async fn aborting_the_command_future_drops_its_workspace() {
    let slow_url = server(Router::new().route(
      "/payload",
      get(|| async {
        std::future::pending::<()>().await;
        StatusCode::OK
      }),
    ))
    .await;
    let root = TempDir::new().unwrap();
    let temporary_root = root.path().join("ephemeral");
    let operation_root = temporary_root.clone();
    let operation = tokio::spawn(async move {
      download(
        &reqwest::Client::new(),
        None,
        &operation_root,
        request(slow_url, None),
        CancellationToken::new(),
      )
      .await
    });

    tokio::time::timeout(Duration::from_secs(1), async {
      loop {
        let has_workspace = match tokio::fs::read_dir(&temporary_root).await {
          Ok(mut entries) => entries.next_entry().await.unwrap().is_some(),
          Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
          Err(error) => panic!("failed to inspect ephemeral root: {error}"),
        };
        if has_workspace {
          break;
        }
        tokio::time::sleep(Duration::from_millis(5)).await;
      }
    })
    .await
    .expect("ephemeral workspace was not created");

    operation.abort();
    assert!(operation.await.unwrap_err().is_cancelled());
    assert_empty(&temporary_root).await;
  }

  #[tokio::test]
  async fn startup_cleanup_removes_only_stale_request_entries() {
    let root = TempDir::new().unwrap();
    let ephemeral = EphemeralRoot::new(root.path().join("ephemeral"));
    tokio::fs::create_dir_all(ephemeral.path().join("request-crashed"))
      .await
      .unwrap();
    tokio::fs::write(
      ephemeral.path().join("request-orphan"),
      b"stale temporary file",
    )
    .await
    .unwrap();
    tokio::fs::write(ephemeral.path().join("keep.marker"), b"unrelated")
      .await
      .unwrap();

    assert_eq!(ephemeral.clean_stale().await.unwrap(), 2);
    assert!(
      tokio::fs::try_exists(ephemeral.path().join("keep.marker"))
        .await
        .unwrap()
    );
    assert_eq!(ephemeral.clean_stale().await.unwrap(), 0);
  }
}
