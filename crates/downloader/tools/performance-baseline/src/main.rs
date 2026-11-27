use std::{
  collections::BTreeMap,
  convert::Infallible,
  env,
  fs::File,
  io::{Read, Seek, SeekFrom},
  path::{Path, PathBuf},
  sync::{
    Arc,
    atomic::{AtomicBool, AtomicU64, Ordering},
  },
  thread,
  time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use axum::{
  Router,
  body::Body,
  extract::State,
  http::{HeaderMap, Response, StatusCode, header},
  routing::get,
};
use futures_util::stream;
use serde::Serialize;
use tauri::{Manager, test::MockRuntime};
use tauri_plugin_downloader::{
  DownloadTask, DownloaderExt, DownloaderHandle, DownloaderSettings, EnqueueUrlInput, TaskStatus,
};
use tokio::net::TcpListener;

const ENABLE_ENV: &str = "DOWNLOADER_BENCHMARK_ENABLE";
const BYTES_ENV: &str = "DOWNLOADER_BENCHMARK_BYTES";
const SHARDS_ENV: &str = "DOWNLOADER_BENCHMARK_SHARDS";
const TASKS_ENV: &str = "DOWNLOADER_BENCHMARK_TASKS";
const TIMEOUT_ENV: &str = "DOWNLOADER_BENCHMARK_TIMEOUT_SECONDS";
const OUTPUT_ENV: &str = "DOWNLOADER_BENCHMARK_OUTPUT";
const CHUNK_BYTES_ENV: &str = "DOWNLOADER_BENCHMARK_CHUNK_BYTES";
const CHUNK_DELAY_ENV: &str = "DOWNLOADER_BENCHMARK_CHUNK_DELAY_MS";
const MAX_TOTAL_BYTES_ENV: &str = "DOWNLOADER_BENCHMARK_MAX_TOTAL_BYTES";

const DEFAULT_BYTES_PER_TASK: u64 = 8 * 1024 * 1024;
const DEFAULT_CHUNK_BYTES: usize = 256 * 1024;
const DEFAULT_MAX_TOTAL_BYTES: u64 = 2 * 1024 * 1024 * 1024;
const ALLOWED_SHARDS: &[u8] = &[1, 4, 8, 16];

type ToolResult<T> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

#[derive(Debug)]
struct Config {
  bytes_per_task: u64,
  shard_counts: Vec<u8>,
  task_counts: Vec<u8>,
  timeout: Duration,
  output: Option<PathBuf>,
  chunk_bytes: usize,
  chunk_delay: Duration,
  max_total_bytes: u64,
}

impl Config {
  fn from_env() -> ToolResult<Self> {
    if !env_flag(ENABLE_ENV) {
      return Err(format!("performance baseline is opt-in; set {ENABLE_ENV}=1 to run it").into());
    }

    let bytes_per_task = parse_u64(BYTES_ENV, DEFAULT_BYTES_PER_TASK)?;
    if bytes_per_task == 0 {
      return Err(format!("{BYTES_ENV} must be greater than zero").into());
    }
    let shard_counts = parse_list(SHARDS_ENV, &[1])?;
    if let Some(value) = shard_counts
      .iter()
      .find(|value| !ALLOWED_SHARDS.contains(value))
    {
      return Err(format!("{SHARDS_ENV} contains {value}; supported values are 1,4,8,16").into());
    }
    let task_counts = parse_list(TASKS_ENV, &[1])?;
    if let Some(value) = task_counts
      .iter()
      .copied()
      .find(|value| !(1..=20).contains(value))
    {
      return Err(format!("{TASKS_ENV} contains {value}; values must be between 1 and 20").into());
    }
    let timeout = Duration::from_secs(parse_u64(TIMEOUT_ENV, 300)?);
    if timeout.is_zero() {
      return Err(format!("{TIMEOUT_ENV} must be greater than zero").into());
    }
    let chunk_bytes = usize::try_from(parse_u64(CHUNK_BYTES_ENV, DEFAULT_CHUNK_BYTES as u64)?)?;
    if !(1024..=8 * 1024 * 1024).contains(&chunk_bytes) {
      return Err(format!("{CHUNK_BYTES_ENV} must be between 1024 and 8388608").into());
    }
    let chunk_delay = Duration::from_millis(parse_u64(CHUNK_DELAY_ENV, 0)?);
    let max_total_bytes = parse_u64(MAX_TOTAL_BYTES_ENV, DEFAULT_MAX_TOTAL_BYTES)?;
    let planned_bytes = shard_counts
      .len()
      .checked_mul(task_counts.iter().map(|&value| usize::from(value)).sum())
      .and_then(|tasks| u64::try_from(tasks).ok())
      .and_then(|tasks| tasks.checked_mul(bytes_per_task))
      .ok_or("configured benchmark size overflowed")?;
    if planned_bytes > max_total_bytes {
      return Err(format!(
        "planned transfer is {planned_bytes} bytes, above the {max_total_bytes} byte safety limit; raise {MAX_TOTAL_BYTES_ENV} explicitly"
      )
      .into());
    }

    Ok(Self {
      bytes_per_task,
      shard_counts,
      task_counts,
      timeout,
      output: env::var_os(OUTPUT_ENV).map(PathBuf::from),
      chunk_bytes,
      chunk_delay,
      max_total_bytes,
    })
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Report {
  schema_version: u8,
  generated_at_unix_millis: u128,
  tool_version: &'static str,
  environment: Environment,
  configuration: ReportConfig,
  cases: Vec<CaseReport>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Environment {
  os: &'static str,
  arch: &'static str,
  debug_assertions: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReportConfig {
  bytes_per_task: u64,
  shard_counts: Vec<u8>,
  task_counts: Vec<u8>,
  timeout_seconds: u64,
  chunk_bytes: usize,
  chunk_delay_millis: u128,
  max_total_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaseReport {
  requested_connections_per_task: u8,
  effective_connections_per_task: u8,
  connection_budget: u16,
  tasks: u8,
  bytes_per_task: u64,
  total_bytes: u64,
  elapsed_millis: u128,
  throughput_bytes_per_second: u64,
  range_requests: u64,
  response_bytes: u64,
  max_concurrent_responses: u64,
  sqlite_bytes: u64,
  peak_resident_memory_bytes: Option<u64>,
  cpu_user_millis: Option<u64>,
  cpu_system_millis: Option<u64>,
}

#[derive(Clone)]
struct ServerState {
  total_bytes: u64,
  chunk_bytes: usize,
  chunk_delay: Duration,
  metrics: Arc<ServerMetrics>,
}

#[derive(Default)]
struct ServerMetrics {
  requests: AtomicU64,
  response_bytes: AtomicU64,
  active: AtomicU64,
  max_active: AtomicU64,
}

struct ActiveResponse {
  metrics: Arc<ServerMetrics>,
}

impl ActiveResponse {
  fn begin(metrics: Arc<ServerMetrics>) -> Self {
    let active = metrics.active.fetch_add(1, Ordering::AcqRel) + 1;
    metrics.max_active.fetch_max(active, Ordering::AcqRel);
    Self { metrics }
  }
}

impl Drop for ActiveResponse {
  fn drop(&mut self) {
    self.metrics.active.fetch_sub(1, Ordering::AcqRel);
  }
}

struct RangeServer {
  url: String,
  metrics: Arc<ServerMetrics>,
  task: tauri::async_runtime::JoinHandle<()>,
}

impl RangeServer {
  async fn start(total_bytes: u64, chunk_bytes: usize, chunk_delay: Duration) -> ToolResult<Self> {
    let metrics = Arc::new(ServerMetrics::default());
    let state = ServerState {
      total_bytes,
      chunk_bytes,
      chunk_delay,
      metrics: metrics.clone(),
    };
    let listener = TcpListener::bind("127.0.0.1:0").await?;
    let address = listener.local_addr()?;
    let router = Router::new()
      .route("/file", get(serve_range))
      .with_state(state);
    let task = tauri::async_runtime::spawn(async move {
      if let Err(error) = axum::serve(listener, router).await {
        eprintln!("performance range server stopped: {error}");
      }
    });
    Ok(Self {
      url: format!("http://{address}/file"),
      metrics,
      task,
    })
  }
}

impl Drop for RangeServer {
  fn drop(&mut self) {
    self.task.abort();
  }
}

async fn serve_range(State(state): State<ServerState>, headers: HeaderMap) -> Response<Body> {
  let Some((start, requested_end)) = headers
    .get(header::RANGE)
    .and_then(|value| value.to_str().ok())
    .and_then(parse_range)
  else {
    return Response::builder()
      .status(StatusCode::BAD_REQUEST)
      .body(Body::empty())
      .expect("static response is valid");
  };
  if start >= state.total_bytes {
    return Response::builder()
      .status(StatusCode::RANGE_NOT_SATISFIABLE)
      .header(
        header::CONTENT_RANGE,
        format!("bytes */{}", state.total_bytes),
      )
      .body(Body::empty())
      .expect("static response is valid");
  }
  let end = requested_end.min(state.total_bytes).max(start + 1);
  let response_len = end - start;
  state.metrics.requests.fetch_add(1, Ordering::Relaxed);
  let active = ActiveResponse::begin(state.metrics.clone());
  let body = stream::unfold(
    (start, end, active, state.chunk_bytes, state.chunk_delay),
    |(cursor, end, active, chunk_bytes, delay)| async move {
      if cursor >= end {
        return None;
      }
      if !delay.is_zero() {
        tokio::time::sleep(delay).await;
      }
      let next = cursor
        .saturating_add(u64::try_from(chunk_bytes).unwrap_or(u64::MAX))
        .min(end);
      let bytes = (cursor..next)
        .map(|offset| (offset % 251) as u8)
        .collect::<Vec<_>>();
      active
        .metrics
        .response_bytes
        .fetch_add(bytes.len() as u64, Ordering::Relaxed);
      Some((
        Ok::<_, Infallible>(bytes),
        (next, end, active, chunk_bytes, delay),
      ))
    },
  );
  Response::builder()
    .status(StatusCode::PARTIAL_CONTENT)
    .header(
      header::CONTENT_RANGE,
      format!(
        "bytes {start}-{}/{total}",
        end - 1,
        total = state.total_bytes
      ),
    )
    .header(header::CONTENT_LENGTH, response_len)
    .header(header::ETAG, "\"downloader-performance-baseline-v1\"")
    .body(Body::from_stream(body))
    .expect("static response is valid")
}

fn parse_range(value: &str) -> Option<(u64, u64)> {
  let (start, inclusive_end) = value.strip_prefix("bytes=")?.split_once('-')?;
  Some((
    start.parse().ok()?,
    inclusive_end.parse::<u64>().ok()?.checked_add(1)?,
  ))
}

fn main() {
  if let Err(error) = run() {
    eprintln!("downloader performance baseline failed: {error}");
    std::process::exit(2);
  }
}

fn run() -> ToolResult<()> {
  let config = Config::from_env()?;
  let mut cases = Vec::new();
  for &shards in &config.shard_counts {
    for &tasks in &config.task_counts {
      cases.push(run_case(&config, shards, tasks)?);
    }
  }
  let report = Report {
    schema_version: 1,
    generated_at_unix_millis: SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis(),
    tool_version: env!("CARGO_PKG_VERSION"),
    environment: Environment {
      os: env::consts::OS,
      arch: env::consts::ARCH,
      debug_assertions: cfg!(debug_assertions),
    },
    configuration: ReportConfig {
      bytes_per_task: config.bytes_per_task,
      shard_counts: config.shard_counts.clone(),
      task_counts: config.task_counts.clone(),
      timeout_seconds: config.timeout.as_secs(),
      chunk_bytes: config.chunk_bytes,
      chunk_delay_millis: config.chunk_delay.as_millis(),
      max_total_bytes: config.max_total_bytes,
    },
    cases,
  };
  let json = serde_json::to_string_pretty(&report)?;
  if let Some(path) = &config.output {
    if let Some(parent) = path.parent().filter(|path| !path.as_os_str().is_empty()) {
      std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, format!("{json}\n"))?;
  }
  println!("{json}");
  Ok(())
}

fn run_case(config: &Config, shards: u8, tasks: u8) -> ToolResult<CaseReport> {
  let root = tempfile::tempdir()?;
  let downloads = root.path().join("downloads");
  let database = root.path().join("downloader.sqlite");
  let server = tauri::async_runtime::block_on(RangeServer::start(
    config.bytes_per_task,
    config.chunk_bytes,
    config.chunk_delay,
  ))?;
  let plugin = tauri_plugin_downloader::Builder::new()
    .database_path(&database)
    .download_dir(&downloads)
    .build::<MockRuntime>();
  let app = tauri::test::mock_builder()
    .plugin(plugin)
    .build(tauri::test::mock_context(tauri::test::noop_assets()))?;
  let app_data = app.path().app_data_dir()?;
  let downloader = app.handle().downloader();

  let connection_budget = (u16::from(shards) * u16::from(tasks)).clamp(1, 64);
  let effective_connections = shards.min((connection_budget / u16::from(tasks)).max(1) as u8);
  let settings = DownloaderSettings {
    max_active_tasks: tasks,
    connection_budget,
    per_task_connections: shards,
    allow_metered: true,
    seed_on_complete: false,
    seed_ratio: None,
    seed_seconds: None,
    revision: 0,
  };
  tauri::async_runtime::block_on(downloader.update_settings(settings))?;

  let cpu_before = cpu_usage();
  let memory = MemorySampler::start();
  let started = Instant::now();
  for index in 0..tasks {
    let input = EnqueueUrlInput {
      url: server.url.clone(),
      title: Some(format!("baseline-{index}")),
      relative_path: Some(format!("baseline-{index}.bin")),
      destination_id: None,
      priority: Some(5),
      checksum: None,
      mirrors: Vec::new(),
    };
    tauri::async_runtime::block_on(downloader.enqueue_url(input))?;
  }

  let completed = wait_for_completion(&downloader, tasks, config.timeout)?;
  let elapsed = started.elapsed();
  let peak_resident_memory_bytes = memory.finish();
  let cpu = cpu_usage_delta(cpu_before, cpu_usage());
  for task in &completed {
    verify_task_file(task, config.bytes_per_task)?;
  }
  let total_bytes = config
    .bytes_per_task
    .checked_mul(u64::from(tasks))
    .ok_or("case transfer size overflowed")?;
  let throughput_bytes_per_second =
    (total_bytes as f64 / elapsed.as_secs_f64().max(0.000_001)) as u64;
  let sqlite_bytes = sqlite_size(&database)?;

  tauri::async_runtime::block_on(downloader.shutdown())?;
  drop(app);
  let _ = std::fs::remove_dir(app_data.join(".downloader-ephemeral"));
  let _ = root.close();

  Ok(CaseReport {
    requested_connections_per_task: shards,
    effective_connections_per_task: effective_connections,
    connection_budget,
    tasks,
    bytes_per_task: config.bytes_per_task,
    total_bytes,
    elapsed_millis: elapsed.as_millis(),
    throughput_bytes_per_second,
    range_requests: server.metrics.requests.load(Ordering::Acquire),
    response_bytes: server.metrics.response_bytes.load(Ordering::Acquire),
    max_concurrent_responses: server.metrics.max_active.load(Ordering::Acquire),
    sqlite_bytes,
    peak_resident_memory_bytes,
    cpu_user_millis: cpu.map(|value| value.user_micros / 1_000),
    cpu_system_millis: cpu.map(|value| value.system_micros / 1_000),
  })
}

fn wait_for_completion(
  downloader: &DownloaderHandle,
  expected_tasks: u8,
  timeout: Duration,
) -> ToolResult<Vec<DownloadTask>> {
  let deadline = Instant::now() + timeout;
  loop {
    let tasks = tauri::async_runtime::block_on(downloader.list_tasks())?;
    if let Some(failed) = tasks.iter().find(|task| {
      matches!(
        task.status,
        TaskStatus::Failed
          | TaskStatus::Cancelled
          | TaskStatus::WaitingForSource
          | TaskStatus::WaitingForNetwork
      )
    }) {
      return Err(
        format!(
          "task {} stopped in {:?}: {}",
          failed.id,
          failed.status,
          failed
            .error_message
            .as_deref()
            .unwrap_or("no error message")
        )
        .into(),
      );
    }
    if tasks.len() == usize::from(expected_tasks)
      && tasks
        .iter()
        .all(|task| task.status == TaskStatus::Completed)
    {
      return Ok(tasks);
    }
    if Instant::now() >= deadline {
      return Err(
        format!(
          "case timed out after {} seconds; current states: {:?}",
          timeout.as_secs(),
          tasks
            .iter()
            .map(|task| (&task.id, task.status))
            .collect::<BTreeMap<_, _>>()
        )
        .into(),
      );
    }
    thread::sleep(Duration::from_millis(50));
  }
}

fn verify_task_file(task: &DownloadTask, expected_bytes: u64) -> ToolResult<()> {
  let path = task
    .final_path
    .as_deref()
    .map(Path::new)
    .ok_or_else(|| format!("completed task {} has no final path", task.id))?;
  let metadata = std::fs::metadata(path)?;
  if metadata.len() != expected_bytes {
    return Err(
      format!(
        "completed task {} has {} bytes, expected {expected_bytes}",
        task.id,
        metadata.len()
      )
      .into(),
    );
  }
  let mut file = File::open(path)?;
  let sample_size = usize::try_from(expected_bytes.min(4096))?;
  let mut offsets = vec![0, expected_bytes.saturating_sub(sample_size as u64)];
  offsets.push(expected_bytes.saturating_sub(sample_size as u64) / 2);
  offsets.sort_unstable();
  offsets.dedup();
  let mut sample = vec![0; sample_size];
  for offset in offsets {
    file.seek(SeekFrom::Start(offset))?;
    file.read_exact(&mut sample)?;
    if let Some((index, actual)) = sample
      .iter()
      .copied()
      .enumerate()
      .find(|(index, actual)| *actual != ((offset + *index as u64) % 251) as u8)
    {
      return Err(
        format!(
          "completed task {} differs at byte {}: got {actual}",
          task.id,
          offset + index as u64
        )
        .into(),
      );
    }
  }
  Ok(())
}

fn sqlite_size(database: &Path) -> ToolResult<u64> {
  let mut total = 0_u64;
  for suffix in ["", "-wal", "-shm"] {
    let path = PathBuf::from(format!("{}{suffix}", database.display()));
    if let Ok(metadata) = std::fs::metadata(path) {
      total = total.saturating_add(metadata.len());
    }
  }
  Ok(total)
}

fn env_flag(name: &str) -> bool {
  env::var(name).ok().is_some_and(|value| {
    matches!(
      value.trim().to_ascii_lowercase().as_str(),
      "1" | "true" | "yes"
    )
  })
}

fn parse_u64(name: &str, default: u64) -> ToolResult<u64> {
  env::var(name)
    .map(|value| {
      value
        .trim()
        .parse()
        .map_err(|error| format!("{name} must be an integer: {error}").into())
    })
    .unwrap_or(Ok(default))
}

fn parse_list(name: &str, default: &[u8]) -> ToolResult<Vec<u8>> {
  let Some(value) = env::var_os(name) else {
    return Ok(default.to_vec());
  };
  let value = value
    .into_string()
    .map_err(|_| format!("{name} must contain UTF-8 text"))?;
  let mut result = Vec::new();
  for item in value.split(',') {
    let parsed = item
      .trim()
      .parse::<u8>()
      .map_err(|error| format!("{name} contains an invalid value: {error}"))?;
    if !result.contains(&parsed) {
      result.push(parsed);
    }
  }
  if result.is_empty() {
    return Err(format!("{name} must contain at least one value").into());
  }
  Ok(result)
}

struct MemorySampler {
  stop: Arc<AtomicBool>,
  peak: Arc<AtomicU64>,
  available: Arc<AtomicBool>,
  thread: Option<thread::JoinHandle<()>>,
}

impl MemorySampler {
  fn start() -> Self {
    let stop = Arc::new(AtomicBool::new(false));
    let peak = Arc::new(AtomicU64::new(0));
    let available = Arc::new(AtomicBool::new(false));
    let thread_stop = stop.clone();
    let thread_peak = peak.clone();
    let thread_available = available.clone();
    let thread = thread::spawn(move || {
      while !thread_stop.load(Ordering::Acquire) {
        if let Some(bytes) = resident_memory_bytes() {
          thread_available.store(true, Ordering::Release);
          thread_peak.fetch_max(bytes, Ordering::AcqRel);
        }
        thread::sleep(Duration::from_millis(20));
      }
    });
    Self {
      stop,
      peak,
      available,
      thread: Some(thread),
    }
  }

  fn finish(mut self) -> Option<u64> {
    self.stop.store(true, Ordering::Release);
    if let Some(thread) = self.thread.take() {
      let _ = thread.join();
    }
    self
      .available
      .load(Ordering::Acquire)
      .then(|| self.peak.load(Ordering::Acquire))
  }
}

#[cfg(target_os = "linux")]
fn resident_memory_bytes() -> Option<u64> {
  let statm = std::fs::read_to_string("/proc/self/statm").ok()?;
  let pages = statm.split_whitespace().nth(1)?.parse::<u64>().ok()?;
  // SAFETY: sysconf has no memory-safety preconditions and only reads process configuration.
  let page_size = unsafe { libc::sysconf(libc::_SC_PAGESIZE) };
  u64::try_from(page_size)
    .ok()
    .and_then(|page_size| pages.checked_mul(page_size))
}

#[cfg(target_os = "macos")]
fn resident_memory_bytes() -> Option<u64> {
  let mut info = std::mem::MaybeUninit::<libc::mach_task_basic_info>::zeroed();
  let mut count = libc::MACH_TASK_BASIC_INFO_COUNT;
  // SAFETY: `info` points to writable storage of the flavor's documented size, and `count`
  // matches that storage. `mach_task_self` returns the current process task port.
  let result = unsafe {
    libc::task_info(
      mach2::traps::mach_task_self(),
      libc::MACH_TASK_BASIC_INFO,
      info.as_mut_ptr().cast(),
      &mut count,
    )
  };
  if result != libc::KERN_SUCCESS {
    return None;
  }
  // SAFETY: task_info returned KERN_SUCCESS, so the structure was initialized.
  Some(unsafe { info.assume_init() }.resident_size)
}

#[cfg(not(any(target_os = "linux", target_os = "macos")))]
fn resident_memory_bytes() -> Option<u64> {
  None
}

#[derive(Clone, Copy)]
struct CpuUsage {
  user_micros: u64,
  system_micros: u64,
}

#[cfg(unix)]
fn cpu_usage() -> Option<CpuUsage> {
  let mut usage = std::mem::MaybeUninit::<libc::rusage>::zeroed();
  // SAFETY: `usage` is valid writable storage for getrusage's process result.
  if unsafe { libc::getrusage(libc::RUSAGE_SELF, usage.as_mut_ptr()) } != 0 {
    return None;
  }
  // SAFETY: getrusage returned success, so the structure was initialized.
  let usage = unsafe { usage.assume_init() };
  Some(CpuUsage {
    user_micros: timeval_micros(usage.ru_utime)?,
    system_micros: timeval_micros(usage.ru_stime)?,
  })
}

#[cfg(unix)]
fn timeval_micros(value: libc::timeval) -> Option<u64> {
  u64::try_from(value.tv_sec)
    .ok()?
    .checked_mul(1_000_000)?
    .checked_add(u64::try_from(value.tv_usec).ok()?)
}

#[cfg(not(unix))]
fn cpu_usage() -> Option<CpuUsage> {
  None
}

fn cpu_usage_delta(before: Option<CpuUsage>, after: Option<CpuUsage>) -> Option<CpuUsage> {
  let (before, after) = before.zip(after)?;
  Some(CpuUsage {
    user_micros: after.user_micros.saturating_sub(before.user_micros),
    system_micros: after.system_micros.saturating_sub(before.system_micros),
  })
}
