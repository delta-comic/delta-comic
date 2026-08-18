const COMMANDS: &[&str] = &["decode_zip_meta", "install_zip", "read_local_file"];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
