// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! ![tauri-plugin-cors-fetch](https://github.com/idootop/tauri-plugin-cors-fetch/raw/main/banner.png)
//!
//! Enabling Cross-Origin Resource Sharing (CORS) for Fetch Requests within Tauri applications.

use std::{
  fs,
  path::{Path, PathBuf},
  sync::{
    Arc,
    atomic::{AtomicU32, Ordering},
  },
};

use dashmap::DashMap;
pub use reqwest;
use reqwest::Client;
use tauri::{
  AppHandle, Manager, Runtime,
  plugin::{Builder, TauriPlugin},
};
use taurpc::TauRpcHandler;
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
  pub(crate) requests: DashMap<u32, Arc<commands::fetch::FetchRequest>>,
  pub(crate) responses: DashMap<u32, Arc<tokio::sync::Mutex<reqwest::Response>>>,
  next_id: AtomicU32,
}

impl GlobalState {
  pub(crate) fn next_request_id(&self) -> u32 {
    self.next_id.fetch_add(1, Ordering::Relaxed)
  }

  pub(crate) fn next_response_id(&self) -> u32 {
    self.next_id.fetch_add(1, Ordering::Relaxed)
  }
}

#[taurpc::procedures(path = "http")]
pub trait HttpApi {
  async fn prepare_requester<R: Runtime>(app_handle: AppHandle<R>, client: request::ClientConfig);
  async fn fetch<R: Runtime>(
    app_handle: AppHandle<R>,
    content_config: request::ContentConfig,
  ) -> Result<u32>;
  async fn fetch_cancel<R: Runtime>(app_handle: AppHandle<R>, rid: u32) -> Result<()>;
  async fn fetch_send<R: Runtime>(
    app_handle: AppHandle<R>,
    rid: u32,
  ) -> Result<commands::fetch::FetchResponse>;
  async fn fetch_read_body<R: Runtime>(
    app_handle: AppHandle<R>,
    rid: u32,
  ) -> Result<commands::fetch::BodyChunk>;
  async fn fetch_cancel_body<R: Runtime>(app_handle: AppHandle<R>, rid: u32) -> Result<()>;
  async fn set_cookie<R: Runtime>(
    app_handle: AppHandle<R>,
    config: commands::cookie::SetCookieConfig,
  ) -> Result<()>;
  async fn get_cookie<R: Runtime>(
    app_handle: AppHandle<R>,
    config: commands::cookie::GetCookieConfig,
  ) -> Result<Option<String>>;
  async fn get_all_cookies<R: Runtime>(
    app_handle: AppHandle<R>,
    config: commands::cookie::GetAllCookiesConfig,
  ) -> Result<Vec<commands::cookie::CookieEntry>>;
  async fn get_all_domain_cookies<R: Runtime>(
    app_handle: AppHandle<R>,
    config: commands::cookie::GetAllDomainCookiesConfig,
  ) -> Result<Vec<commands::cookie::CookieEntry>>;
  async fn delete_cookie<R: Runtime>(
    app_handle: AppHandle<R>,
    config: commands::cookie::DeleteCookieConfig,
  ) -> Result<bool>;
  async fn clear_cookie<R: Runtime>(
    app_handle: AppHandle<R>,
    config: commands::cookie::ClearCookiesConfig,
  ) -> Result<()>;
}

#[derive(Clone, Copy)]
pub struct HttpApiImpl;

#[taurpc::resolvers]
impl HttpApi for HttpApiImpl {
  async fn prepare_requester<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    client: request::ClientConfig,
  ) {
    commands::fetch::prepare_requester(&app_handle.state::<GlobalState>(), client)
  }

  async fn fetch<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    content_config: request::ContentConfig,
  ) -> Result<u32> {
    commands::fetch::fetch(&app_handle.state::<GlobalState>(), content_config).await
  }

  async fn fetch_cancel<R: Runtime>(self, app_handle: AppHandle<R>, rid: u32) -> Result<()> {
    commands::fetch::fetch_cancel(&app_handle.state::<GlobalState>(), rid).await
  }

  async fn fetch_send<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    rid: u32,
  ) -> Result<commands::fetch::FetchResponse> {
    commands::fetch::fetch_send(&app_handle.state::<GlobalState>(), rid).await
  }

  async fn fetch_read_body<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    rid: u32,
  ) -> Result<commands::fetch::BodyChunk> {
    commands::fetch::fetch_read_body(&app_handle.state::<GlobalState>(), rid).await
  }

  async fn fetch_cancel_body<R: Runtime>(self, app_handle: AppHandle<R>, rid: u32) -> Result<()> {
    commands::fetch::fetch_cancel_body(&app_handle.state::<GlobalState>(), rid).await
  }

  async fn set_cookie<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    config: commands::cookie::SetCookieConfig,
  ) -> Result<()> {
    commands::cookie::set_cookie(&app_handle.state::<GlobalState>(), config).await
  }

  async fn get_cookie<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    config: commands::cookie::GetCookieConfig,
  ) -> Result<Option<String>> {
    commands::cookie::get_cookie(&app_handle.state::<GlobalState>(), config).await
  }

  async fn get_all_cookies<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    config: commands::cookie::GetAllCookiesConfig,
  ) -> Result<Vec<commands::cookie::CookieEntry>> {
    commands::cookie::get_all_cookies(&app_handle.state::<GlobalState>(), config).await
  }

  async fn get_all_domain_cookies<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    config: commands::cookie::GetAllDomainCookiesConfig,
  ) -> Result<Vec<commands::cookie::CookieEntry>> {
    commands::cookie::get_all_domain_cookies(&app_handle.state::<GlobalState>(), config).await
  }

  async fn delete_cookie<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    config: commands::cookie::DeleteCookieConfig,
  ) -> Result<bool> {
    commands::cookie::delete_cookie(&app_handle.state::<GlobalState>(), config).await
  }

  async fn clear_cookie<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    config: commands::cookie::ClearCookiesConfig,
  ) -> Result<()> {
    commands::cookie::clear_cookie(&app_handle.state::<GlobalState>(), config).await
  }
}

pub fn rpc_handler<R: Runtime>() -> impl TauRpcHandler<R> {
  HttpApiImpl.into_handler()
}

pub fn export_bindings(
  path: impl AsRef<Path>,
) -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = path.as_ref();
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-http-bindings-{}.ts",
    std::process::id()
  ));

  let router = taurpc::Router::new().merge(rpc_handler::<tauri::Wry>());
  taurpc::Exporter::new().export(&router, &temp_path)?;
  let generated_text = String::from_utf8(fs::read(&temp_path)?)?;
  let mut generated = generated_text.replace(", type UnlistenFn", "").into_bytes();
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
        requests: DashMap::new(),
        responses: DashMap::new(),
        next_id: AtomicU32::new(1),
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
    .build()
}
