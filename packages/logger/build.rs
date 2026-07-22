const COMMANDS: &[&str] = &[
  "write_logs",
  "list_log_files",
  "read_log_file",
  "export_logs",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
