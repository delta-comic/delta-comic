use std::{
  collections::BTreeMap,
  sync::{
    Arc,
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
use tempfile::TempDir;
use tokio::net::TcpListener;
use tokio_util::sync::CancellationToken;

use super::{EphemeralDownloadRequest, download};
use crate::error::Error;

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
