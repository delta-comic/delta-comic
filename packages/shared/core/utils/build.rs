const COMMANDS: &[&str] = &[
  "webview_auth_data",
  "webview_auth_data_all",
  "webview_auth_data_current",
  "webview_close_current_page",
  "webview_close_page",
  "webview_iframe_auth_data",
  "webview_inject_code",
  "webview_open_page",
];

fn main() {
  tauri_plugin::Builder::new(COMMANDS)
    .android_path("android")
    .build();
}
