use tauri::{Runtime, plugin::TauriPlugin};
use tauri_plugin_log::{RotationStrategy, fern::colors::ColoredLevelConfig, log::LevelFilter};

pub fn init<R: Runtime>() -> TauriPlugin<R> {
  tauri_plugin_log::Builder::new()
    .target(tauri_plugin_log::Target::new(
      tauri_plugin_log::TargetKind::LogDir {
        file_name: Some("logs".to_string()),
        
      },
    ))
    .max_file_size(50_000)
    .level(LevelFilter::Info)
    .rotation_strategy(RotationStrategy::KeepAll)
    .with_colors(ColoredLevelConfig::default())
    .build()
}
