#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(debug_assertions)]
  delta_comic_native::export_bindings(concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts"))
    .expect("failed to export Tauri command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_http::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../platform/http/src-web/bindings.ts"
  ))
  .expect("failed to export HTTP command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_downloader::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../platform/downloader/lib/bindings.ts"
  ))
  .expect("failed to export downloader command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_logger::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../platform/logger/lib/bindings.ts"
  ))
  .expect("failed to export logger command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_utils::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../core/utils/lib/bindings.ts"
  ))
  .expect("failed to export utils command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_db::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../data/db/lib/bindings.ts"
  ))
  .expect("failed to export db command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_plugin::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../core/plugin/lib/bindings.ts"
  ))
  .expect("failed to export plugin command bindings");
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
