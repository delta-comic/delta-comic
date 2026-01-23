const COMMANDS: &[&str] = &[
    "fetch",
    "fetch_cancel",
    "fetch_send",
    "fetch_read_body",
    "fetch_cancel_body",
];

fn main() {
    tauri_plugin::Builder::new(COMMANDS)
        .global_api_script_path("./api-iife.js")
        .build();
}
