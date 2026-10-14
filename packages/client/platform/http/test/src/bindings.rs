use std::fs;

use crate::rpc_handler;

#[test]
fn export_bindings() -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src-web/bindings.ts");
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-http-bindings-{}.ts",
    std::process::id()
  ));

  let _runtime_guard = tauri::async_runtime::handle().inner().enter();
  let router = taurpc::Router::new().merge(rpc_handler::<tauri::Wry>());
  taurpc::Exporter::new().export(&router, &temp_path)?;
  let generated_text = String::from_utf8(fs::read(&temp_path)?)?;
  let mut generated = generated_text.replace(", type UnlistenFn", "").into_bytes();
  while generated.ends_with(b"\n\n") {
    generated.pop();
  }
  let current = fs::read(&path).unwrap_or_default();
  if generated != current {
    fs::write(&path, generated)?;
  }
  let _ = fs::remove_file(temp_path);

  Ok(())
}
