pub(crate) mod cookies;
mod eval;
pub(crate) mod page;
mod scripts;
pub(crate) mod storage;
mod types;

pub(crate) use types::{
  IframeCollection, InjectCodeOptions, OpenPageOptions, OpenedPage, WebStorageSnapshot,
  WebviewAuthData, WebviewCookie,
};

use tauri::{AppHandle, Manager, Runtime, WebviewWindow};

use crate::webview_registry::WebviewRegistry;

#[taurpc::procedures(path = "utils")]
pub trait UtilsApi {
  async fn webview_open_page<R: Runtime>(
    app_handle: AppHandle<R>,
    options: OpenPageOptions,
  ) -> Result<OpenedPage, String>;
  async fn webview_inject_code<R: Runtime>(
    app_handle: AppHandle<R>,
    webview_window: WebviewWindow<R>,
    options: InjectCodeOptions,
  ) -> Result<(), String>;
  async fn webview_close_current_page<R: Runtime>(
    webview_window: WebviewWindow<R>,
    app_handle: AppHandle<R>,
  ) -> Result<(), String>;
  async fn webview_close_page<R: Runtime>(
    app_handle: AppHandle<R>,
    label: String,
  ) -> Result<(), String>;
  async fn webview_auth_data_current<R: Runtime>(
    app_handle: AppHandle<R>,
    webview_window: WebviewWindow<R>,
  ) -> Result<WebviewAuthData, String>;
  async fn webview_auth_data<R: Runtime>(
    app_handle: AppHandle<R>,
    label: String,
  ) -> Result<WebviewAuthData, String>;
  async fn webview_iframe_auth_data<R: Runtime>(
    app_handle: AppHandle<R>,
    label: String,
    wait_ms: Option<u64>,
  ) -> Result<WebviewAuthData, String>;
  async fn webview_auth_data_all<R: Runtime>(
    app_handle: AppHandle<R>,
  ) -> Result<Vec<WebviewAuthData>, String>;
}

#[derive(Clone, Copy)]
pub struct UtilsApiImpl;

#[taurpc::resolvers]
impl UtilsApi for UtilsApiImpl {
  async fn webview_open_page<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    options: OpenPageOptions,
  ) -> Result<OpenedPage, String> {
    let registry = app_handle.state::<WebviewRegistry>().clone();
    page::webview_open_page(app_handle.clone(), &registry, options).await
  }

  async fn webview_inject_code<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    webview_window: WebviewWindow<R>,
    options: InjectCodeOptions,
  ) -> Result<(), String> {
    page::webview_inject_code(app_handle, webview_window, options).await
  }

  async fn webview_close_current_page<R: Runtime>(
    self,
    webview_window: WebviewWindow<R>,
    app_handle: AppHandle<R>,
  ) -> Result<(), String> {
    let registry = app_handle.state::<WebviewRegistry>().clone();
    page::webview_close_current_page(webview_window, &registry)
  }

  async fn webview_close_page<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    label: String,
  ) -> Result<(), String> {
    let registry = app_handle.state::<WebviewRegistry>().clone();
    page::webview_close_page(app_handle.clone(), &registry, label)
  }

  async fn webview_auth_data_current<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    webview_window: WebviewWindow<R>,
  ) -> Result<WebviewAuthData, String> {
    storage::webview_auth_data_current(app_handle, webview_window).await
  }

  async fn webview_auth_data<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    label: String,
  ) -> Result<WebviewAuthData, String> {
    storage::webview_auth_data(app_handle, label).await
  }

  async fn webview_iframe_auth_data<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    label: String,
    wait_ms: Option<u64>,
  ) -> Result<WebviewAuthData, String> {
    storage::webview_iframe_auth_data(app_handle, label, wait_ms).await
  }

  async fn webview_auth_data_all<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
  ) -> Result<Vec<WebviewAuthData>, String> {
    let registry = app_handle.state::<WebviewRegistry>().clone();
    storage::webview_auth_data_all(app_handle.clone(), &registry).await
  }
}

pub fn rpc_handler<R: Runtime>() -> impl taurpc::TauRpcHandler<R> {
  UtilsApiImpl.into_handler()
}
