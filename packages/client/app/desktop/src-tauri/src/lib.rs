use tauri::{
  Manager,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_downloader::DownloaderExt;

#[cfg(target_os = "macos")]
fn disable_automatic_capitalization() {
  use objc2_foundation::{NSUserDefaults, ns_string};

  NSUserDefaults::standardUserDefaults()
    .setBool_forKey(false, ns_string!("NSAutomaticCapitalizationEnabled"));
}

fn show_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

fn setup_download_tray(app: &mut tauri::App) -> tauri::Result<()> {
  let show = MenuItem::with_id(app, "show", "Show Delta Comic", true, None::<&str>)?;
  let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
  let menu = Menu::with_items(app, &[&show, &quit])?;
  let mut tray = TrayIconBuilder::with_id("downloads")
    .tooltip("Delta Comic")
    .menu(&menu)
    .show_menu_on_left_click(false)
    .on_menu_event(|app, event| match event.id().as_ref() {
      "show" => show_main_window(app),
      "quit" => app.exit(0),
      _ => {}
    })
    .on_tray_icon_event(|tray, event| {
      if matches!(
        event,
        TrayIconEvent::Click {
          button: MouseButton::Left,
          button_state: MouseButtonState::Up,
          ..
        }
      ) {
        show_main_window(tray.app_handle());
      }
    });
  if let Some(icon) = app.default_window_icon() {
    tray = tray.icon(icon.clone());
  }
  tray.build(app)?;
  Ok(())
}

pub fn run() {
  #[cfg(target_os = "macos")]
  disable_automatic_capitalization();
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
  delta_comic_native::builder()
    .setup(|app| {
      delta_comic_native::setup(app)?;
      setup_download_tray(app)?;
      Ok(())
    })
    .on_window_event(|window, event| {
      if window.label() != "main" {
        return;
      }
      if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        let keep_running =
          tauri::async_runtime::block_on(window.app_handle().downloader().has_active_tasks())
            .unwrap_or(false);
        if keep_running {
          api.prevent_close();
          let _ = window.hide();
        }
      }
    })
    .build(tauri::generate_context!())
    .expect("failed to build desktop runtime")
    .run(delta_comic_native::on_event);
}
