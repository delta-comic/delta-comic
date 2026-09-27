use tauri_plugin_aptabase::EventTracker;
use tauri_specta::{Builder, collect_commands};

#[tauri::command]
#[specta::specta]
fn get_runtime_platform() -> String {
  if cfg!(target_os = "android") {
    "android".to_string()
  } else if cfg!(target_os = "ios") {
    "ios".to_string()
  } else if cfg!(target_os = "windows") {
    "windows".to_string()
  } else if cfg!(target_os = "macos") {
    "macos".to_string()
  } else if cfg!(target_os = "linux") {
    "linux".to_string()
  } else {
    "unknown".to_string()
  }
}

fn specta_builder() -> Builder<tauri::Wry> {
  Builder::<tauri::Wry>::new().commands(collect_commands![get_runtime_platform])
}

#[cfg(desktop)]
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  #[cfg(target_os = "macos")]
  disable_automatic_capitalization();

  let specta_builder = specta_builder();
  #[cfg(debug_assertions)]
  specta_builder
    .export(
      specta_typescript::Typescript::default(),
      concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts"),
    )
    .expect("failed to export Tauri command bindings");

  let builder = tauri_plugin_utils::init(
    tauri::Builder::default()
      .invoke_handler(specta_builder.invoke_handler())
      .plugin(tauri_plugin_logger::init())
      .plugin(tauri_plugin_fs::init()),
  );
  #[cfg(target_os = "android")]
  let builder = builder.plugin(tauri_plugin_webview_upgrade::init());
  let builder = builder
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_m3::init())
    .plugin(tauri_plugin_better_cors_fetch::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_persisted_scope::init())
    .plugin(tauri_plugin_plugin::init())
    .plugin(tauri_plugin_downloader::init());
  let builder = tauri_plugin_db::init(builder).setup(|app| {
    let handle = app.handle().clone();
    tauri::async_runtime::block_on(async move {
      handle.plugin(tauri_plugin_aptabase::Builder::new("A-US-9793062880").build())
    })?;

    tracing::info!(target: "app::lifecycle", "application bootstrap started");
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

    tracing::info!(target: "app::lifecycle", "{logo}");
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
        tracing::info!(target: "app::lifecycle", "application shutdown started");
        if let Err(error) = tauri::async_runtime::block_on(handler.downloader().shutdown()) {
          tracing::error!(target: "app::downloader", %error, "failed to stop downloader cleanly");
        }
        let _ = handler.track_event("app_exited", None);
        handler.flush_events_blocking();
      }
      tauri::RunEvent::Ready => {
        tracing::info!(target: "app::lifecycle", "application runtime ready");
        let _ = handler.track_event("app_started", None);
      }
      _ => {}
    }),
    Err(error) => {
      tracing::error!(target: "app::lifecycle", %error, "tauri runtime failed");
    }
  }

  tracing::info!(target: "app::lifecycle", "application exited");
}

#[cfg(test)]
mod tests {
  use super::specta_builder;

  #[test]
  fn exports_tauri_command_bindings() {
    specta_builder()
      .export(
        specta_typescript::Typescript::default(),
        concat!(env!("CARGO_MANIFEST_DIR"), "/../src/bindings.ts"),
      )
      .expect("failed to export Tauri command bindings");
  }
}
