use std::{
  ffi::c_void,
  fs::File,
  os::fd::FromRawFd,
  path::PathBuf,
  sync::{Arc, Mutex, OnceLock, RwLock},
};

use jni::{
  JNIEnv,
  objects::{GlobalRef, JObject, JString},
  sys::{jint, jstring},
};
use serde::de::DeserializeOwned;
use tauri::{
  AppHandle, Runtime,
  plugin::{PluginApi, PluginHandle},
};

use crate::{
  SecretResolver,
  engine::{DirectSafTarget, Engine, EngineEvent},
  mobile_contract::{
    AndroidEngineConfig, AndroidNotificationPermission, AndroidScheduleRequest,
    AndroidScheduleResponse,
  },
  saf_contract::{
    AndroidDeleteExportRequest, AndroidDeleteExportResponse, AndroidPickedDestination,
  },
};

const PLUGIN_IDENTIFIER: &str = "org.delta_comic.downloader";
type MobileEventSink = Arc<dyn Fn(EngineEvent) + Send + Sync>;

#[derive(Clone)]
struct RegisteredEngine {
  engine: Engine,
  config: AndroidEngineConfig,
}

static ENGINE: OnceLock<RegisteredEngine> = OnceLock::new();
static ENGINE_INIT: OnceLock<tokio::sync::Mutex<()>> = OnceLock::new();
static EVENT_SINK: OnceLock<RwLock<Option<MobileEventSink>>> = OnceLock::new();
static SECRET_RESOLVER: OnceLock<RwLock<Option<Arc<dyn SecretResolver>>>> = OnceLock::new();
static CREDENTIAL_CONTEXT: OnceLock<GlobalRef> = OnceLock::new();
static CREDENTIAL_CONTEXT_INIT: OnceLock<Mutex<()>> = OnceLock::new();

struct MobileSecretResolver;

impl SecretResolver for MobileSecretResolver {
  fn resolve(&self, secret_ref: &str) -> crate::Result<Option<String>> {
    let resolver = SECRET_RESOLVER
      .get_or_init(|| RwLock::new(None))
      .read()
      .unwrap_or_else(std::sync::PoisonError::into_inner)
      .clone();
    match resolver {
      Some(resolver) => resolver.resolve(secret_ref),
      None => Ok(None),
    }
  }
}

fn initialize_credential_context(env: &mut JNIEnv<'_>, context: &JObject<'_>) -> crate::Result<()> {
  let _guard = CREDENTIAL_CONTEXT_INIT
    .get_or_init(|| Mutex::new(()))
    .lock()
    .unwrap_or_else(std::sync::PoisonError::into_inner);
  if CREDENTIAL_CONTEXT.get().is_some() {
    return Ok(());
  }

  let context = env.new_global_ref(context).map_err(|_| {
    crate::Error::CredentialStore("Android credential context could not be retained".into())
  })?;
  let java_vm = env.get_java_vm().map_err(|_| {
    crate::Error::CredentialStore("Android credential context could not access the JVM".into())
  })?;
  let java_vm_pointer = java_vm.get_java_vm_pointer() as *mut c_void;
  let context_pointer = context.as_obj().as_raw() as *mut c_void;

  // The global reference is retained for the process lifetime below, and the initialization gate
  // guarantees this is the only call into ndk-context.
  unsafe {
    ndk_context::initialize_android_context(java_vm_pointer, context_pointer);
  }
  if let Err(context) = CREDENTIAL_CONTEXT.set(context) {
    // ndk-context now owns the raw pointer contract. Preserve it even on this unreachable race so
    // a failed bookkeeping update can never leave a dangling Java reference.
    std::mem::forget(context);
    return Err(crate::Error::CredentialStore(
      "Android credential context initialization raced".into(),
    ));
  }
  Ok(())
}

fn register_system_secret_resolver_if_missing() -> crate::Result<()> {
  let mut resolver = SECRET_RESOLVER
    .get_or_init(|| RwLock::new(None))
    .write()
    .unwrap_or_else(std::sync::PoisonError::into_inner);
  if resolver.is_none() {
    let credentials = crate::credentials::CredentialVault::system()?;
    *resolver = Some(crate::credentials::resolver(credentials, None));
  }
  Ok(())
}

pub(crate) fn register_event_sink(events: impl Fn(EngineEvent) + Send + Sync + 'static) {
  let sink = EVENT_SINK.get_or_init(|| RwLock::new(None));
  *sink
    .write()
    .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(Arc::new(events));
}

fn emit_event(event: EngineEvent) {
  let sink = EVENT_SINK
    .get_or_init(|| RwLock::new(None))
    .read()
    .unwrap_or_else(std::sync::PoisonError::into_inner)
    .clone();
  if let Some(sink) = sink {
    sink(event);
  }
}

pub(crate) async fn open_or_reuse_engine(
  config: AndroidEngineConfig,
  secret_resolver: Option<Arc<dyn SecretResolver>>,
) -> crate::Result<Engine> {
  if let Some(secret_resolver) = secret_resolver {
    *SECRET_RESOLVER
      .get_or_init(|| RwLock::new(None))
      .write()
      .unwrap_or_else(std::sync::PoisonError::into_inner) = Some(secret_resolver);
  }
  let guard = ENGINE_INIT
    .get_or_init(|| tokio::sync::Mutex::new(()))
    .lock()
    .await;
  if let Some(registered) = ENGINE.get() {
    if registered.config != config {
      return Err(crate::Error::InvalidInput(
        "Android downloader engine is already initialized with different storage paths".into(),
      ));
    }
    drop(guard);
    return Ok(registered.engine.clone());
  }

  let engine = Engine::open(
    &PathBuf::from(&config.database_path),
    &PathBuf::from(&config.download_dir),
    Some(Arc::new(MobileSecretResolver)),
    emit_event,
  )
  .await?;
  let registered = RegisteredEngine {
    engine: engine.clone(),
    config,
  };
  ENGINE.set(registered).map_err(|_| {
    crate::Error::InvalidInput("Android downloader engine initialization raced".into())
  })?;
  drop(guard);
  Ok(engine)
}

pub(crate) fn init<R: Runtime, C: DeserializeOwned>(
  _app: &AppHandle<R>,
  api: PluginApi<R, C>,
) -> Result<MobileDownloader<R>, Box<dyn std::error::Error>> {
  let handle = api.register_android_plugin(PLUGIN_IDENTIFIER, "DownloaderPlugin")?;
  Ok(MobileDownloader { handle })
}

pub(crate) struct MobileDownloader<R: Runtime> {
  handle: PluginHandle<R>,
}

impl<R: Runtime> MobileDownloader<R> {
  pub(crate) fn initialize_credential_context(&self) -> Result<(), String> {
    self
      .handle
      .run_mobile_plugin::<serde_json::Value>("initializeCredentialContext", ())
      .map(|_| ())
      .map_err(|_| "failed to initialize Android credential storage".to_string())
  }

  pub(crate) fn configure(&self, config: AndroidEngineConfig) -> Result<(), String> {
    self
      .handle
      .run_mobile_plugin::<serde_json::Value>("configure", config)
      .map(|_| ())
      .map_err(|error| format!("failed to persist Android downloader configuration: {error}"))
  }

  #[allow(dead_code)]
  pub(crate) fn schedule(
    &self,
    task_id: String,
    estimated_bytes: Option<u64>,
    allow_metered: bool,
  ) -> Result<AndroidNotificationPermission, String> {
    self
      .handle
      .run_mobile_plugin::<AndroidScheduleResponse>(
        "schedule",
        AndroidScheduleRequest {
          task_id,
          estimated_bytes,
          allow_metered,
        },
      )
      .map(|response| response.notification_permission)
      .map_err(|error| format!("failed to schedule Android download: {error}"))
  }

  pub(crate) fn pick_destination(&self) -> Result<Option<AndroidPickedDestination>, String> {
    self
      .handle
      .run_mobile_plugin::<AndroidPickedDestination>("pickDestination", ())
      .map(|destination| (!destination.cancelled).then_some(destination))
      .map_err(|error| format!("failed to select Android download destination: {error}"))
  }

  pub(crate) fn delete_exported(
    &self,
    tree_uri: String,
    document_uri: String,
  ) -> Result<(), String> {
    let response = self
      .handle
      .run_mobile_plugin::<AndroidDeleteExportResponse>(
        "deleteExported",
        AndroidDeleteExportRequest {
          tree_uri,
          document_uri,
        },
      )
      .map_err(|error| format!("failed to delete exported Android download: {error}"))?;
    response
      .deleted
      .then_some(())
      .ok_or_else(|| "Android document provider did not delete the exported download".to_string())
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_initializeCredentialContext(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  context: JObject<'_>,
) -> jint {
  match initialize_credential_context(&mut env, &context) {
    Ok(()) => 0,
    Err(error) => {
      log::error!("Android credential context initialization failed: {error}");
      1
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_runTask(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) -> jint {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return 1;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return 2;
  };
  match tauri::async_runtime::block_on(engine.run_task_now(&task_id)) {
    Ok(()) => {
      match tauri::async_runtime::block_on(engine.repository.pending_saf_export(&task_id)) {
        Ok(Some(_)) => 3,
        Ok(None) => 0,
        Err(error) => {
          log::error!("Android SAF export lookup failed: {error}");
          1
        }
      }
    }
    Err(error) => {
      log::error!("Android background download failed: {error}");
      let task = tauri::async_runtime::block_on(engine.repository.get_task(&task_id))
        .ok()
        .flatten();
      if task.is_some_and(|task| {
        matches!(
          task.status,
          crate::TaskStatus::Paused
            | crate::TaskStatus::Cancelled
            | crate::TaskStatus::Failed
            | crate::TaskStatus::WaitingForSource
        )
      }) {
        2
      } else {
        1
      }
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_getSafDirectInstruction(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) -> jstring {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return std::ptr::null_mut();
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return std::ptr::null_mut();
  };
  let instruction =
    match tauri::async_runtime::block_on(engine.repository.direct_saf_instruction(&task_id)) {
      Ok(Some(instruction)) => instruction,
      Ok(None) => return std::ptr::null_mut(),
      Err(error) => {
        log::error!("Android direct SAF instruction lookup failed: {error}");
        return std::ptr::null_mut();
      }
    };
  let json = serde_json::json!({
    "treeUri": instruction.tree_uri,
    "relativePath": instruction.relative_path,
    "expectedLength": instruction.expected_length,
    "temporaryName": instruction.temporary_name,
    "temporaryDocumentUri": instruction.temporary_document_uri,
    "readyToCommit": instruction.ready_to_commit,
  })
  .to_string();
  env
    .new_string(json)
    .map(JString::into_raw)
    .unwrap_or(std::ptr::null_mut())
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_rememberDirectSaf(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
  document_uri: JString<'_>,
) -> jint {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return 1;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return 2;
  };
  let Ok(document_uri): Result<String, _> = env.get_string(&document_uri).map(Into::into) else {
    return 2;
  };
  match tauri::async_runtime::block_on(
    engine
      .repository
      .begin_direct_saf_transfer(&task_id, &document_uri),
  ) {
    Ok(()) => 0,
    Err(error) => {
      log::error!("Android direct SAF state could not be persisted: {error}");
      1
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_runTaskDirectSaf(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
  file_descriptor: jint,
  document_uri: JString<'_>,
) -> jint {
  if file_descriptor < 0 {
    return 2;
  }
  // ParcelFileDescriptor.detachFd transfers ownership to this native call.
  // Construct the File before parsing any Java strings so every early return
  // closes the descriptor exactly once.
  let file = unsafe { File::from_raw_fd(file_descriptor) };
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return 1;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return 2;
  };
  let Ok(document_uri): Result<String, _> = env.get_string(&document_uri).map(Into::into) else {
    return 2;
  };
  let target = DirectSafTarget {
    file: Arc::new(file),
    document_uri,
  };
  match tauri::async_runtime::block_on(engine.run_task_now_with_direct_saf(&task_id, target)) {
    Ok(()) => 4,
    Err(error) => {
      log::error!("Android direct SAF download failed: {error}");
      let task = tauri::async_runtime::block_on(engine.repository.get_task(&task_id))
        .ok()
        .flatten();
      if task.is_some_and(|task| {
        matches!(
          task.status,
          crate::TaskStatus::Paused
            | crate::TaskStatus::Cancelled
            | crate::TaskStatus::Failed
            | crate::TaskStatus::WaitingForSource
        )
      }) {
        2
      } else {
        1
      }
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_abandonDirectSaf(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) -> jint {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return 1;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return 2;
  };
  match tauri::async_runtime::block_on(engine.abandon_direct_saf_transfer(&task_id)) {
    Ok(()) => 0,
    Err(error) => {
      log::error!("Android direct SAF fallback failed: {error}");
      1
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_resumeSafCommit(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) -> jint {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return 1;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return 2;
  };
  match tauri::async_runtime::block_on(engine.resume_saf_commit(&task_id)) {
    Ok(()) => 0,
    Err(error) => {
      log::error!("Android SAF commit resume failed: {error}");
      1
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_getSafExportInstruction(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) -> jstring {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return std::ptr::null_mut();
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return std::ptr::null_mut();
  };
  let instruction =
    match tauri::async_runtime::block_on(engine.repository.pending_saf_export(&task_id)) {
      Ok(Some(instruction)) => instruction,
      Ok(None) => return std::ptr::null_mut(),
      Err(error) => {
        log::error!("Android SAF export instruction lookup failed: {error}");
        return std::ptr::null_mut();
      }
    };
  let json = serde_json::json!({
    "treeUri": instruction.tree_uri,
    "relativePath": instruction.relative_path,
    "stagingPath": instruction.staging_path,
    "isDirectory": instruction.is_directory,
  })
  .to_string();
  env
    .new_string(json)
    .map(JString::into_raw)
    .unwrap_or(std::ptr::null_mut())
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_completeSafExport(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
  document_uri: JString<'_>,
) -> jint {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return 1;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return 2;
  };
  let Ok(document_uri): Result<String, _> = env.get_string(&document_uri).map(Into::into) else {
    return 2;
  };
  match tauri::async_runtime::block_on(engine.complete_saf_export(&task_id, &document_uri)) {
    Ok(()) => 0,
    Err(error) => {
      log::error!("Android SAF export completion failed: {error}");
      2
    }
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_failSafExport(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
  message: JString<'_>,
) {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return;
  };
  let Ok(message): Result<String, _> = env.get_string(&message).map(Into::into) else {
    return;
  };
  if let Err(error) = tauri::async_runtime::block_on(engine.fail_saf_export(&task_id, &message)) {
    log::error!("Android SAF export failure could not be persisted: {error}");
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_pauseTask(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return;
  };
  if let Err(error) = tauri::async_runtime::block_on(engine.pause(&task_id)) {
    log::error!("Android downloader pause action failed: {error}");
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_cancelTask(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return;
  };
  if let Err(error) = tauri::async_runtime::block_on(engine.cancel(&task_id)) {
    log::error!("Android downloader cancel action failed: {error}");
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_checkpointTask(
  _env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  _task_id: JString<'_>,
) {
  if let Some(engine) = ENGINE.get().map(|registered| &registered.engine)
    && let Err(error) = tauri::async_runtime::block_on(engine.handle().checkpoint())
  {
    log::error!("Android downloader checkpoint failed: {error}");
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_systemStopTask(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  task_id: JString<'_>,
) {
  let Some(engine) = ENGINE.get().map(|registered| &registered.engine) else {
    return;
  };
  let Ok(task_id): Result<String, _> = env.get_string(&task_id).map(Into::into) else {
    return;
  };
  if let Err(error) = tauri::async_runtime::block_on(engine.system_stop_task(&task_id)) {
    log::error!("Android downloader system stop failed: {error}");
  }
}

#[allow(non_snake_case)]
#[unsafe(no_mangle)]
pub extern "system" fn Java_org_delta_1comic_downloader_NativeBridge_bootstrap(
  mut env: JNIEnv<'_>,
  _receiver: JObject<'_>,
  database_path: JString<'_>,
  download_dir: JString<'_>,
) -> jint {
  let Ok(database_path): Result<String, _> = env.get_string(&database_path).map(Into::into) else {
    return 2;
  };
  let Ok(download_dir): Result<String, _> = env.get_string(&download_dir).map(Into::into) else {
    return 2;
  };
  let config = match AndroidEngineConfig::new(
    PathBuf::from(database_path).as_path(),
    PathBuf::from(download_dir).as_path(),
  ) {
    Ok(config) => config,
    Err(error) => {
      log::error!("Android downloader bootstrap rejected its configuration: {error}");
      return 2;
    }
  };
  if let Err(error) = register_system_secret_resolver_if_missing() {
    log::error!("Android credential store initialization failed: {error}");
    return 1;
  }
  match tauri::async_runtime::block_on(open_or_reuse_engine(config, None)) {
    Ok(_) => 0,
    Err(error) => {
      log::error!("Android downloader bootstrap failed: {error}");
      1
    }
  }
}
