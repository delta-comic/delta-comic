use tauri::{Runtime, plugin::TauriPlugin};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  let client = sentry::init((
    "https://fc7f04e50b58dbd4ee6d76008c3637eb@o4510714997899264.ingest.us.sentry.io/4510715019067392",
    sentry::ClientOptions {
      release: sentry::release_name!(),
      auto_session_tracking: true,
      ..Default::default()
    },
  ));

  // Caution! Everything before here runs in both app and crash reporter processes
  #[cfg(not(target_os = "ios"))]
  let _guard = tauri_plugin_sentry::minidump::init(&client);

  log::debug!("sentry initialized");

  tauri_plugin_sentry::init_with_no_injection(&client)
}
