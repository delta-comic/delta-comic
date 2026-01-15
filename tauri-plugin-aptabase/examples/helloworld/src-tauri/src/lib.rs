use serde_json::json;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn this_will_panic() {
  panic!("I told you!");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![greet, this_will_panic])
        .plugin(tauri_plugin_aptabase::Builder::new("A-US-0928558097").with_panic_hook(Box::new(|client, info, msg| {
            let location = info.location().map(|loc| format!("{}:{}:{}", loc.file(), loc.line(), loc.column())).unwrap_or_else(|| "".to_string());

            client.track_event("panic", Some(json!({
                "info": format!("{} ({})", msg, location),
            })));
        })).build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
