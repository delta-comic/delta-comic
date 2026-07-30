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
#[path = "../test/src/ephemeral.rs"]
mod tests;
