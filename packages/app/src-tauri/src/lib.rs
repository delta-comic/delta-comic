use tauri_plugin_aptabase::EventTracker;

#[cfg(desktop)]
use tauri::{
  Manager,
  menu::{Menu, MenuItem},
  tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
};
use tauri_plugin_downloader::DownloaderExt;

#[cfg(desktop)]
fn show_main_window(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.show();
    let _ = window.set_focus();
  }
}

#[cfg(desktop)]
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

#[tokio::main]
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub async fn run() {
  log::debug!("app started");

  let builder = tauri_plugin_utils::init(tauri::Builder::default().plugin(tauri_plugin_fs::init()));
  let builder = builder
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_m3::init())
    .plugin(tauri_plugin_better_cors_fetch::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_plugin::init())
    .plugin(tauri_plugin_aptabase::Builder::new("A-US-9793062880").build());
  let builder = builder.plugin(tauri_plugin_downloader::init());
  let builder = tauri_plugin_db::init(builder).setup(|app| {
    let logo = r#"
_____   _________________ ____        __________________ _____   ______
|  __ \|  ____|| |__   __| __ \      / ______\   |  \/  |_   _| / _____\
| |  | | |__   | |  | |  | | \ \    | |    _____ | \  / | | |  | /
| |  | |  __|  | |  | |  | |__\ \   | |   /  _  \| |\/| | | |  | |
| |__| | |____ | |__| |  |  ___\ \  | |___| |_| || |  | |_| |_ | \_____
|_____/|______||______|  |_|    \_\  \__________/|_|  \_______| \______/
=========================================================================
  Per aspera Ad astra                                Copyright © Wenxig
"#;

    log::error!("{}", logo);
    #[cfg(desktop)]
    setup_download_tray(app)?;
    Ok(())
  });

  #[cfg(desktop)]
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

  match builder.build(tauri::generate_context!()) {
    Ok(builder) => builder.run(|handler, event| match event {
      tauri::RunEvent::Exit => {
        if let Err(error) = tauri::async_runtime::block_on(handler.downloader().shutdown()) {
          log::error!("failed to stop downloader cleanly: {error}");
        }
        let _ = handler.track_event("app_exited", None);
        handler.flush_events_blocking();
      }
      tauri::RunEvent::Ready => {
        let _ = handler.track_event("app_started", None);
      }
      _ => {}
    }),
    Err(err) => log::error!("error while running tauri application: {}", err),
  }

  log::debug!("app exited");
}
