use std::{
  fs,
  io::{Read, Seek},
  path::{Path, PathBuf},
};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use zip::ZipArchive;

const PROGRESS_EVENT: &str = "plugin://install-progress";

#[derive(Serialize)]
pub struct LocalFile {
  bytes: Vec<u8>,
  name: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InstallProgress {
  current: usize,
  op_id: String,
  path: Option<String>,
  phase: &'static str,
  total: usize,
}

fn read_zip(zip_path: &str) -> Result<ZipArchive<fs::File>, String> {
  let file = fs::File::open(zip_path).map_err(|err| format!("failed to read zip: {err}"))?;
  ZipArchive::new(file).map_err(|err| format!("failed to open zip: {err}"))
}

fn decode_zip_meta_value<R: Read + Seek>(zip: &mut ZipArchive<R>) -> Result<Value, String> {
  let mut manifest = zip
    .by_name("manifest.json")
    .map_err(|err| format!("failed to read manifest.json: {err}"))?;
  let mut text = String::new();
  manifest
    .read_to_string(&mut text)
    .map_err(|err| format!("failed to decode manifest.json: {err}"))?;
  serde_json::from_str(&text).map_err(|err| format!("failed to parse manifest.json: {err}"))
}

fn plugin_id(meta: &Value) -> Result<&str, String> {
  let id = meta
    .get("name")
    .and_then(|name| name.get("id"))
    .and_then(Value::as_str)
    .ok_or_else(|| "plugin meta missing name.id".to_string())?;
  if id.is_empty() || id.contains('/') || id.contains('\\') || id == "." || id == ".." {
    return Err(format!("invalid plugin id: {id}"));
  }
  Ok(id)
}

fn plugin_root<R: Runtime>(app: &AppHandle<R>, id: &str) -> Result<PathBuf, String> {
  app
    .path()
    .app_local_data_dir()
    .map(|path| path.join("plugin").join(id))
    .map_err(|err| format!("failed to resolve plugin directory: {err}"))
}

fn emit_progress<R: Runtime>(
  app: &AppHandle<R>,
  op_id: &str,
  phase: &'static str,
  current: usize,
  total: usize,
  path: Option<String>,
) {
  if op_id.is_empty() {
    return;
  }
  let _ = app.emit(
    PROGRESS_EVENT,
    InstallProgress {
      current,
      op_id: op_id.to_string(),
      path,
      phase,
      total,
    },
  );
}

#[tauri::command]
pub fn read_local_file(path: String) -> Result<LocalFile, String> {
  let path = Path::new(&path);
  let name = path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or("us.js")
    .to_string();
  let bytes = fs::read(path).map_err(|err| format!("failed to read local plugin file: {err}"))?;
  Ok(LocalFile { bytes, name })
}

#[tauri::command]
pub fn decode_zip_meta(zip_path: String) -> Result<Value, String> {
  let mut zip = read_zip(&zip_path)?;
  decode_zip_meta_value(&mut zip)
}

#[tauri::command]
pub fn install_zip<R: Runtime>(
  app: AppHandle<R>,
  zip_path: String,
  op_id: String,
) -> Result<Value, String> {
  let mut zip = read_zip(&zip_path)?;
  let meta = decode_zip_meta_value(&mut zip)?;
  let id = plugin_id(&meta)?;
  let root = plugin_root(&app, id)?;

  if root.exists() {
    fs::remove_dir_all(&root)
      .map_err(|err| format!("failed to remove old plugin directory: {err}"))?;
  }
  fs::create_dir_all(&root).map_err(|err| format!("failed to create plugin directory: {err}"))?;

  let total = zip.len();
  emit_progress(&app, &op_id, "start", 0, total, None);

  for index in 0..total {
    let mut file = zip
      .by_index(index)
      .map_err(|err| format!("failed to read zip entry #{index}: {err}"))?;
    let Some(entry_path) = file.enclosed_name() else {
      continue;
    };
    let output_path = root.join(&entry_path);

    if file.is_dir() {
      fs::create_dir_all(&output_path)
        .map_err(|err| format!("failed to create directory {:?}: {err}", entry_path))?;
    } else {
      if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)
          .map_err(|err| format!("failed to create directory {:?}: {err}", parent))?;
      }
      let mut output = fs::File::create(&output_path)
        .map_err(|err| format!("failed to create file {:?}: {err}", entry_path))?;
      std::io::copy(&mut file, &mut output)
        .map_err(|err| format!("failed to write file {:?}: {err}", entry_path))?;
    }

    emit_progress(
      &app,
      &op_id,
      "extract",
      index + 1,
      total,
      Some(entry_path.to_string_lossy().to_string()),
    );
  }

  emit_progress(&app, &op_id, "done", total, total, None);
  Ok(meta)
}
