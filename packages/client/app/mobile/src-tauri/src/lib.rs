#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(debug_assertions)]
  delta_comic_native::specta_builder()
    .export(
      specta_typescript::Typescript::default(),
      concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts"),
    )
    .expect("failed to export Tauri command bindings");
  #[cfg(debug_assertions)]
  tauri_plugin_http::export_bindings(concat!(
    env!("CARGO_MANIFEST_DIR"),
    "/../../../platform/http/src-web/bindings.ts"
  ))
  .expect("failed to export HTTP command bindings");
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
