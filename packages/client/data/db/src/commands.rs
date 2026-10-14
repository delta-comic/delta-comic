use std::{
  fs, io,
  path::{Path, PathBuf},
};

use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};
use tauri::{AppHandle, Manager, Runtime};

use crate::NativeStore;

const PATH_SEGMENT_ENCODE_SET: &AsciiSet = &CONTROLS
  .add(b' ')
  .add(b'%')
  .add(b'/')
  .add(b'\\')
  .add(b'.')
  .add(b':')
  .add(b'*')
  .add(b'?')
  .add(b'"')
  .add(b'<')
  .add(b'>')
  .add(b'|');

fn encode_path_segment(value: &str) -> String {
  if value.is_empty() {
    "_".to_string()
  } else {
    utf8_percent_encode(value, PATH_SEGMENT_ENCODE_SET).to_string()
  }
}

fn store_path(root: &Path, namespace: &str, key: &str) -> PathBuf {
  root
    .join(encode_path_segment(namespace))
    .join(format!("{}.json", encode_path_segment(key)))
}

pub(crate) fn native_store_get_value(
  root: &Path,
  namespace: &str,
  key: &str,
) -> Result<Option<String>, String> {
  let path = store_path(root, namespace, key);
  match fs::read_to_string(path) {
    Ok(value) => Ok(Some(value)),
    Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(None),
    Err(err) => Err(format!("failed to read native store value: {err}")),
  }
}

pub(crate) fn native_store_set_value(
  root: &Path,
  namespace: &str,
  key: &str,
  value: &str,
) -> Result<(), String> {
  let path = store_path(root, namespace, key);
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)
      .map_err(|err| format!("failed to create native store namespace: {err}"))?;
  }
  fs::write(path, value).map_err(|err| format!("failed to write native store value: {err}"))
}

pub(crate) fn native_store_remove_value(
  root: &Path,
  namespace: &str,
  key: &str,
) -> Result<(), String> {
  let path = store_path(root, namespace, key);
  match fs::remove_file(path) {
    Ok(()) => Ok(()),
    Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(()),
    Err(err) => Err(format!("failed to remove native store value: {err}")),
  }
}

pub(crate) fn native_store_get(
  store: &NativeStore,
  namespace: String,
  key: String,
) -> Result<Option<String>, String> {
  native_store_get_value(&store.root, &namespace, &key)
}

pub(crate) fn native_store_set(
  store: &NativeStore,
  namespace: String,
  key: String,
  value: String,
) -> Result<(), String> {
  native_store_set_value(&store.root, &namespace, &key, &value)
}

pub(crate) fn native_store_remove(
  store: &NativeStore,
  namespace: String,
  key: String,
) -> Result<(), String> {
  native_store_remove_value(&store.root, &namespace, &key)
}

#[taurpc::procedures(path = "db")]
pub trait DbApi {
  async fn native_store_get<R: Runtime>(
    app_handle: AppHandle<R>,
    namespace: String,
    key: String,
  ) -> Result<Option<String>, String>;
  async fn native_store_set<R: Runtime>(
    app_handle: AppHandle<R>,
    namespace: String,
    key: String,
    value: String,
  ) -> Result<(), String>;
  async fn native_store_remove<R: Runtime>(
    app_handle: AppHandle<R>,
    namespace: String,
    key: String,
  ) -> Result<(), String>;
}

#[derive(Clone, Copy)]
pub struct DbApiImpl;

#[taurpc::resolvers]
impl DbApi for DbApiImpl {
  async fn native_store_get<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    namespace: String,
    key: String,
  ) -> Result<Option<String>, String> {
    let state = app_handle.state::<NativeStore>();
    native_store_get(&state, namespace, key)
  }

  async fn native_store_set<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    namespace: String,
    key: String,
    value: String,
  ) -> Result<(), String> {
    let state = app_handle.state::<NativeStore>();
    native_store_set(&state, namespace, key, value)
  }

  async fn native_store_remove<R: Runtime>(
    self,
    app_handle: AppHandle<R>,
    namespace: String,
    key: String,
  ) -> Result<(), String> {
    let state = app_handle.state::<NativeStore>();
    native_store_remove(&state, namespace, key)
  }
}

pub fn rpc_handler<R: Runtime>() -> impl taurpc::TauRpcHandler<R> {
  DbApiImpl.into_handler()
}

#[cfg(test)]
#[path = "../test/src/commands.rs"]
mod tests;
