#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri::{
  Manager,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
#[cfg(not(any(target_os = "android", target_os = "ios")))]
use tauri_plugin_downloader::DownloaderExt;

#[cfg(target_os = "macos")]
fn disable_automatic_capitalization() {
  use objc2_foundation::{NSUserDefaults, ns_string};

  NSUserDefaults::standardUserDefaults()
    .setBool_forKey(false, ns_string!("NSAutomaticCapitalizationEnabled"));
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
fn show_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

#[cfg(not(any(target_os = "android", target_os = "ios")))]
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

#[allow(clippy::large_unopt_stack_frames)]
pub fn run() {
  #[cfg(target_os = "macos")]
  disable_automatic_capitalization();

  #[cfg(any(target_os = "android", target_os = "ios"))]
  let builder = delta_comic_native::builder().plugin(tauri_plugin_m3::init());
  #[cfg(target_os = "android")]
  let builder = builder.plugin(tauri_plugin_webview_upgrade::init());
  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  let builder = delta_comic_native::builder();

  #[cfg(not(any(target_os = "android", target_os = "ios")))]
  let builder = builder.on_window_event(|window, event| {
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
  });

  builder
    .setup(|app| {
      delta_comic_native::setup(app)?;
      #[cfg(not(any(target_os = "android", target_os = "ios")))]
      setup_download_tray(app)?;
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("failed to build Delta Comic runtime")
    .run(delta_comic_native::on_event);
}
