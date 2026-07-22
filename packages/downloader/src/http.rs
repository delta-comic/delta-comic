use std::{
  collections::{HashMap, HashSet, VecDeque},
  fs::{File, OpenOptions},
  path::{Component, Path, PathBuf},
  sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
  },
  time::{Duration, Instant, SystemTime},
};

use futures_util::StreamExt;
use reqwest::{
  Client, Response, StatusCode,
  header::{
    AUTHORIZATION, CONTENT_LENGTH, CONTENT_RANGE, COOKIE, ETAG, HeaderMap, HeaderName, HeaderValue,
    IF_RANGE, LAST_MODIFIED, PROXY_AUTHORIZATION, RANGE,
  },
};
use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

use crate::{
  domain::{DownloadTask, DownloaderSettings, HttpHeaderValue, HttpMirror, HttpSource},
  error::{Error, Result},
  persistence::{
    CompletedRange, IntegritySample, Repository, merge_ranges, missing_ranges, split_ranges,
  },
};

const MINIMUM_SEGMENT_SIZE: u64 = 4 * 1024 * 1024;
const MINIMUM_REBALANCE_REMAINING: u64 = 8 * 1024 * 1024;
const MINIMUM_WORKER_AGE: Duration = Duration::from_secs(2);
const REBALANCE_COOLDOWN: Duration = Duration::from_secs(1);
const CHECKPOINT_BYTES: u64 = 1024 * 1024;
const INTEGRITY_SAMPLE_BYTES: u64 = 64 * 1024;
const MAX_INTEGRITY_SAMPLES: usize = 16;

#[derive(Debug, Clone)]
pub struct ProbeResult {
  pub total_bytes: Option<u64>,
  pub supports_ranges: bool,
  pub etag: Option<String>,
  pub last_modified: Option<String>,
}

#[derive(Debug)]
pub struct DownloadReport {
  pub total_bytes: u64,
  pub elapsed: std::time::Duration,
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
    self
      .completed
      .iter()
      .map(|range| range.end - range.start)
      .sum()
  }
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

#[derive(Clone)]
struct SegmentBase {
  client: Client,
  url: String,
  headers: HeaderMap,
  file: Arc<File>,
  repository: Repository,
  task_id: String,
  ledger: Arc<Mutex<RangeLedger>>,
  checkpoint: Arc<Mutex<CheckpointState>>,
  total: u64,
  validator: Option<String>,
  started: Instant,
}

struct CheckpointState {
  completed_bytes: u64,
  elapsed_millis: u64,
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
  pub cancellation: CancellationToken,
  pub secret_resolver: Option<&'a dyn crate::SecretResolver>,
  pub maximum_bytes: Option<u64>,
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
  let mut mirrors = request
    .source
    .mirrors
    .iter()
    .enumerate()
    .collect::<Vec<_>>();
  mirrors.sort_by(|(left_index, left), (right_index, right)| {
    right
      .priority
      .cmp(&left.priority)
      .then_with(|| left_index.cmp(right_index))
  });
  if mirrors.is_empty() {
    return Err(Error::InvalidInput("HTTP source has no mirrors".into()));
  }

  let mut last_error = None;
  for (_, mirror) in mirrors {
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
      Err(Error::Cancelled) => return Err(Error::Cancelled),
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
  let probe =
    probe_with_headers(client, &mirror.url, request.source.expected_size, &headers).await?;
  if probe
    .total_bytes
    .zip(request.maximum_bytes)
    .is_some_and(|(total, maximum)| total > maximum)
  {
    return Err(Error::InvalidInput(format!(
      "download exceeds the {maximum_bytes} byte IPC limit",
      maximum_bytes = request.maximum_bytes.expect("checked above"),
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

  let destination_root = task_storage_root(task)?;
  if let Some(parent) = request.temp_path.parent() {
    reject_symlinks_below(&destination_root, parent)?;
    tokio::fs::create_dir_all(parent).await?;
    reject_symlinks_below(&destination_root, parent)?;
  }
  let file = Arc::new(open_partial_file(&destination_root, request.temp_path)?);

  let mut completed = request.repository.completed_ranges(&task.id).await?;
  if !completed.is_empty() {
    let reusable = can_reuse_completed(
      client,
      &mirror.url,
      &headers,
      &file,
      request.repository,
      task,
      &probe,
    )
    .await?;
    if !reusable {
      request.repository.clear_progress(&task.id).await?;
      completed.clear();
    }
  }
  request
    .repository
    .update_probe(
      &task.id,
      probe.total_bytes,
      probe.etag.as_deref(),
      probe.last_modified.as_deref(),
    )
    .await?;
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

  if !probe.supports_ranges {
    request.repository.clear_progress(&task.id).await?;
    let report = sequential_download(
      client,
      &mirror.url,
      &headers,
      &file,
      probe.total_bytes,
      request,
    )
    .await?;
    return Ok(report);
  }

  let total_bytes = probe
    .total_bytes
    .ok_or_else(|| Error::InvalidInput("range response did not provide a total length".into()))?;

  let ledger = Arc::new(Mutex::new(RangeLedger::new(completed)));
  let checkpoint = Arc::new(Mutex::new(CheckpointState {
    completed_bytes: ledger.lock().await.completed_bytes(),
    elapsed_millis: 0,
  }));
  let workers = usize::from(request.settings.per_task_connections)
    .min(usize::from(request.settings.connection_budget))
    .max(1);
  let mut no_progress_rounds = 0_u8;

  loop {
    if request.cancellation.is_cancelled() {
      return Err(Error::Cancelled);
    }
    let before = ledger.lock().await.completed_bytes();
    let missing = {
      let guard = ledger.lock().await;
      missing_ranges(total_bytes, &guard.completed)
    };
    if missing.is_empty() {
      break;
    }
    let planned = split_ranges(&missing, workers, MINIMUM_SEGMENT_SIZE);
    let range_ignored = run_segment_round(
      SegmentBase {
        client: client.clone(),
        url: mirror.url.clone(),
        headers: headers.clone(),
        file: file.clone(),
        repository: request.repository.clone(),
        task_id: task.id.clone(),
        ledger: ledger.clone(),
        checkpoint: checkpoint.clone(),
        total: total_bytes,
        validator: strong_etag(probe.etag.as_deref())
          .map(str::to_owned)
          .or_else(|| probe.last_modified.clone()),
        started,
      },
      planned,
      workers,
      &request.cancellation,
    )
    .await?;
    if range_ignored {
      file.set_len(0)?;
      request.repository.clear_progress(&task.id).await?;
      sequential_download(
        client,
        &mirror.url,
        &headers,
        &file,
        Some(total_bytes),
        request,
      )
      .await?;
      return Ok(DownloadReport {
        total_bytes,
        elapsed: started.elapsed(),
      });
    }

    let after = ledger.lock().await.completed_bytes();
    if after == before {
      no_progress_rounds += 1;
      if no_progress_rounds >= 2 {
        return Err(Error::RangeRejected);
      }
    } else {
      no_progress_rounds = 0;
    }
  }

  let completed = ledger.lock().await.completed.clone();
  file.sync_data()?;
  request
    .repository
    .replace_completed_ranges(&task.id, &completed)
    .await?;
  persist_integrity_samples(request.repository, &task.id, &file, &completed).await?;
  request
    .repository
    .update_progress(&task.id, total_bytes, 0)
    .await?;
  file.sync_all()?;
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
  base: SegmentBase,
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
      let context = SegmentContext {
        client: base.client.clone(),
        url: base.url.clone(),
        headers: base.headers.clone(),
        file: base.file.clone(),
        repository: base.repository.clone(),
        task_id: base.task_id.clone(),
        ledger: base.ledger.clone(),
        checkpoint: base.checkpoint.clone(),
        total: base.total,
        validator: base.validator.clone(),
        cancellation: worker_token.clone(),
        progress: progress.clone(),
        started: base.started,
      };
      handles.spawn(async move { (id, download_segment(context, range).await) });
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
        checkpoint_segment_round(&base).await?;
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
            checkpoint_segment_round(&base).await?;
            return Err(error);
          }
        }
      }
      () = tokio::time::sleep(Duration::from_millis(100)) => {}
    }
  }
}

async fn checkpoint_segment_round(base: &SegmentBase) -> Result<()> {
  let (completed, downloaded) = {
    let ledger = base.ledger.lock().await;
    (ledger.completed.clone(), ledger.completed_bytes())
  };
  base.file.sync_data()?;
  base
    .repository
    .replace_completed_ranges(&base.task_id, &completed)
    .await?;
  persist_integrity_samples(&base.repository, &base.task_id, &base.file, &completed).await?;
  let elapsed = base.started.elapsed().as_secs_f64().max(0.001);
  base
    .repository
    .update_progress(
      &base.task_id,
      downloaded,
      (downloaded as f64 / elapsed) as u64,
    )
    .await?;
  Ok(())
}

struct SegmentContext {
  client: Client,
  url: String,
  headers: HeaderMap,
  file: Arc<File>,
  repository: Repository,
  task_id: String,
  ledger: Arc<Mutex<RangeLedger>>,
  checkpoint: Arc<Mutex<CheckpointState>>,
  total: u64,
  validator: Option<String>,
  cancellation: CancellationToken,
  progress: Arc<WorkerProgress>,
  started: Instant,
}

async fn download_segment(
  context: SegmentContext,
  requested: CompletedRange,
) -> Result<SegmentOutcome> {
  let mut request = context
    .client
    .get(&context.url)
    .headers(context.headers.clone())
    .header(
      RANGE,
      format!("bytes={}-{}", requested.start, requested.end - 1),
    );
  if let Some(validator) = &context.validator {
    request = request.header(IF_RANGE, validator);
  }
  let response = tokio::select! {
    () = context.cancellation.cancelled() => return Err(Error::Cancelled),
    response = request.send() => response?,
  };
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
  if content_range.total != context.total || content_range.start >= context.total {
    return Err(Error::RemoteChanged);
  }
  if context
    .validator
    .as_ref()
    .is_some_and(|expected| response_validator_changed(&response, expected))
  {
    return Err(Error::RemoteChanged);
  }
  context
    .progress
    .set_response_range(content_range.start, content_range.end);

  let mut stream = response.bytes_stream();
  let mut offset = content_range.start;
  while let Some(next) = tokio::select! {
    () = context.cancellation.cancelled() => return Err(Error::Cancelled),
    value = stream.next() => value,
  } {
    let bytes = next?;
    if bytes.is_empty() {
      continue;
    }
    let response_chunk_end = offset
      .checked_add(bytes.len() as u64)
      .ok_or_else(|| Error::InvalidInput("response offset overflow".into()))?;
    if response_chunk_end > content_range.end || response_chunk_end > context.total {
      return Err(Error::InvalidInput(
        "response body exceeded Content-Range".into(),
      ));
    }
    let chunk_end = response_chunk_end;
    if chunk_end <= offset {
      break;
    }
    let claims = context.ledger.lock().await.claim(offset, chunk_end);
    let write_result = write_claims(&context.file, offset, &bytes, &claims);
    let mut ledger = context.ledger.lock().await;
    if let Err(error) = write_result {
      ledger.release(&claims);
      return Err(error);
    }
    ledger.commit(&claims);
    context.progress.advance(chunk_end, bytes.len() as u64);
    let downloaded = ledger.completed_bytes();
    let snapshot = ledger.completed.clone();
    drop(ledger);

    let elapsed_millis = u64::try_from(context.started.elapsed().as_millis()).unwrap_or(u64::MAX);
    let should_checkpoint = {
      let mut checkpoint = context.checkpoint.lock().await;
      let bytes_due = downloaded.saturating_sub(checkpoint.completed_bytes) >= CHECKPOINT_BYTES;
      let time_due = elapsed_millis.saturating_sub(checkpoint.elapsed_millis) >= 500;
      if bytes_due || time_due {
        checkpoint.completed_bytes = downloaded;
        checkpoint.elapsed_millis = elapsed_millis;
        true
      } else {
        false
      }
    };
    if should_checkpoint {
      context.file.sync_data()?;
      context
        .repository
        .replace_completed_ranges(&context.task_id, &snapshot)
        .await?;
      persist_integrity_samples(
        &context.repository,
        &context.task_id,
        &context.file,
        &snapshot,
      )
      .await?;
      let elapsed = context.started.elapsed().as_secs_f64().max(0.001);
      context
        .repository
        .update_progress(
          &context.task_id,
          downloaded,
          (downloaded as f64 / elapsed) as u64,
        )
        .await?;
    }
    offset = offset.saturating_add(bytes.len() as u64);
    if offset >= content_range.end || offset >= context.total {
      break;
    }
  }
  if offset < content_range.end.min(context.total) {
    return Err(Error::InvalidInput(
      "range response ended before Content-Range".into(),
    ));
  }
  Ok(SegmentOutcome::Completed)
}

async fn sequential_download(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  file: &Arc<File>,
  expected_total: Option<u64>,
  request: &DownloadRequest<'_>,
) -> Result<DownloadReport> {
  let response = client.get(url).headers(headers.clone()).send().await?;
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
    _ => {}
  }
  file.set_len(0)?;
  let mut offset = 0_u64;
  let started = Instant::now();
  let mut checkpoint_bytes = 0_u64;
  let mut checkpoint_at = Instant::now();
  let mut stream = response.bytes_stream();
  while let Some(next) = tokio::select! {
    () = request.cancellation.cancelled() => return Err(Error::Cancelled),
    value = stream.next() => value,
  } {
    let bytes = next?;
    if request.maximum_bytes.is_some_and(|maximum| {
      offset
        .checked_add(bytes.len() as u64)
        .is_none_or(|end| end > maximum)
    }) {
      return Err(Error::InvalidInput(format!(
        "download exceeds the {maximum_bytes} byte IPC limit",
        maximum_bytes = request.maximum_bytes.expect("checked above"),
      )));
    }
    if expected_total.is_some_and(|total| offset + bytes.len() as u64 > total) {
      return Err(Error::RemoteChanged);
    }
    write_all_at(file, &bytes, offset)?;
    offset += bytes.len() as u64;
    if offset.saturating_sub(checkpoint_bytes) >= CHECKPOINT_BYTES
      || checkpoint_at.elapsed() >= Duration::from_millis(500)
    {
      file.sync_data()?;
      request
        .repository
        .replace_completed_ranges(
          &request.task.id,
          &[CompletedRange {
            start: 0,
            end: offset,
          }],
        )
        .await?;
      persist_integrity_samples(
        request.repository,
        &request.task.id,
        file,
        &[CompletedRange {
          start: 0,
          end: offset,
        }],
      )
      .await?;
      let speed = (offset as f64 / started.elapsed().as_secs_f64().max(0.001)) as u64;
      request
        .repository
        .update_progress(&request.task.id, offset, speed)
        .await?;
      checkpoint_bytes = offset;
      checkpoint_at = Instant::now();
    }
  }
  if expected_total.is_some_and(|total| offset != total) {
    return Err(Error::RemoteChanged);
  }
  file.sync_data()?;
  request
    .repository
    .replace_completed_ranges(
      &request.task.id,
      &[CompletedRange {
        start: 0,
        end: offset,
      }],
    )
    .await?;
  persist_integrity_samples(
    request.repository,
    &request.task.id,
    file,
    &[CompletedRange {
      start: 0,
      end: offset,
    }],
  )
  .await?;
  request
    .repository
    .update_transfer_progress(
      &request.task.id,
      crate::domain::TaskStatus::Downloading,
      offset,
      offset,
      0,
    )
    .await?;
  file.sync_all()?;
  Ok(DownloadReport {
    total_bytes: offset,
    elapsed: started.elapsed(),
  })
}

async fn probe_with_headers(
  client: &Client,
  url: &str,
  expected_size: Option<u64>,
  headers: &HeaderMap,
) -> Result<ProbeResult> {
  let response = client
    .get(url)
    .headers(headers.clone())
    .header(RANGE, "bytes=0-0")
    .send()
    .await?;
  if let Some(error) = retryable_response_error(&response) {
    return Err(error);
  }
  match response.status() {
    StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => Err(Error::SourceExpired),
    StatusCode::PARTIAL_CONTENT => {
      let content_range = header_text(&response, CONTENT_RANGE)
        .and_then(|value| parse_content_range(&value))
        .ok_or(Error::RangeRejected)?;
      Ok(ProbeResult {
        total_bytes: Some(content_range.total),
        supports_ranges: true,
        etag: header_text(&response, ETAG),
        last_modified: header_text(&response, LAST_MODIFIED),
      })
    }
    StatusCode::OK => {
      let total = response
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse().ok())
        .or(expected_size);
      Ok(ProbeResult {
        total_bytes: total,
        supports_ranges: false,
        etag: header_text(&response, ETAG),
        last_modified: header_text(&response, LAST_MODIFIED),
      })
    }
    StatusCode::RANGE_NOT_SATISFIABLE => {
      if expected_size == Some(0) {
        Ok(ProbeResult {
          total_bytes: Some(0),
          supports_ranges: true,
          etag: header_text(&response, ETAG),
          last_modified: header_text(&response, LAST_MODIFIED),
        })
      } else {
        Err(Error::RemoteChanged)
      }
    }
    status => Err(Error::InvalidInput(format!(
      "download probe returned {status}"
    ))),
  }
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

async fn can_reuse_completed(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  file: &File,
  repository: &Repository,
  task: &DownloadTask,
  probe: &ProbeResult,
) -> Result<bool> {
  let Some(total) = probe.total_bytes else {
    return Ok(false);
  };
  if let (Some(previous), Some(current)) = (
    strong_etag(task.etag.as_deref()),
    strong_etag(probe.etag.as_deref()),
  ) {
    return Ok(previous == current && task.total_bytes == Some(total));
  }
  if let (Some(previous), Some(current)) = (&task.last_modified, &probe.last_modified) {
    return Ok(previous == current && task.total_bytes == Some(total));
  }
  if task.total_bytes != Some(total) {
    return Ok(false);
  }
  verify_integrity_samples(client, url, headers, file, repository, &task.id, total).await
}

async fn verify_integrity_samples(
  client: &Client,
  url: &str,
  headers: &HeaderMap,
  file: &File,
  repository: &Repository,
  task_id: &str,
  total: u64,
) -> Result<bool> {
  use sha2::{Digest, Sha256};

  let samples = repository.integrity_samples(task_id).await?;
  if samples.is_empty() {
    return Ok(false);
  }
  for sample in samples {
    let Some(end) = sample.start.checked_add(sample.length) else {
      return Ok(false);
    };
    if sample.length == 0 || end > total {
      return Ok(false);
    }
    let mut local = vec![
      0_u8;
      usize::try_from(sample.length).map_err(|_| {
        Error::InvalidInput("integrity sample length exceeds address space".into())
      })?
    ];
    if read_exact_at(file, &mut local, sample.start).is_err()
      || hex::encode(Sha256::digest(&local)) != sample.sha256
    {
      return Ok(false);
    }

    let response = client
      .get(url)
      .headers(headers.clone())
      .header(RANGE, format!("bytes={}-{}", sample.start, end - 1))
      .send()
      .await?;
    if matches!(
      response.status(),
      StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN
    ) {
      return Err(Error::SourceExpired);
    }
    if response.status() != StatusCode::PARTIAL_CONTENT {
      return Ok(false);
    }
    let Some(content_range) =
      header_text(&response, CONTENT_RANGE).and_then(|value| parse_content_range(&value))
    else {
      return Ok(false);
    };
    if content_range.start != sample.start
      || content_range.end != end
      || content_range.total != total
    {
      return Ok(false);
    }
    let remote = collect_limited_body(response, sample.length).await?;
    if remote.len() as u64 != sample.length || hex::encode(Sha256::digest(&remote)) != sample.sha256
    {
      return Ok(false);
    }
  }
  Ok(true)
}

async fn persist_integrity_samples(
  repository: &Repository,
  task_id: &str,
  file: &File,
  completed: &[CompletedRange],
) -> Result<()> {
  use sha2::{Digest, Sha256};

  let mut positions = Vec::new();
  for range in merge_ranges(completed.to_vec()) {
    let length = (range.end - range.start).min(INTEGRITY_SAMPLE_BYTES);
    if length == 0 {
      continue;
    }
    positions.push((range.start, length));
    let tail_start = range.end - length;
    if tail_start != range.start {
      positions.push((tail_start, length));
    }
  }
  positions.sort_unstable();
  positions.dedup();
  if positions.len() > MAX_INTEGRITY_SAMPLES {
    let last = positions.len() - 1;
    positions = (0..MAX_INTEGRITY_SAMPLES)
      .map(|index| positions[index * last / (MAX_INTEGRITY_SAMPLES - 1)])
      .collect();
  }

  let mut samples = Vec::with_capacity(positions.len());
  for (start, length) in positions {
    let mut bytes = vec![
      0_u8;
      usize::try_from(length).map_err(|_| {
        Error::InvalidInput("integrity sample length exceeds address space".into())
      })?
    ];
    read_exact_at(file, &mut bytes, start)?;
    samples.push(IntegritySample {
      start,
      length,
      sha256: hex::encode(Sha256::digest(&bytes)),
    });
  }
  repository
    .replace_integrity_samples(task_id, &samples)
    .await
}

async fn collect_limited_body(response: Response, expected: u64) -> Result<Vec<u8>> {
  let capacity = usize::try_from(expected)
    .map_err(|_| Error::InvalidInput("response length exceeds address space".into()))?;
  let mut body = Vec::with_capacity(capacity);
  let mut stream = response.bytes_stream();
  while let Some(chunk) = stream.next().await {
    let chunk = chunk?;
    if body.len().saturating_add(chunk.len()) > capacity {
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
    let start = usize::try_from(claim.start - chunk_start)
      .map_err(|_| Error::InvalidInput("chunk offset exceeds address space".into()))?;
    let end = usize::try_from(claim.end - chunk_start)
      .map_err(|_| Error::InvalidInput("chunk offset exceeds address space".into()))?;
    write_all_at(file, &bytes[start..end], claim.start)?;
  }
  Ok(())
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
fn read_exact_at(file: &File, mut bytes: &mut [u8], mut offset: u64) -> std::io::Result<()> {
  use std::os::unix::fs::FileExt;
  while !bytes.is_empty() {
    let read = file.read_at(bytes, offset)?;
    if read == 0 {
      return Err(std::io::Error::from(std::io::ErrorKind::UnexpectedEof));
    }
    let (_, remaining) = bytes.split_at_mut(read);
    bytes = remaining;
    offset += read as u64;
  }
  Ok(())
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
fn write_all_at(file: &File, mut bytes: &[u8], mut offset: u64) -> Result<()> {
  use std::os::unix::fs::FileExt;
  while !bytes.is_empty() {
    let written = file.write_at(bytes, offset)?;
    if written == 0 {
      return Err(std::io::Error::from(std::io::ErrorKind::WriteZero).into());
    }
    bytes = &bytes[written..];
    offset += written as u64;
  }
  Ok(())
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
mod tests {
  use std::{
    collections::BTreeMap,
    time::{Duration, UNIX_EPOCH},
  };

  use super::{
    MINIMUM_REBALANCE_REMAINING, MINIMUM_WORKER_AGE, ParsedContentRange, RangeLedger,
    WorkerTelemetry, build_headers, choose_slow_tail, overlapping_worker_to_cancel,
    parse_content_range, parse_retry_after,
  };
  use crate::{domain::HttpHeaderValue, persistence::CompletedRange};

  #[test]
  fn parses_content_range() {
    assert_eq!(
      parse_content_range("bytes 10-19/100"),
      Some(ParsedContentRange {
        start: 10,
        end: 20,
        total: 100
      }),
    );
    assert_eq!(parse_content_range("bytes */100"), None);
    assert_eq!(parse_content_range("bytes 20-10/100"), None);
  }

  #[test]
  fn parses_retry_after_delta_seconds_and_http_dates() {
    assert_eq!(parse_retry_after("17", UNIX_EPOCH), Some(17_000));
    assert_eq!(
      parse_retry_after(
        "Thu, 01 Jan 1970 00:01:00 GMT",
        UNIX_EPOCH + Duration::from_secs(15),
      ),
      Some(45_000),
    );
    assert_eq!(
      parse_retry_after(
        "Thu, 01 Jan 1970 00:00:10 GMT",
        UNIX_EPOCH + Duration::from_secs(15),
      ),
      None,
    );
    assert_eq!(parse_retry_after("not-a-delay", UNIX_EPOCH), None);
    assert_eq!(parse_retry_after("18446744073709551615", UNIX_EPOCH), None);
  }

  #[test]
  fn ledger_never_claims_overlapping_writes() {
    let mut ledger = RangeLedger::new(vec![CompletedRange { start: 0, end: 10 }]);
    let first = ledger.claim(5, 20);
    let second = ledger.claim(15, 25);
    assert_eq!(first, vec![CompletedRange { start: 10, end: 20 }]);
    assert_eq!(second, vec![CompletedRange { start: 20, end: 25 }]);
    ledger.commit(&first);
    ledger.commit(&second);
    assert_eq!(ledger.completed_bytes(), 25);
  }

  #[test]
  fn slow_tail_requires_age_size_and_a_free_split_point() {
    let young = WorkerTelemetry {
      id: 1,
      cursor: 0,
      end: MINIMUM_REBALANCE_REMAINING * 2,
      transferred: 1,
      age: MINIMUM_WORKER_AGE - Duration::from_millis(1),
    };
    assert_eq!(choose_slow_tail(&[young]), None);

    let eligible = WorkerTelemetry {
      age: MINIMUM_WORKER_AGE,
      ..young
    };
    let plan = choose_slow_tail(&[eligible]).expect("eligible tail should split");
    assert_eq!(plan.worker_id, 1);
    assert_eq!(plan.first.end, plan.second.start);
    assert_eq!(plan.second.end, eligible.end);
  }

  #[test]
  fn cancels_the_less_productive_overlapping_worker() {
    let workers = [
      WorkerTelemetry {
        id: 1,
        cursor: 10,
        end: 30,
        transferred: 5,
        age: Duration::from_secs(3),
      },
      WorkerTelemetry {
        id: 2,
        cursor: 20,
        end: 40,
        transferred: 10,
        age: Duration::from_secs(3),
      },
    ];
    assert_eq!(overlapping_worker_to_cancel(&workers), Some(1));
  }

  #[test]
  fn sensitive_headers_require_secret_references() {
    for name in ["Authorization", "Proxy-Authorization", "Cookie"] {
      let headers = BTreeMap::from([(
        name.into(),
        HttpHeaderValue::Value {
          value: "plaintext-secret".into(),
        },
      )]);

      let error = build_headers(&headers, None).unwrap_err();
      assert!(error.to_string().contains("must use a secretRef"));
    }
  }

  #[test]
  fn non_sensitive_literal_headers_remain_supported() {
    let headers = BTreeMap::from([(
      "User-Agent".into(),
      HttpHeaderValue::Value {
        value: "delta-comic-test".into(),
      },
    )]);

    let built = build_headers(&headers, None).unwrap();
    assert_eq!(built.get("user-agent").unwrap(), "delta-comic-test");
  }
}

#[cfg(test)]
mod fault_tests;
