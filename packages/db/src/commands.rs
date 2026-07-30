use std::{
  fs, io,
  path::{Path, PathBuf},
};

use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};
use tauri::State;

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

#[tauri::command]
pub(crate) fn native_store_get(
  store: State<'_, NativeStore>,
  namespace: String,
  key: String,
) -> Result<Option<String>, String> {
  native_store_get_value(&store.root, &namespace, &key)
}

#[tauri::command]
pub(crate) fn native_store_set(
  store: State<'_, NativeStore>,
  namespace: String,
  key: String,
  value: String,
) -> Result<(), String> {
  native_store_set_value(&store.root, &namespace, &key, &value)
}

#[tauri::command]
pub(crate) fn native_store_remove(
  store: State<'_, NativeStore>,
  namespace: String,
  key: String,
) -> Result<(), String> {
  native_store_remove_value(&store.root, &namespace, &key)
}

#[cfg(test)]
#[path = "../test/src/commands.rs"]
mod tests;
