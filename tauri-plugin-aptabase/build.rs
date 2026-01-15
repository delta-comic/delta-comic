const COMMANDS: &[&str] = &["track_event"];

fn main() {
    tauri_plugin::Builder::new(COMMANDS).build();
}
