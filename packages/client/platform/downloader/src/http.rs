use std::{
  collections::{HashMap, HashSet, VecDeque},
  fs::{File, OpenOptions},
  path::{Component, Path, PathBuf},
  sync::{
    Arc, Mutex as StdMutex, MutexGuard, PoisonError,
    atomic::{AtomicU64, Ordering},
  },
  time::{Duration, Instant, SystemTime},
};

use futures_util::StreamExt;
use reqwest::{
  Client, RequestBuilder, Response, StatusCode,
  header::{
    AUTHORIZATION, CONTENT_LENGTH, CONTENT_RANGE, COOKIE, ETAG, HeaderMap, HeaderName, HeaderValue,
    IF_RANGE, LAST_MODIFIED, PROXY_AUTHORIZATION, RANGE,
  },
};
use tokio_util::sync::CancellationToken;

use crate::{
  domain::{DownloadTask, DownloaderSettings, HttpHeaderValue, HttpMirror, HttpSource, TaskStatus},
  error::{Error, Result},
  persistence::{
    CompletedRange, IntegritySample, Repository, merge_ranges, missing_ranges, split_ranges,
  },
};

const MINIMUM_SEGMENT_SIZE: u64 = 4 * 1024 * 1024;
const MINIMUM_REBALANCE_REMAINING: u64 = 8 * 1024 * 1024;
const MINIMUM_WORKER_AGE: Duration = Duration::from_secs(2);
const REBALANCE_COOLDOWN: Duration = Duration::from_secs(1);
const CHECKPOINT_INTERVAL: Duration = Duration::from_millis(500);
const WRITE_BUFFER_BYTES: usize = 512 * 1024;
const INTEGRITY_SAMPLE_BYTES: u64 = 64 * 1024;
const MAX_INTEGRITY_SAMPLES: usize = 16;

pub(crate) type ProgressSink = Arc<dyn Fn(DownloadTask) + Send + Sync>;

fn lock<T>(mutex: &StdMutex<T>) -> MutexGuard<'_, T> {
  mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

struct Probe {
  total_bytes: Option<u64>,
  supports_ranges: bool,
  etag: Option<String>,
  last_modified: Option<String>,
  /// Complete response kept when the server ignored the probe range, so its body is not fetched twice.
  full_response: Option<Response>,
}

#[derive(Debug)]
pub struct DownloadReport {
  pub total_bytes: u64,
  pub elapsed: Duration,
}

#[derive(Default)]
struct RangeLedger {
  completed: Vec<CompletedRange>,
  inflight: Vec<CompletedRange>,
}

impl RangeLedger {
  fn new(completed: Vec<CompletedRange>) -> Self {
    Self {
      completed: merge_ranges(completed),
      inflight: Vec::new(),
    }
  }

  fn claim(&mut self, start: u64, end: u64) -> Vec<CompletedRange> {
    let mut occupied = self.completed.clone();
    occupied.extend(self.inflight.iter().copied());
    let claims = missing_inside(start, end, &merge_ranges(occupied));
    self.inflight.extend(claims.iter().copied());
    self.inflight = merge_ranges(std::mem::take(&mut self.inflight));
    claims
  }

  fn commit(&mut self, claims: &[CompletedRange]) {
    for claim in claims {
      self.inflight = subtract_ranges(&self.inflight, *claim);
      self.completed.push(*claim);
    }
    self.completed = merge_ranges(std::mem::take(&mut self.completed));
  }

  fn release(&mut self, claims: &[CompletedRange]) {
    for claim in claims {
      self.inflight = subtract_ranges(&self.inflight, *claim);
    }
  }

  fn completed_bytes(&self) -> u64 {
    range_bytes(&self.completed)
  }
}

fn range_bytes(ranges: &[CompletedRange]) -> u64 {
  ranges.iter().map(|range| range.end - range.start).sum()
}

enum SegmentOutcome {
  Completed,
  RangeIgnored,
}

struct WorkerProgress {
  started: Instant,
  cursor: AtomicU64,
  end: AtomicU64,
  transferred: AtomicU64,
}

impl WorkerProgress {
  fn new(range: CompletedRange) -> Self {
    Self {
      started: Instant::now(),
      cursor: AtomicU64::new(range.start),
      end: AtomicU64::new(range.end),
      transferred: AtomicU64::new(0),
    }
  }

  fn set_response_range(&self, start: u64, end: u64) {
    self.cursor.store(start, Ordering::Release);
    self.end.store(end, Ordering::Release);
    self.transferred.store(0, Ordering::Release);
  }

  fn advance(&self, cursor: u64, transferred: u64) {
    self.cursor.store(cursor, Ordering::Release);
    self.transferred.fetch_add(transferred, Ordering::AcqRel);
  }

  fn telemetry(&self, id: u64, now: Instant) -> WorkerTelemetry {
    WorkerTelemetry {
      id,
      cursor: self.cursor.load(Ordering::Acquire),
      end: self.end.load(Ordering::Acquire),
      transferred: self.transferred.load(Ordering::Acquire),
      age: now.saturating_duration_since(self.started),
    }
  }
}

#[derive(Debug, Clone, Copy)]
struct WorkerTelemetry {
  id: u64,
  cursor: u64,
  end: u64,
  transferred: u64,
  age: Duration,
}

impl WorkerTelemetry {
  fn remaining(self) -> u64 {
    self.end.saturating_sub(self.cursor)
  }

  fn eta_seconds(self) -> f64 {
    let elapsed = self.age.as_secs_f64();
    if self.transferred == 0 || elapsed == 0.0 {
      f64::INFINITY
    } else {
      self.remaining() as f64 / (self.transferred as f64 / elapsed)
    }
  }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct RebalancePlan {
  worker_id: u64,
  first: CompletedRange,
  second: CompletedRange,
}

fn choose_slow_tail(workers: &[WorkerTelemetry]) -> Option<RebalancePlan> {
  let slowest = workers
    .iter()
    .copied()
    .filter(|worker| {
      worker.age >= MINIMUM_WORKER_AGE && worker.remaining() >= MINIMUM_REBALANCE_REMAINING
    })
    .max_by(|left, right| left.eta_seconds().total_cmp(&right.eta_seconds()))?;
  if workers.len() > 1 {
    let fastest_eta = workers
      .iter()
      .copied()
      .filter(|worker| worker.id != slowest.id && worker.transferred > 0)
      .map(WorkerTelemetry::eta_seconds)
      .min_by(f64::total_cmp);
    if fastest_eta.is_some_and(|fastest| {
      slowest.eta_seconds() < fastest * 1.5 || slowest.eta_seconds() - fastest < 2.0
    }) {
      return None;
    }
  }
  let midpoint = slowest.cursor + slowest.remaining() / 2;
  Some(RebalancePlan {
    worker_id: slowest.id,
    first: CompletedRange {
      start: slowest.cursor,
      end: midpoint,
    },
    second: CompletedRange {
      start: midpoint,
      end: slowest.end,
    },
  })
}

fn overlapping_worker_to_cancel(workers: &[WorkerTelemetry]) -> Option<u64> {
  for (index, left) in workers.iter().enumerate() {
    for right in &workers[index + 1..] {
      if left.cursor < right.end && right.cursor < left.end {
        return Some(if left.transferred <= right.transferred {
          left.id
        } else {
          right.id
        });
      }
    }
  }
  None
}

struct CheckpointState {
  completed_bytes: u64,
  at: Instant,
}

impl CheckpointState {
  fn new(completed_bytes: u64) -> Self {
    Self {
      completed_bytes,
      at: Instant::now(),
    }
  }

  fn elapsed(&self) -> bool {
    self.at.elapsed() >= CHECKPOINT_INTERVAL
  }

  /// Returns the transfer rate since the previous checkpoint when a new checkpoint is due.
  fn due(&mut self, completed_bytes: u64) -> Option<u64> {
    let now = Instant::now();
    let elapsed = now.saturating_duration_since(self.at);
    if elapsed < CHECKPOINT_INTERVAL {
      return None;
    }
    let speed = completed_bytes.saturating_sub(self.completed_bytes) as f64 / elapsed.as_secs_f64();
    self.completed_bytes = completed_bytes;
    self.at = now;
    Some(speed as u64)
  }
}

/// State shared by every range worker of one mirror transfer.
struct Transfer {
  client: Client,
  url: String,
  headers: HeaderMap,
  file: Arc<File>,
  repository: Repository,
  task_id: String,
  progress: Option<ProgressSink>,
  ledger: StdMutex<RangeLedger>,
  checkpoint: StdMutex<CheckpointState>,
  total: u64,
  validator: Option<String>,
}

impl Transfer {
  /// Writes the unclaimed parts of a buffered response chunk and returns the buffer for reuse.
  async fn write(&self, start: u64, buffer: Vec<u8>) -> Result<Vec<u8>> {
    let claims = lock(&self.ledger).claim(start, start + buffer.len() as u64);
    let file = self.file.clone();
    let claimed = claims.clone();
    let result = tokio::task::spawn_blocking(move || {
      write_claims(&file, start, &buffer, &claimed)?;
      Ok(buffer)
    })
    .await
    .map_err(std::io::Error::from)
    .map_err(Error::from)
    .and_then(|result| result);
    let mut ledger = lock(&self.ledger);
    match result {
      Ok(buffer) => {
        ledger.commit(&claims);
        Ok(buffer)
      }
      Err(error) => {
        ledger.release(&claims);
        Err(error)
      }
    }
  }

  async fn checkpoint_if_due(&self) -> Result<()> {
    let completed_bytes = lock(&self.ledger).completed_bytes();
    let due = lock(&self.checkpoint).due(completed_bytes);
    match due {
      Some(speed) => self.save(speed).await,
      None => Ok(()),
    }
  }

  async fn save(&self, speed: u64) -> Result<()> {
    let completed = lock(&self.ledger).completed.clone();
    save_checkpoint(
      &self.repository,
      &self.task_id,
      &self.file,
      completed,
      None,
      speed,
      self.progress.as_ref(),
    )
    .await
  }
}

struct ActiveWorker {
  cancellation: CancellationToken,
  progress: Arc<WorkerProgress>,
}

pub(crate) struct DownloadRequest<'a> {
  pub repository: &'a Repository,
  pub task: &'a DownloadTask,
  pub source: &'a HttpSource,
  pub settings: &'a DownloaderSettings,
  pub temp_path: &'a Path,
  /// An already-open, seekable destination owned by the caller. Android SAF
  /// uses this to write directly through a detached document-provider file
  /// descriptor while retaining the same range and checkpoint engine.
  pub target_file: Option<Arc<File>>,
  pub cancellation: CancellationToken,
  pub secret_resolver: Option<&'a dyn crate::SecretResolver>,
  pub maximum_bytes: Option<u64>,
  pub progress: Option<ProgressSink>,
}

pub(crate) async fn download(
  client: &Client,
  request: DownloadRequest<'_>,
) -> Result<DownloadReport> {
  if request
    .source
    .expires_at
    .is_some_and(|expires| expires <= crate::persistence::now_millis())
  {
    return Err(Error::SourceExpired);
  }
  let mut mirrors = request.source.mirrors.iter().collect::<Vec<_>>();
  mirrors.sort_by_key(|mirror| std::cmp::Reverse(mirror.priority));
  if mirrors.is_empty() {
    return Err(Error::InvalidInput("HTTP source has no mirrors".into()));
  }

  let mut last_error = None;
  for mirror in mirrors {
    if request.cancellation.is_cancelled() {
      return Err(Error::Cancelled);
    }
    let current_task = request
      .repository
      .get_task(&request.task.id)
      .await?
      .unwrap_or_else(|| request.task.clone());
    match download_from_mirror(client, mirror, &current_task, &request).await {
      Ok(report) => return Ok(report),
      Err(error) if is_mirror_failure(&error) => last_error = Some(error),
      Err(error) => return Err(error),
    }
  }
  Err(last_error.unwrap_or_else(|| Error::InvalidInput("all HTTP mirrors failed".into())))
}

async fn download_from_mirror(
  client: &Client,
  mirror: &HttpMirror,
  task: &DownloadTask,
  request: &DownloadRequest<'_>,
) -> Result<DownloadReport> {
  let url = url::Url::parse(&mirror.url)?;
  if !matches!(url.scheme(), "http" | "https") {
    return Err(Error::InvalidInput(
      "HTTP downloads require an http or https URL".into(),
    ));
  }

  let headers = build_headers(&mirror.headers, request.secret_resolver)?;
  let probe = probe(
    client,
    &mirror.url,
    &headers,
    request.source.expected_size,
    &request.cancellation,
  )
  .await?;
  if let Some(maximum_bytes) = request.maximum_bytes
    && probe.total_bytes.is_some_and(|total| total > maximum_bytes)
  {
    return Err(Error::InvalidInput(format!(
      "download exceeds the {maximum_bytes} byte IPC limit",
    )));
  }
  if request
    .source
    .expected_size
    .zip(probe.total_bytes)
    .is_some_and(|(expected, actual)| expected != actual)
    || request
      .source
      .etag
      .as_ref()
      .zip(probe.etag.as_ref())
      .is_some_and(|(expected, actual)| expected != actual)
    || request
      .source
      .last_modified
      .as_ref()
      .zip(probe.last_modified.as_ref())
      .is_some_and(|(expected, actual)| expected != actual)
  {
    return Err(Error::RemoteChanged);
  }

  let file = match &request.target_file {
    Some(file) => file.clone(),
    None => {
      let destination_root = task_storage_root(task)?;
      if let Some(parent) = request.temp_path.parent() {
        reject_symlinks_below(&destination_root, parent)?;
        tokio::fs::create_dir_all(parent).await?;
        reject_symlinks_below(&destination_root, parent)?;
      }
      Arc::new(open_partial_file(&destination_root, request.temp_path)?)
    }
  };

  let mut completed = request.repository.completed_ranges(&task.id).await?;
  if !completed.is_empty()
    && (!probe.supports_ranges
      || !can_reuse_completed(
        client,
        &mirror.url,
        &headers,
        &file,
        &completed,
        request.repository,
        task,
        &probe,
        &request.cancellation,
      )
      .await?)
  {
    request.repository.clear_progress(&task.id).await?;
    completed.clear();
  }
  let probing = request
    .repository
    .update_probe(
      &task.id,
      probe.total_bytes,
      probe.etag.as_deref(),
      probe.last_modified.as_deref(),
    )
    .await?;
  if let Some(progress) = &request.progress {
    progress(probing);
  }
  if let Some(total_bytes) = probe.total_bytes {
    file.set_len(total_bytes)?;
  }
  let started = Instant::now();

  if probe.total_bytes == Some(0) {
    return Ok(DownloadReport {
      total_bytes: 0,
      elapsed: started.elapsed(),
    });
  }

  let (Some(total_bytes), true) = (probe.total_bytes, probe.supports_ranges) else {
    let total_bytes = sequential_download(
      client,
      &mirror.url,
      &headers,
      &file,
      probe.total_bytes,
      probe.full_response,
      request,
    )
    .await?;
    return Ok(DownloadReport {
      total_bytes,
      elapsed: started.elapsed(),
    });
  };

  let ledger = RangeLedger::new(completed);
  let transfer = Arc::new(Transfer {
    client: client.clone(),
    url: mirror.url.clone(),
    headers,
    file: file.clone(),
    repository: request.repository.clone(),
    task_id: task.id.clone(),
    progress: request.progress.clone(),
    checkpoint: StdMutex::new(CheckpointState::new(ledger.completed_bytes())),
    ledger: StdMutex::new(ledger),
    total: total_bytes,
    validator: strong_etag(probe.etag.as_deref())
      .map(str::to_owned)
      .or(probe.last_modified),
  });
  let workers = usize::from(request.settings.per_task_connections)
    .min(usize::from(request.settings.connection_budget))
    .max(1);
  let mut no_progress_rounds = 0_u8;

  loop {
    if request.cancellation.is_cancelled() {
      return Err(Error::Cancelled);
    }
    let (before, missing) = {
      let ledger = lock(&transfer.ledger);
      (
        ledger.completed_bytes(),
        missing_ranges(total_bytes, &ledger.completed),
      )
    };
    if missing.is_empty() {
      break;
    }
    let planned = split_ranges(&missing, workers, MINIMUM_SEGMENT_SIZE);
    if run_segment_round(&transfer, planned, workers, &request.cancellation).await? {
      request.repository.clear_progress(&task.id).await?;
      sequential_download(
        client,
        &mirror.url,
        &transfer.headers,
        &file,
        Some(total_bytes),
        None,
        request,
      )
      .await?;
      return Ok(DownloadReport {
        total_bytes,
        elapsed: started.elapsed(),
      });
    }

    if lock(&transfer.ledger).completed_bytes() == before {
      no_progress_rounds += 1;
      if no_progress_rounds >= 2 {
        return Err(Error::RangeRejected);
      }
    } else {
      no_progress_rounds = 0;
    }
  }

  transfer.save(0).await?;
  Ok(DownloadReport {
    total_bytes,
    elapsed: started.elapsed(),
  })
}

fn task_storage_root(task: &DownloadTask) -> Result<PathBuf> {
  let mut root = task
    .final_path
    .as_ref()
    .map(PathBuf::from)
    .ok_or_else(|| Error::InvalidInput("task has no destination path".into()))?;
  let component_count = Path::new(&task.relative_path).components().count();
  if component_count == 0 || !(0..component_count).all(|_| root.pop()) {
    return Err(Error::InvalidInput(
      "stored task path is inconsistent with its relative path".into(),
    ));
  }
  Ok(root)
}

fn is_mirror_failure(error: &Error) -> bool {
  matches!(
    error,
    Error::Network(_)
      | Error::RetryableHttp { .. }
      | Error::SourceExpired
      | Error::RangeRejected
      | Error::RemoteChanged
      | Error::InvalidInput(_)
  )
}

async fn run_segment_round(
  transfer: &Arc<Transfer>,
  planned: Vec<CompletedRange>,
  worker_limit: usize,
  cancellation: &CancellationToken,
) -> Result<bool> {
  let round_token = cancellation.child_token();
  let mut pending = VecDeque::from(planned);
  let mut active = HashMap::<u64, ActiveWorker>::new();
  let mut rebalanced = HashSet::<u64>::new();
  let mut handles = tokio::task::JoinSet::<(u64, Result<SegmentOutcome>)>::new();
  let mut next_worker_id = 0_u64;
  let mut last_rebalance: Option<Instant> = None;
  let mut range_ignored = false;

  loop {
    while !range_ignored && active.len() < worker_limit {
      let Some(range) = pending.pop_front() else {
        break;
      };
      next_worker_id += 1;
      let id = next_worker_id;
      let worker_token = round_token.child_token();
      let progress = Arc::new(WorkerProgress::new(range));
      let segment = download_segment(
        transfer.clone(),
        progress.clone(),
        worker_token.clone(),
        range,
      );
      handles.spawn(async move { (id, segment.await) });
      active.insert(
        id,
        ActiveWorker {
          cancellation: worker_token,
          progress,
        },
      );
    }

    if active.is_empty() {
      return Ok(range_ignored);
    }

    let now = Instant::now();
    let cooldown_elapsed =
      last_rebalance.is_none_or(|last| now.saturating_duration_since(last) >= REBALANCE_COOLDOWN);
    if !range_ignored && pending.is_empty() && active.len() < worker_limit && cooldown_elapsed {
      let telemetry = active
        .iter()
        .map(|(&id, worker)| worker.progress.telemetry(id, now))
        .collect::<Vec<_>>();
      if let Some(plan) = choose_slow_tail(&telemetry)
        && let Some(worker) = active.get(&plan.worker_id)
      {
        worker.cancellation.cancel();
        rebalanced.insert(plan.worker_id);
        pending.push_back(plan.first);
        pending.push_back(plan.second);
        last_rebalance = Some(now);
        continue;
      }
    }

    if !range_ignored {
      let telemetry = active
        .iter()
        .filter(|(id, _)| !rebalanced.contains(id))
        .map(|(&id, worker)| worker.progress.telemetry(id, now))
        .collect::<Vec<_>>();
      if let Some(worker_id) = overlapping_worker_to_cancel(&telemetry)
        && let Some(worker) = active.get(&worker_id)
      {
        worker.cancellation.cancel();
        rebalanced.insert(worker_id);
      }
    }

    tokio::select! {
      () = cancellation.cancelled() => {
        round_token.cancel();
        while handles.join_next().await.is_some() {}
        transfer.save(0).await?;
        return Err(Error::Cancelled);
      }
      joined = handles.join_next() => {
        let Some(joined) = joined else {
          return Ok(range_ignored);
        };
        let (id, result) = joined
          .map_err(|error| Error::InvalidInput(format!("segment worker panicked: {error}")))?;
        active.remove(&id);
        match result {
          Ok(SegmentOutcome::Completed) => {}
          Ok(SegmentOutcome::RangeIgnored) => {
            range_ignored = true;
            pending.clear();
            round_token.cancel();
          }
          Err(Error::Cancelled) if range_ignored || rebalanced.remove(&id) => {}
          Err(error) => {
            round_token.cancel();
            while handles.join_next().await.is_some() {}
            transfer.save(0).await?;
            return Err(error);
          }
        }
      }
      () = tokio::time::sleep(Duration::from_millis(100)) => {}
    }
  }
}

async fn download_segment(
  transfer: Arc<Transfer>,
  progress: Arc<WorkerProgress>,
  cancellation: CancellationToken,
  requested: CompletedRange,
) -> Result<SegmentOutcome> {
  let mut request = transfer
    .client
    .get(&transfer.url)
    .headers(transfer.headers.clone())
    .header(
      RANGE,
      format!("bytes={}-{}", requested.start, requested.end - 1),
    );
  if let Some(validator) = &transfer.validator {
    request = request.header(IF_RANGE, validator);
  }
  let response = send(request, &cancellation).await?;
  if let Some(error) = retryable_response_error(&response) {
    return Err(error);
  }
  match response.status() {
    StatusCode::OK => return Ok(SegmentOutcome::RangeIgnored),
    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => return Err(Error::SourceExpired),
    StatusCode::RANGE_NOT_SATISFIABLE => return Err(Error::RemoteChanged),
    StatusCode::PARTIAL_CONTENT => {}
    status => {
      return Err(Error::InvalidInput(format!(
        "range request returned {status}"
      )));
    }
  }
  let content_range = header_text(&response, CONTENT_RANGE)
    .and_then(|value| parse_content_range(&value))
    .ok_or(Error::RangeRejected)?;
  if content_range.total != transfer.total
    || transfer
      .validator
      .as_ref()
      .is_some_and(|expected| response_validator_changed(&response, expected))
  {
    return Err(Error::RemoteChanged);
  }
  progress.set_response_range(content_range.start, content_range.end);

  let mut stream = response.bytes_stream();
  let mut flushed = content_range.start;
  let mut buffer = Vec::with_capacity(WRITE_BUFFER_BYTES);
  let mut last_flush = Instant::now();
  let outcome = loop {
    let next = tokio::select! {
      () = cancellation.cancelled() => break Err(Error::Cancelled),
      value = stream.next() => value,
    };
    let Some(next) = next else {
      break Ok(SegmentOutcome::Completed);
    };
    let bytes = match next {
      Ok(bytes) => bytes,
      Err(error) => break Err(error.into()),
    };
    if flushed + (buffer.len() + bytes.len()) as u64 > content_range.end {
      return Err(Error::InvalidInput(
        "response body exceeded Content-Range".into(),
      ));
    }
    buffer.extend_from_slice(&bytes);
    progress.advance(flushed, bytes.len() as u64);
    if buffer.len() >= WRITE_BUFFER_BYTES || last_flush.elapsed() >= CHECKPOINT_INTERVAL {
      let length = buffer.len() as u64;
      buffer = transfer.write(flushed, buffer).await?;
      buffer.clear();
      flushed += length;
      last_flush = Instant::now();
      progress.advance(flushed, 0);
      transfer.checkpoint_if_due().await?;
    }
  };
  // Bytes already received are kept on cancellation and transport errors so resume skips them.
  if !buffer.is_empty() {
    let length = buffer.len() as u64;
    transfer.write(flushed, buffer).await?;
    flushed += length;
  }
  if outcome.is_ok() && flushed < content_range.end {
    return Err(Error::InvalidInput(
      "range response ended before Content-Range".into(),
    ));
  }
  outcome
}

async fn sequential_download(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  file: &Arc<File>,
  expected_total: Option<u64>,
  response: Option<Response>,
  request: &DownloadRequest<'_>,
) -> Result<u64> {
  let response = match response {
    Some(response) => response,
    None => {
      let response = send(
        client.get(url).headers(headers.clone()),
        &request.cancellation,
      )
      .await?;
      if let Some(error) = retryable_response_error(&response) {
        return Err(error);
      }
      match response.status() {
        StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => return Err(Error::SourceExpired),
        status if !status.is_success() => {
          return Err(Error::InvalidInput(format!(
            "download request returned {status}"
          )));
        }
        _ => response,
      }
    }
  };
  file.set_len(0)?;
  let prefix = |end: u64| {
    (end > 0)
      .then_some(CompletedRange { start: 0, end })
      .into_iter()
      .collect::<Vec<_>>()
  };
  let mut checkpoint = CheckpointState::new(0);
  let mut flushed = 0_u64;
  let mut buffer = Vec::with_capacity(WRITE_BUFFER_BYTES);
  let mut stream = response.bytes_stream();
  while let Some(next) = tokio::select! {
    () = request.cancellation.cancelled() => return Err(Error::Cancelled),
    value = stream.next() => value,
  } {
    let bytes = next?;
    let end = flushed + (buffer.len() + bytes.len()) as u64;
    if let Some(maximum_bytes) = request.maximum_bytes
      && end > maximum_bytes
    {
      return Err(Error::InvalidInput(format!(
        "download exceeds the {maximum_bytes} byte IPC limit",
      )));
    }
    if expected_total.is_some_and(|total| end > total) {
      return Err(Error::RemoteChanged);
    }
    buffer.extend_from_slice(&bytes);
    if buffer.len() >= WRITE_BUFFER_BYTES || checkpoint.elapsed() {
      let length = buffer.len() as u64;
      buffer = write_at(file, buffer, flushed).await?;
      buffer.clear();
      flushed += length;
    }
    if let Some(speed) = checkpoint.due(flushed) {
      save_checkpoint(
        request.repository,
        &request.task.id,
        file,
        prefix(flushed),
        None,
        speed,
        request.progress.as_ref(),
      )
      .await?;
    }
  }
  if !buffer.is_empty() {
    let length = buffer.len() as u64;
    write_at(file, buffer, flushed).await?;
    flushed += length;
  }
  if expected_total.is_some_and(|total| flushed != total) {
    return Err(Error::RemoteChanged);
  }
  save_checkpoint(
    request.repository,
    &request.task.id,
    file,
    prefix(flushed),
    Some(flushed),
    0,
    request.progress.as_ref(),
  )
  .await?;
  Ok(flushed)
}

async fn send(request: RequestBuilder, cancellation: &CancellationToken) -> Result<Response> {
  tokio::select! {
    () = cancellation.cancelled() => Err(Error::Cancelled),
    response = request.send() => Ok(response?),
  }
}

async fn probe(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  expected_size: Option<u64>,
  cancellation: &CancellationToken,
) -> Result<Probe> {
  let request = client
    .get(url)
    .headers(headers.clone())
    .header(RANGE, "bytes=0-0");
  let response = send(request, cancellation).await?;
  if let Some(error) = retryable_response_error(&response) {
    return Err(error);
  }
  let etag = header_text(&response, ETAG);
  let last_modified = header_text(&response, LAST_MODIFIED);
  let (total_bytes, supports_ranges, full_response) = match response.status() {
    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => return Err(Error::SourceExpired),
    StatusCode::PARTIAL_CONTENT => {
      let content_range = header_text(&response, CONTENT_RANGE)
        .and_then(|value| parse_content_range(&value))
        .ok_or(Error::RangeRejected)?;
      (Some(content_range.total), true, None)
    }
    StatusCode::OK => (
      response.content_length().or(expected_size),
      false,
      Some(response),
    ),
    StatusCode::RANGE_NOT_SATISFIABLE if expected_size == Some(0) => (Some(0), true, None),
    StatusCode::RANGE_NOT_SATISFIABLE => return Err(Error::RemoteChanged),
    status => {
      return Err(Error::InvalidInput(format!(
        "download probe returned {status}"
      )));
    }
  };
  Ok(Probe {
    total_bytes,
    supports_ranges,
    etag,
    last_modified,
    full_response,
  })
}

fn build_headers(
  headers: &std::collections::BTreeMap<String, HttpHeaderValue>,
  secret_resolver: Option<&dyn crate::SecretResolver>,
) -> Result<HeaderMap> {
  let mut result = HeaderMap::new();
  for (name, source) in headers {
    let name = HeaderName::from_bytes(name.as_bytes())
      .map_err(|_| Error::InvalidInput("HTTP source contains an invalid header name".into()))?;
    if matches!(name, RANGE | IF_RANGE | CONTENT_LENGTH | CONTENT_RANGE) {
      return Err(Error::InvalidInput(
        "HTTP source cannot override downloader-managed range headers".into(),
      ));
    }
    if matches!(name, AUTHORIZATION | PROXY_AUTHORIZATION | COOKIE)
      && matches!(source, HttpHeaderValue::Value { .. })
    {
      return Err(Error::InvalidInput(format!(
        "sensitive HTTP header {name} must use a secretRef"
      )));
    }
    let resolved;
    let value = match source {
      HttpHeaderValue::Value { value } => value.as_str(),
      HttpHeaderValue::SecretRef { secret_ref } => {
        resolved = secret_resolver
          .ok_or(Error::SourceExpired)?
          .resolve(secret_ref)?
          .ok_or(Error::SourceExpired)?;
        resolved.as_str()
      }
    };
    let value = HeaderValue::from_str(value)
      .map_err(|_| Error::InvalidInput("HTTP source contains an invalid header value".into()))?;
    result.insert(name, value);
  }
  Ok(result)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
struct ParsedContentRange {
  start: u64,
  end: u64,
  total: u64,
}

fn parse_content_range(value: &str) -> Option<ParsedContentRange> {
  let value = value.strip_prefix("bytes ")?;
  let (range, total) = value.split_once('/')?;
  let (start, inclusive_end) = range.split_once('-')?;
  let start = start.parse().ok()?;
  let inclusive_end: u64 = inclusive_end.parse().ok()?;
  let total = total.parse().ok()?;
  let end = inclusive_end.checked_add(1)?;
  (start < end && end <= total).then_some(ParsedContentRange { start, end, total })
}

fn header_text(response: &Response, name: reqwest::header::HeaderName) -> Option<String> {
  response
    .headers()
    .get(name)
    .and_then(|value| value.to_str().ok())
    .map(str::to_string)
}

fn retryable_response_error(response: &Response) -> Option<Error> {
  let status = response.status();
  if !(status == StatusCode::REQUEST_TIMEOUT
    || status == StatusCode::TOO_EARLY
    || status == StatusCode::TOO_MANY_REQUESTS
    || status.is_server_error())
  {
    return None;
  }
  let retry_after_millis = response
    .headers()
    .get(reqwest::header::RETRY_AFTER)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| parse_retry_after(value, SystemTime::now()));
  Some(Error::RetryableHttp {
    status: status.as_u16(),
    retry_after_millis,
  })
}

fn parse_retry_after(value: &str, now: SystemTime) -> Option<u64> {
  value
    .parse::<u64>()
    .ok()
    .and_then(|seconds| seconds.checked_mul(1_000))
    .or_else(|| {
      httpdate::parse_http_date(value)
        .ok()
        .and_then(|at| at.duration_since(now).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
    })
}

fn strong_etag(value: Option<&str>) -> Option<&str> {
  value.filter(|etag| etag.starts_with('"') && etag.ends_with('"'))
}

fn response_validator_changed(response: &Response, expected: &str) -> bool {
  let header = if strong_etag(Some(expected)).is_some() {
    ETAG
  } else {
    LAST_MODIFIED
  };
  header_text(response, header).is_some_and(|actual| actual != expected)
}

#[allow(clippy::too_many_arguments)]
async fn can_reuse_completed(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  file: &File,
  completed: &[CompletedRange],
  repository: &Repository,
  task: &DownloadTask,
  probe: &Probe,
  cancellation: &CancellationToken,
) -> Result<bool> {
  let Some(total) = probe.total_bytes else {
    return Ok(false);
  };
  // Remote validators identify the source object, not the local partial
  // file. A recreated file must not inherit persisted ranges merely because
  // the source still has the same ETag.
  let required_local_length = completed.iter().map(|range| range.end).max().unwrap_or(0);
  if task.total_bytes != Some(total) || file.metadata()?.len() < required_local_length {
    return Ok(false);
  }
  let samples = repository.integrity_samples(&task.id).await?;
  if !verify_local_integrity_samples(file, &samples, total)? {
    return Ok(false);
  }
  if let (Some(previous), Some(current)) = (
    strong_etag(task.etag.as_deref()),
    strong_etag(probe.etag.as_deref()),
  ) {
    return Ok(previous == current);
  }
  if let (Some(previous), Some(current)) = (&task.last_modified, &probe.last_modified) {
    return Ok(previous == current);
  }
  verify_remote_integrity_samples(client, url, headers, &samples, total, cancellation).await
}

fn verify_local_integrity_samples(
  file: &File,
  samples: &[IntegritySample],
  total: u64,
) -> Result<bool> {
  if samples.is_empty() {
    return Ok(false);
  }
  for sample in samples {
    if sample.start + sample.length > total {
      return Ok(false);
    }
    let mut local = vec![0_u8; sample.length as usize];
    if read_exact_at(file, &mut local, sample.start).is_err() || sha256_hex(&local) != sample.sha256
    {
      return Ok(false);
    }
  }
  Ok(true)
}

async fn verify_remote_integrity_samples(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  samples: &[IntegritySample],
  total: u64,
  cancellation: &CancellationToken,
) -> Result<bool> {
  for sample in samples {
    let end = sample.start + sample.length;
    let request = client
      .get(url)
      .headers(headers.clone())
      .header(RANGE, format!("bytes={}-{}", sample.start, end - 1));
    let response = send(request, cancellation).await?;
    match response.status() {
      StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => return Err(Error::SourceExpired),
      StatusCode::PARTIAL_CONTENT => {}
      _ => return Ok(false),
    }
    if header_text(&response, CONTENT_RANGE).and_then(|value| parse_content_range(&value))
      != Some(ParsedContentRange {
        start: sample.start,
        end,
        total,
      })
    {
      return Ok(false);
    }
    let remote = collect_limited_body(response, sample.length).await?;
    if sha256_hex(&remote) != sample.sha256 {
      return Ok(false);
    }
  }
  Ok(true)
}

fn sha256_hex(bytes: &[u8]) -> String {
  use sha2::{Digest, Sha256};

  hex::encode(Sha256::digest(bytes))
}

fn integrity_samples(file: &File, completed: &[CompletedRange]) -> Result<Vec<IntegritySample>> {
  let mut positions = Vec::new();
  for range in completed {
    let length = (range.end - range.start).min(INTEGRITY_SAMPLE_BYTES);
    positions.push((range.start, length));
    let tail_start = range.end - length;
    if tail_start != range.start {
      positions.push((tail_start, length));
    }
  }
  if positions.len() > MAX_INTEGRITY_SAMPLES {
    let last = positions.len() - 1;
    positions = (0..MAX_INTEGRITY_SAMPLES)
      .map(|index| positions[index * last / (MAX_INTEGRITY_SAMPLES - 1)])
      .collect();
  }

  let mut bytes = Vec::new();
  positions
    .into_iter()
    .map(|(start, length)| {
      bytes.resize(length as usize, 0);
      read_exact_at(file, &mut bytes, start)?;
      Ok(IntegritySample {
        start,
        length,
        sha256: sha256_hex(&bytes),
      })
    })
    .collect()
}

/// Flushes file data, then atomically persists the completed ranges and their integrity samples
/// before publishing progress.
async fn save_checkpoint(
  repository: &Repository,
  task_id: &str,
  file: &Arc<File>,
  completed: Vec<CompletedRange>,
  total: Option<u64>,
  speed: u64,
  progress: Option<&ProgressSink>,
) -> Result<()> {
  let completed = merge_ranges(completed);
  let (completed, samples) = {
    let file = file.clone();
    tokio::task::spawn_blocking(move || {
      file.sync_data()?;
      let samples = integrity_samples(&file, &completed)?;
      Ok::<_, Error>((completed, samples))
    })
    .await
    .map_err(std::io::Error::from)??
  };
  repository
    .save_checkpoint(task_id, &completed, &samples)
    .await?;
  let downloaded = range_bytes(&completed);
  let task = match total {
    Some(total) => {
      repository
        .update_transfer_progress(task_id, TaskStatus::Downloading, total, downloaded, speed)
        .await?
    }
    None => {
      repository
        .update_progress(task_id, downloaded, speed)
        .await?
    }
  };
  if let Some(progress) = progress {
    progress(task);
  }
  Ok(())
}

async fn collect_limited_body(response: Response, expected: u64) -> Result<Vec<u8>> {
  let capacity = expected as usize;
  let mut body = Vec::with_capacity(capacity);
  let mut stream = response.bytes_stream();
  while let Some(chunk) = stream.next().await {
    let chunk = chunk?;
    if body.len() + chunk.len() > capacity {
      return Err(Error::InvalidInput(
        "response body exceeded Content-Range".into(),
      ));
    }
    body.extend_from_slice(&chunk);
  }
  Ok(body)
}

fn write_claims(
  file: &File,
  chunk_start: u64,
  bytes: &[u8],
  claims: &[CompletedRange],
) -> Result<()> {
  for claim in claims {
    let start = (claim.start - chunk_start) as usize;
    let end = (claim.end - chunk_start) as usize;
    write_all_at(file, &bytes[start..end], claim.start)?;
  }
  Ok(())
}

async fn write_at(file: &Arc<File>, buffer: Vec<u8>, offset: u64) -> Result<Vec<u8>> {
  let file = file.clone();
  tokio::task::spawn_blocking(move || {
    write_all_at(&file, &buffer, offset)?;
    Ok(buffer)
  })
  .await
  .map_err(std::io::Error::from)?
}

fn open_partial_file(root: &Path, path: &Path) -> Result<File> {
  reject_symlinks_below(root, path)?;
  let mut options = OpenOptions::new();
  options.create(true).truncate(false).read(true).write(true);
  configure_no_follow(&mut options);
  let file = options.open(path)?;
  reject_symlinks_below(root, path)?;
  Ok(file)
}

fn reject_symlinks_below(root: &Path, path: &Path) -> Result<()> {
  let relative = path
    .strip_prefix(root)
    .map_err(|_| Error::InvalidInput("download path escapes its registered destination".into()))?;
  let mut current = root.to_path_buf();
  for component in relative.components() {
    let Component::Normal(segment) = component else {
      if component == Component::CurDir {
        continue;
      }
      return Err(Error::InvalidInput(
        "download path escapes its registered destination".into(),
      ));
    };
    current.push(segment);
    match std::fs::symlink_metadata(&current) {
      Ok(metadata) if metadata_is_link_like(&metadata) => {
        return Err(Error::InvalidInput(
          "download path contains a symbolic link".into(),
        ));
      }
      Ok(_) => {}
      Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
      Err(error) => return Err(error.into()),
    }
  }
  Ok(())
}

fn metadata_is_link_like(metadata: &std::fs::Metadata) -> bool {
  if metadata.file_type().is_symlink() {
    return true;
  }
  #[cfg(windows)]
  {
    use std::os::windows::fs::MetadataExt;

    const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
    if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
      return true;
    }
  }
  false
}

#[cfg(unix)]
fn configure_no_follow(options: &mut OpenOptions) {
  use std::os::unix::fs::OpenOptionsExt;

  options.custom_flags(libc::O_NOFOLLOW);
}

#[cfg(windows)]
fn configure_no_follow(options: &mut OpenOptions) {
  use std::os::windows::fs::OpenOptionsExt;

  const FILE_FLAG_OPEN_REPARSE_POINT: u32 = 0x20_0000;
  options.custom_flags(FILE_FLAG_OPEN_REPARSE_POINT);
}

#[cfg(not(any(unix, windows)))]
fn configure_no_follow(_options: &mut OpenOptions) {}

#[cfg(unix)]
fn read_exact_at(file: &File, bytes: &mut [u8], offset: u64) -> std::io::Result<()> {
  std::os::unix::fs::FileExt::read_exact_at(file, bytes, offset)
}

#[cfg(windows)]
fn read_exact_at(file: &File, mut bytes: &mut [u8], mut offset: u64) -> std::io::Result<()> {
  use std::os::windows::fs::FileExt;
  while !bytes.is_empty() {
    let read = file.seek_read(bytes, offset)?;
    if read == 0 {
      return Err(std::io::Error::from(std::io::ErrorKind::UnexpectedEof));
    }
    let (_, remaining) = bytes.split_at_mut(read);
    bytes = remaining;
    offset += read as u64;
  }
  Ok(())
}

#[cfg(unix)]
fn write_all_at(file: &File, bytes: &[u8], offset: u64) -> Result<()> {
  Ok(std::os::unix::fs::FileExt::write_all_at(
    file, bytes, offset,
  )?)
}

#[cfg(windows)]
fn write_all_at(file: &File, mut bytes: &[u8], mut offset: u64) -> Result<()> {
  use std::os::windows::fs::FileExt;
  while !bytes.is_empty() {
    let written = file.seek_write(bytes, offset)?;
    if written == 0 {
      return Err(std::io::Error::from(std::io::ErrorKind::WriteZero).into());
    }
    bytes = &bytes[written..];
    offset += written as u64;
  }
  Ok(())
}

fn missing_inside(start: u64, end: u64, occupied: &[CompletedRange]) -> Vec<CompletedRange> {
  missing_ranges(
    end - start,
    &occupied
      .iter()
      .filter_map(|range| {
        let clipped_start = range.start.max(start);
        let clipped_end = range.end.min(end);
        (clipped_start < clipped_end).then(|| CompletedRange {
          start: clipped_start - start,
          end: clipped_end - start,
        })
      })
      .collect::<Vec<_>>(),
  )
  .into_iter()
  .map(|range| CompletedRange {
    start: range.start + start,
    end: range.end + start,
  })
  .collect()
}

fn subtract_ranges(ranges: &[CompletedRange], removed: CompletedRange) -> Vec<CompletedRange> {
  let mut result = Vec::new();
  for range in ranges {
    if range.end <= removed.start || range.start >= removed.end {
      result.push(*range);
      continue;
    }
    if range.start < removed.start {
      result.push(CompletedRange {
        start: range.start,
        end: removed.start,
      });
    }
    if range.end > removed.end {
      result.push(CompletedRange {
        start: removed.end,
        end: range.end,
      });
    }
  }
  result
}

#[cfg(test)]
#[path = "../test/src/http.rs"]
mod tests;

#[cfg(test)]
#[path = "../test/src/http/fault_tests.rs"]
mod fault_tests;
