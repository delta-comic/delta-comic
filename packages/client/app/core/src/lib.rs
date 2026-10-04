use std::{fs, path::Path};

use tauri_plugin_aptabase::EventTracker;
use tauri_plugin_downloader::DownloaderExt;

#[taurpc::procedures(path = "app")]
pub trait AppApi {
  async fn get_runtime_platform() -> String;
}

#[derive(Clone)]
struct AppApiImpl;

#[taurpc::resolvers]
impl AppApi for AppApiImpl {
  async fn get_runtime_platform(self) -> String {
    if cfg!(target_os = "android") {
      "android".to_string()
    } else if cfg!(target_os = "ios") {
      "ios".to_string()
    } else if cfg!(target_os = "windows") {
      "windows".to_string()
    } else if cfg!(target_os = "macos") {
      "macos".to_string()
    } else if cfg!(target_os = "linux") {
      "linux".to_string()
    } else {
      "unknown".to_string()
    }
  }
}

pub fn rpc_handler<R: tauri::Runtime>() -> impl taurpc::TauRpcHandler<R> {
  AppApiImpl.into_handler()
}

pub fn export_bindings(
  path: impl AsRef<Path>,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = path.as_ref();
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-app-bindings-{}.ts",
    std::process::id()
  ));
  taurpc::Exporter::new().export(&AppApiImpl.into_handler(), &temp_path)?;
  let generated = fs::read_to_string(&temp_path)?
    .replace(", type UnlistenFn", "")
    .into_bytes();
  let current = fs::read(path).unwrap_or_default();
  if generated != current {
    fs::write(path, generated)?;
  }
  let _ = fs::remove_file(temp_path);
  Ok(())
}

pub fn rpc_router<R: tauri::Runtime>() -> taurpc::Router<R> {
  taurpc::Router::new()
    .merge(rpc_handler())
    .merge(tauri_plugin_http::rpc_handler())
    .merge(tauri_plugin_downloader::rpc_handler())
    .merge(tauri_plugin_logger::rpc_handler())
    .merge(tauri_plugin_utils::rpc_handler())
    .merge(tauri_plugin_db::rpc_handler())
    .merge(tauri_plugin_plugin::rpc_handler())
}

pub fn builder() -> tauri::Builder<tauri::Wry> {
  let builder = tauri_plugin_utils::init(
    tauri::Builder::default()
      .invoke_handler(rpc_router::<tauri::Wry>().into_handler())
      .plugin(tauri_plugin_logger::init())
      .plugin(tauri_plugin_fs::init()),
  );
  let builder = builder
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_plugin::init())
    .plugin(tauri_plugin_downloader::init());
  tauri_plugin_db::init(builder)
}

pub fn setup(app: &mut tauri::App) -> tauri::Result<()> {
  let handle = app.handle().clone();
  tauri::async_runtime::block_on(async move {
    handle.plugin(tauri_plugin_aptabase::Builder::new("A-US-9793062880").build())
  })?;

  tracing::info!(target: "app::lifecycle", "application bootstrap started");
  let logo = r#"
_____   _________________ ____        __________________ _____   ______
|  __ \|  ____|| |__   __| __ \      / ______\   |  \/  |_   _| / _____\
| |  | | |__   | |  | |  | | \ \    | |    _____ | \  / | | |  | /
| |  | |  __|  | |  | |  | |__\ \   | |   /  _  \| |\/| | | |  | |
| |__| | |____ | |__| |  |  ___\ \  | |___| |_| || |  | |_| |_ | \_____
|_____/|______||______|  |_|    \_\  \__________/|_|  \_______| \______/
=========================================================================
  Per aspera Ad astra                                Copyright © Wenxig
"#;

  tracing::info!(target: "app::lifecycle", "{logo}");
  Ok(())
}

pub fn on_event(handler: &tauri::AppHandle, event: tauri::RunEvent) {
  match event {
    tauri::RunEvent::Exit => {
      tracing::info!(target: "app::lifecycle", "application shutdown started");
      if let Err(error) = tauri::async_runtime::block_on(handler.downloader().shutdown()) {
        tracing::error!(target: "app::downloader", %error, "failed to stop downloader cleanly");
      }
      let _ = handler.track_event("app_exited", None);
      handler.flush_events_blocking();
    }
    tauri::RunEvent::Ready => {
      tracing::info!(target: "app::lifecycle", "application runtime ready");
      let _ = handler.track_event("app_started", None);
    }
    _ => {}
  }
}
