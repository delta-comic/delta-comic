use tauri::webview_version;

#[cfg(target_os = "linux")]
static ENGINE_NAME: &str = "WebKitGTK";

#[cfg(target_os = "android")]
static ENGINE_NAME: &str = "Android System WebView";

#[cfg(any(target_os = "macos", target_os = "ios"))]
static ENGINE_NAME: &str = "WebKit";

#[cfg(target_os = "windows")]
static ENGINE_NAME: &str = "WebView2";

#[cfg(debug_assertions)]
static IS_DEBUG: bool = true;

#[cfg(not(debug_assertions))]
static IS_DEBUG: bool = false;

pub struct SystemProperties {
    pub is_debug: bool,
    pub os_name: String,
    pub os_version: String,
    pub locale: String,
    pub engine_name: String,
    pub engine_version: String,
}

pub fn get_info() -> SystemProperties {
    let info = os_info::get();
    let locale = sys_locale::get_locale().unwrap_or_default();
    let engine_version = webview_version().unwrap_or_default();

    let os_name = match info.os_type() {
        os_info::Type::Macos => "macOS".to_string(),
        os_info::Type::Windows => "Windows".to_string(),
        _ if std::env::var("container").is_ok() => "Flatpak".to_string(),
        _ => info.os_type().to_string(),
    };

    SystemProperties {
        is_debug: IS_DEBUG,
        os_name,
        os_version: info.version().to_string(),
        locale,
        engine_name: ENGINE_NAME.to_string(),
        engine_version,
    }
}
