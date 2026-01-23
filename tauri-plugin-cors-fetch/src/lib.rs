// Copyright 2019-2023 Tauri Programme within The Commons Conservancy
// SPDX-License-Identifier: Apache-2.0
// SPDX-License-Identifier: MIT

//! ![tauri-plugin-cors-fetch](https://github.com/idootop/tauri-plugin-cors-fetch/raw/main/banner.png)
//!
//! Enabling Cross-Origin Resource Sharing (CORS) for Fetch Requests within Tauri applications.

pub use reqwest;
use tauri::{
    plugin::{Builder, TauriPlugin},
    Manager, Runtime,
};

pub use error::{Error, Result};
mod commands;
#[cfg(feature = "cookies")]
mod cookies;
mod error;

#[cfg(feature = "cookies")]
const COOKIES_FILENAME: &str = ".cookies";

pub(crate) struct Http {
    #[cfg(feature = "cookies")]
    cookies_jar: std::sync::Arc<crate::cookies::CookieStoreMutex>,
}

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::<R>::new("cors-fetch")
        .setup(|app, _| {
            #[cfg(feature = "cookies")]
            {
                let cookies_jar = {
                    use crate::cookies::*;
                    use std::fs::File;
                    use std::io::BufReader;

                    let cache_dir = app.path().app_cache_dir()?;
                    std::fs::create_dir_all(&cache_dir)?;

                    let path = cache_dir.join(COOKIES_FILENAME);
                    let file = File::options()
                        .create(true)
                        .append(true)
                        .read(true)
                        .open(&path)?;

                    let reader = BufReader::new(file);
                    CookieStoreMutex::load(path.clone(), reader)
                        .unwrap_or_else(|_e| CookieStoreMutex::new(path, Default::default()))
                };

                let state = Http {
                    cookies_jar: std::sync::Arc::new(cookies_jar),
                };

                app.manage(state);
            }

            Ok(())
        })
        .on_event(|app, event| {
            #[cfg(feature = "cookies")]
            {
                if let tauri::RunEvent::Exit = event {
                    let state = app.state::<Http>();

                    match state.cookies_jar.request_save() {
                        Ok(rx) => {
                            let _ = rx.recv();
                        }
                        Err(_e) => {
                            #[cfg(feature = "tracing")]
                            tracing::error!("failed to save cookie jar: {_e}");
                        }
                    }
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::fetch,
            commands::fetch_cancel,
            commands::fetch_send,
            commands::fetch_read_body,
            commands::fetch_cancel_body,
        ])
        .build()
}
