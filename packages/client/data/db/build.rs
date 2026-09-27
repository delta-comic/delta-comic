const COMMANDS: &[&str] = &[
  "native_store_get",
  "native_store_remove",
  "native_store_set",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS).build();
}
