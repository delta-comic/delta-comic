use std::fs;

use crate::commands::{self, PluginApi};

#[test]
fn export_bindings() -> std::result::Result<(), Box<dyn std::error::Error>> {
  let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("lib/bindings.ts");
  let temp_path = std::env::temp_dir().join(format!(
    "delta-comic-plugin-bindings-{}",
    std::process::id()
  ));
  taurpc::Exporter::new().export(&commands::PluginApiImpl.into_handler(), &temp_path)?;
  let mut generated = fs::read(&temp_path)?;
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
