#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  let builder = delta_comic_native::builder().plugin(tauri_plugin_m3::init());
  #[cfg(target_os = "android")]
  let builder = builder.plugin(tauri_plugin_webview_upgrade::init());
  builder
    .setup(|app| {
      delta_comic_native::setup(app)?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("failed to build mobile runtime")
    .run(delta_comic_native::on_event);
}
