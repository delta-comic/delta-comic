use crate::{
  Error, GlobalState, Result,
  cookies::create_cookie_jar,
  headers::create_headers,
  request::{self, ClientConfig, ContentConfig, get_requester},
};
use http::{Method, StatusCode, header};
use serde::Serialize;
use specta::Type;
use std::{future::Future, pin::Pin, sync::Arc, time::Duration};
use tauri::{
  Manager, ResourceId, ResourceTable, Runtime, State, Webview, async_runtime::Mutex, command,
};
use tokio::sync::oneshot::{Receiver, Sender, channel};
use tracing::Level;

struct ReqwestResponse(reqwest::Response);
impl tauri::Resource for ReqwestResponse {}

type CancelableResponseResult = Result<reqwest::Response>;
type CancelableResponseFuture =
  Pin<Box<dyn Future<Output = CancelableResponseResult> + Send + Sync>>;

const BODY_CHUNK_CONTINUES: u8 = 0;
const BODY_CHUNK_DONE: u8 = 1;

struct FetchRequest {
  fut: Mutex<CancelableResponseFuture>,
  abort_tx: Mutex<Option<Sender<()>>>,
  abort_rx: Mutex<Option<Receiver<()>>>,
}
impl tauri::Resource for FetchRequest {}

trait AddRequest {
  fn add_request(&mut self, fut: CancelableResponseFuture) -> ResourceId;
}

impl AddRequest for ResourceTable {
  fn add_request(&mut self, fut: CancelableResponseFuture) -> ResourceId {
    let (tx, rx) = channel::<()>();

    let req = FetchRequest {
      fut: Mutex::new(fut),
      abort_tx: Mutex::new(Some(tx)),
      abort_rx: Mutex::new(Some(rx)),
    };

    self.add(req)
  }
}

#[derive(Serialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct FetchResponse {
  status: u16,
  status_text: String,
  headers: Vec<(String, String)>,
  url: String,
  rid: ResourceId,
}

struct DataUrlContent {
  body: Vec<u8>,
  content_type: String,
}

struct FetchResponseMetadata {
  status: StatusCode,
  headers: Vec<(String, String)>,
  url: String,
}

fn decode_data_url(url: &url::Url) -> Result<DataUrlContent> {
  let data_url = data_url::DataUrl::process(url.as_str()).map_err(|_| Error::DataUrlError)?;
  let (body, _) = data_url
    .decode_to_vec()
    .map_err(|_| Error::DataUrlDecodeError)?;

  Ok(DataUrlContent {
    body,
    content_type: data_url.mime_type().to_string(),
  })
}

fn create_data_url_response(url: &url::Url) -> Result<reqwest::Response> {
  let DataUrlContent { body, content_type } = decode_data_url(url)?;
  let response = http::Response::builder()
    .status(StatusCode::OK)
    .header(header::CONTENT_TYPE, content_type)
    .body(reqwest::Body::from(body))?;

  #[cfg(feature = "tracing")]
  tracing::trace!("{:?}", response);

  Ok(reqwest::Response::from(response))
}

fn create_http_fetch_future(
  state: &GlobalState,
  content_config: ContentConfig,
) -> Result<CancelableResponseFuture> {
  let requester = get_requester(state, &content_config.client);
  let data = content_config.data;
  let method = Method::from_bytes(content_config.method.as_bytes())?;
  let mut request = requester.request(method.clone(), content_config.url);

  if let Some(tmo) = content_config.client.connect_timeout {
    request = request.timeout(Duration::from_millis(tmo));
  }

  let headers = create_headers(
    &content_config.headers,
    method,
    content_config.client.user_agent,
    data.as_deref(),
  )?;

  if let Some(data) = data {
    request = request.body(data);
  }

  request = request.headers(headers);

  #[cfg(feature = "tracing")]
  tracing::trace!("{:?}", request);

  Ok(Box::pin(
    async move { request.send().await.map_err(Into::into) },
  ))
}

fn create_fetch_future(
  state: &GlobalState,
  content_config: ContentConfig,
) -> Result<CancelableResponseFuture> {
  let scheme = content_config.url.scheme();

  match scheme {
    "http" | "https" => create_http_fetch_future(state, content_config),
    "data" => {
      let response = create_data_url_response(&content_config.url)?;
      Ok(Box::pin(async move { Ok(response) }))
    }
    _ => Err(Error::SchemeNotSupport(scheme.to_string())),
  }
}

fn response_metadata(res: &reqwest::Response) -> Result<FetchResponseMetadata> {
  let status = res.status();
  let url = res.url().to_string();
  let mut headers = Vec::with_capacity(res.headers().len());
  for (key, val) in res.headers().iter() {
    let value_str = val
      .to_str()
      .map_err(|_| Error::InvalidHeaderValue)?
      .to_string();

    headers.push((key.as_str().to_string(), value_str));
  }

  Ok(FetchResponseMetadata {
    status,
    headers,
    url,
  })
}

fn create_fetch_response(metadata: FetchResponseMetadata, rid: ResourceId) -> FetchResponse {
  FetchResponse {
    status: metadata.status.as_u16(),
    status_text: metadata
      .status
      .canonical_reason()
      .unwrap_or_default()
      .to_string(),
    headers: metadata.headers,
    url: metadata.url,
    rid,
  }
}

fn encode_body_chunk(chunk: bytes::Bytes) -> Vec<u8> {
  let mut encoded = Vec::with_capacity(chunk.len() + 1);
  encoded.extend_from_slice(&chunk);
  encoded.push(BODY_CHUNK_CONTINUES);
  encoded
}

fn encode_body_done() -> Vec<u8> {
  vec![BODY_CHUNK_DONE]
}

#[command]
#[specta::specta]
pub fn prepare_requester<R: Runtime>(
  _webview: Webview<R>,
  state: State<'_, GlobalState>,
  client: ClientConfig,
) {
  let jar =
    create_cookie_jar(&state.cache_dir, &client.instance_key).expect("fail to create cookie jar.");
  state
    .cookies_jar
    .insert(client.instance_key.clone(), Arc::new(jar));
  request::prepare_requester(&state, &client);
}

#[command]
#[specta::specta]
pub async fn fetch<R: Runtime>(
  webview: Webview<R>,
  state: State<'_, GlobalState>,
  content_config: ContentConfig,
) -> crate::Result<ResourceId> {
  if tracing::enabled!(Level::DEBUG) {
    tracing::debug!(
      "Fetch config\n{}",
      serde_json::to_string_pretty(&content_config).unwrap()
    );
  }

  let fut = create_fetch_future(&state, content_config)?;
  let mut resources_table = webview.resources_table();
  let rid = resources_table.add_request(fut);

  Ok(rid)
}

#[command]
#[specta::specta]
pub async fn fetch_cancel<R: Runtime>(webview: Webview<R>, rid: ResourceId) -> crate::Result<()> {
  let req = {
    let resources_table = webview.resources_table();
    resources_table.get::<FetchRequest>(rid)?
  };

  let mut abort_tx_guard = req.abort_tx.lock().await;
  if let Some(tx) = abort_tx_guard.take() {
    let _ = tx.send(());
  }

  Ok(())
}

#[command]
#[specta::specta]
pub async fn fetch_send<R: Runtime>(
  webview: Webview<R>,
  rid: ResourceId,
) -> crate::Result<FetchResponse> {
  let req = {
    let resources_table = webview.resources_table();
    resources_table.get::<FetchRequest>(rid)?
  };

  let abort_rx = {
    let mut rx_guard = req.abort_rx.lock().await;
    rx_guard.take().ok_or(Error::RequestCanceled)?
  };

  let mut fut = req.fut.lock().await;

  let res = tokio::select! {
    res = fut.as_mut() => res?,
    _ = abort_rx => {
      let mut resources_table = webview.resources_table();
      resources_table.close(rid)?;
      return Err(Error::RequestCanceled);
    }
  };

  #[cfg(feature = "tracing")]
  tracing::trace!("{:?}", res);

  let metadata = response_metadata(&res)?;

  let mut resources_table = webview.resources_table();
  let rid = resources_table.add(ReqwestResponse(res));

  Ok(create_fetch_response(metadata, rid))
}

#[command]
pub async fn fetch_read_body<R: Runtime>(
  webview: Webview<R>,
  rid: ResourceId,
) -> crate::Result<tauri::ipc::Response> {
  let res = {
    let resources_table = webview.resources_table();
    resources_table.get::<ReqwestResponse>(rid)?
  };

  // SAFETY: we can access the inner value mutably
  // because we are the only ones with a reference to it
  // and we don't want to use `Arc::into_inner` because we want to keep the value in the table
  // for potential future calls to `fetch_cancel_body`
  let res_ptr = Arc::as_ptr(&res) as *mut ReqwestResponse;
  let res = unsafe { &mut *res_ptr };
  let res = &mut res.0;

  let Some(chunk) = res.chunk().await? else {
    let mut resources_table = webview.resources_table();
    resources_table.close(rid)?;

    // return a response with a single byte to indicate that the body is empty
    return Ok(tauri::ipc::Response::new(encode_body_done()));
  };

  // append a 0 byte to indicate that the body is not empty
  Ok(tauri::ipc::Response::new(encode_body_chunk(chunk)))
}

#[command]
#[specta::specta]
pub async fn fetch_cancel_body<R: Runtime>(
  webview: Webview<R>,
  rid: ResourceId,
) -> crate::Result<()> {
  let mut resources_table = webview.resources_table();
  resources_table.close(rid)?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn decodes_data_url_content() {
    let url = url::Url::parse("data:text/plain;base64,aGVsbG8=").unwrap();
    let content = decode_data_url(&url).unwrap();

    assert_eq!(content.body, b"hello");
    assert_eq!(content.content_type, "text/plain");
  }

  #[test]
  fn fails_on_invalid_data_url_payload() {
    let url = url::Url::parse("data:text/plain;base64,%%%").unwrap();
    let result = decode_data_url(&url);

    assert!(matches!(result, Err(Error::DataUrlDecodeError)));
  }

  #[test]
  fn extracts_fetch_response_metadata() {
    let response = reqwest::Response::from(
      http::Response::builder()
        .status(StatusCode::CREATED)
        .header(header::CONTENT_TYPE, "application/json")
        .header("x-test", "ok")
        .body(reqwest::Body::from(Vec::new()))
        .unwrap(),
    );

    let metadata = response_metadata(&response).unwrap();
    let fetch_response = create_fetch_response(metadata, 42);

    assert_eq!(fetch_response.status, 201);
    assert_eq!(fetch_response.status_text, "Created");
    assert_eq!(fetch_response.rid, 42);
    assert!(
      fetch_response
        .headers
        .contains(&("content-type".to_string(), "application/json".to_string()))
    );
    assert!(
      fetch_response
        .headers
        .contains(&("x-test".to_string(), "ok".to_string()))
    );
  }

  #[test]
  fn encodes_body_chunks_with_stream_markers() {
    assert_eq!(
      encode_body_chunk(bytes::Bytes::from_static(b"abc")),
      b"abc\0"
    );
    assert_eq!(encode_body_done(), vec![1]);
  }
}
