use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_log::{RotationStrategy, fern::colors::ColoredLevelConfig, log::LevelFilter};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  tauri_plugin_log::Builder::new()
    // .targets([Target::new(TargetKind::Webview)])
    .max_file_size(50_000)
    .level(LevelFilter::Info)
    .rotation_strategy(RotationStrategy::KeepAll)
    .with_colors(ColoredLevelConfig::default())
    .build()
}
