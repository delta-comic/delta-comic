use std::fs;

use crate::commands::{self, LoggerApi};

#[test]
fn export_bindings() -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("lib/bindings.ts");
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-logger-bindings-{}",
    std::process::id()
  ));
  taurpc::Exporter::new().export(&commands::LoggerApiImpl.into_handler(), &temp_path)?;
  let generated = fs::read(&temp_path)?;
  let mut generated = String::from_utf8(generated)
    .map(|value| value.replace(", type UnlistenFn", ""))?
    .into_bytes();
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
