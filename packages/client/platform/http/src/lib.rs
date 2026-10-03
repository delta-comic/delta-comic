// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! ![tauri-plugin-cors-fetch](https://github.com/idootop/tauri-plugin-cors-fetch/raw/main/banner.png)
//!
//! Enabling Cross-Origin Resource Sharing (CORS) for Fetch Requests within Tauri applications.

use std::{
  fs,
  path::{Path, PathBuf},
  sync::Arc,
};

use dashmap::DashMap;
pub use reqwest;
use reqwest::Client;
use tauri::{
  Manager, Runtime,
  plugin::{Builder, TauriPlugin},
};
use tauri_specta::{Builder as SpectaBuilder, ErrorHandlingMode, collect_commands};
mod request;

pub use error::{Error, Result};
mod commands;
mod cookies;
mod error;
mod headers;

pub type InstanceKey = String;
pub(crate) struct GlobalState {
  cookies_jar: DashMap<InstanceKey, std::sync::Arc<crate::cookies::CookieStoreMutex>>,
  cache_dir: PathBuf,
  pool: DashMap<request::ClientCacheKey, Arc<Client>>,
}

pub fn specta_builder() -> SpectaBuilder<tauri::Wry> {
  SpectaBuilder::<tauri::Wry>::new()
    .plugin_name("http")
    .error_handling(ErrorHandlingMode::Throw)
    .commands(collect_commands![
      commands::fetch::fetch::<tauri::Wry>,
      commands::fetch::fetch_cancel::<tauri::Wry>,
      commands::fetch::fetch_send::<tauri::Wry>,
      commands::fetch::fetch_cancel_body::<tauri::Wry>,
      commands::fetch::prepare_requester::<tauri::Wry>,
      commands::cookie::set_cookie::<tauri::Wry>,
      commands::cookie::get_cookie::<tauri::Wry>,
      commands::cookie::get_all_cookies::<tauri::Wry>,
      commands::cookie::get_all_domain_cookies::<tauri::Wry>,
      commands::cookie::delete_cookie::<tauri::Wry>,
      commands::cookie::clear_cookie::<tauri::Wry>,
    ])
}

pub fn export_bindings(
  path: impl AsRef<Path>,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = path.as_ref();
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-http-bindings-{}.ts",
    std::process::id()
  ));

  specta_builder().export(specta_typescript::Typescript::default(), &temp_path)?;
  let mut generated = fs::read(&temp_path)?;
  while generated.ends_with(b"\n\n") {
    generated.pop();
  }
  let current = fs::read(path).unwrap_or_default();
  if generated != current {
    fs::write(path, generated)?;
  }
  let _ = fs::remove_file(temp_path);

  Ok(())
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  Builder::<R>::new("http")
    .setup(|app, _| {
      let state = GlobalState {
        cookies_jar: DashMap::new(), //std::sync::Arc::new(cookies_jar),
        pool: DashMap::new(),
        cache_dir: app.path().app_cache_dir()?,
      };

      app.manage(state);

      Ok(())
    })
    .on_event(|app, event| {
      if let tauri::RunEvent::Exit = event {
        let state = app.state::<GlobalState>();

        state
          .cookies_jar
          .iter()
          .for_each(|jar| match jar.request_save() {
            Ok(rx) => {
              let _ = rx.recv();
            }
            Err(_e) => {
              #[cfg(feature = "tracing")]
              tracing::error!("failed to save cookie jar: {_e}");
            }
          });
      }
    })
    .invoke_handler(tauri::generate_handler![
      commands::fetch::fetch,
      commands::fetch::fetch_cancel,
      commands::fetch::fetch_send,
      commands::fetch::fetch_read_body,
      commands::fetch::fetch_cancel_body,
      commands::fetch::prepare_requester,
      commands::cookie::set_cookie,
      commands::cookie::get_cookie,
      commands::cookie::get_all_cookies,
      commands::cookie::get_all_domain_cookies,
      commands::cookie::delete_cookie,
      commands::cookie::clear_cookie,
    ])
    .build()
}
