use rand::Rng;
use serde_json::{json, Value};
use std::time::{SystemTime, UNIX_EPOCH};
use std::{
    sync::{Arc, Mutex as SyncMutex},
    time::Duration,
};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::{
    config::Config,
    dispatcher::EventDispatcher,
    sys::{self, SystemProperties},
};

static SESSION_TIMEOUT: Duration = Duration::from_secs(4 * 60 * 60);

fn new_session_id() -> String {
    let epoch_in_seconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time went backwards")
        .as_secs();

    let mut rng = rand::rng();
    let random: u64 = rng.random_range(0..=99999999);

    let id = epoch_in_seconds * 100_000_000 + random;

    id.to_string()
}

/// A tracking session.
#[derive(Debug, Clone)]
pub struct TrackingSession {
    pub id: String,
    pub last_touch_ts: OffsetDateTime,
}

impl TrackingSession {
    fn new() -> Self {
        Self {
            id: new_session_id(),
            last_touch_ts: OffsetDateTime::now_utc(),
        }
    }
}

/// The Aptabase client used to track events.
pub struct AptabaseClient {
    is_enabled: bool,
    session: SyncMutex<TrackingSession>,
    dispatcher: Arc<EventDispatcher>,
    app_version: String,
    sys_info: SystemProperties,
}

impl AptabaseClient {
    /// Creates a new Aptabase client.
    pub fn new(config: &Config, app_version: String) -> Self {
        let sys_info = sys::get_info();

        let is_enabled = !config.app_key.is_empty();
        let dispatcher = Arc::new(EventDispatcher::new(config, &sys_info));

        Self {
            is_enabled,
            dispatcher,
            session: SyncMutex::new(TrackingSession::new()),
            app_version,
            sys_info,
        }
    }

    /// Starts the event dispatcher loop.
    pub(crate) fn start_polling(&self, interval: Duration) {
        let dispatcher = self.dispatcher.clone();

        tokio::spawn(async move {
            loop {
                tokio::time::sleep(interval).await;
                dispatcher.flush().await;
            }
        });
    }

    /// Returns the current session ID, creating a new one if necessary.
    pub(crate) fn eval_session_id(&self) -> String {
        let mut session = self.session.lock().expect("could not lock events");

        let now = OffsetDateTime::now_utc();
        if (now - session.last_touch_ts) > SESSION_TIMEOUT {
            *session = TrackingSession::new();
        } else {
            session.last_touch_ts = now;
        }

        session.id.clone()
    }

    /// Enqueues an event to be sent to the server.
    pub fn track_event(&self, name: &str, props: Option<Value>) -> Result<(), String> {
        if !self.is_enabled {
            return Ok(());
        }

        if let Some(props) = &props {
            if !matches!(props, Value::Object(_)) {
                return Err(
                    "props must be `None` or the `Object` variation of `serde_json::Value`"
                        .to_owned(),
                );
            }
        }

        let ev = json!({
            "timestamp": OffsetDateTime::now_utc().format(&Rfc3339).unwrap(),
            "sessionId": self.eval_session_id(),
            "eventName": name,
            "systemProps": {
                "isDebug": self.sys_info.is_debug,
                "osName": self.sys_info.os_name,
                "osVersion": self.sys_info.os_version,
                "locale": self.sys_info.locale,
                "engineName": self.sys_info.engine_name,
                "engineVersion": self.sys_info.engine_version,
                "appVersion": self.app_version,
                "sdkVersion": concat!(env!("CARGO_PKG_NAME"), "@", env!("CARGO_PKG_VERSION"))
            },
            "props": props
        });

        self.dispatcher.enqueue(ev);

        Ok(())
    }

    /// Flushes the event queue.
    pub async fn flush(&self) {
        self.dispatcher.flush().await;
    }

    /// Flushes the event queue, blocking the current thread.
    pub fn flush_blocking(&self) {
        futures::executor::block_on(async {
            self.flush().await;
        });
    }
}
