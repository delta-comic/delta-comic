use std::{
    cmp::min,
    collections::VecDeque,
    sync::{Arc, RwLock},
    time::Duration,
};

use log::{debug, trace};
use reqwest::{
    header::{HeaderMap, HeaderValue},
    Url,
};
use serde_json::{json, Value};

use crate::{config::Config, sys::SystemProperties};

static HTTP_REQUEST_TIMEOUT: Duration = Duration::from_secs(10);

pub(crate) struct EventDispatcher {
    url: Url,
    queue: Arc<RwLock<VecDeque<Value>>>,
    http_client: reqwest::Client,
}

impl EventDispatcher {
    pub fn new(config: &Config, sys: &SystemProperties) -> Self {
        let mut headers = HeaderMap::new();
        let app_key_header = HeaderValue::from_str(config.app_key.as_str())
            .expect("failed to define App Key header value");
        headers.insert("App-Key", app_key_header);
        headers.insert("Content-Type", HeaderValue::from_static("application/json"));

        let user_agent = format!(
            "{}/{} {}/{} {}",
            sys.os_name, sys.os_version, sys.engine_name, sys.engine_version, sys.locale
        );
        let http_client = reqwest::Client::builder()
            .timeout(HTTP_REQUEST_TIMEOUT)
            .default_headers(headers)
            .user_agent(user_agent)
            .build()
            .expect("could not build http client");

        let queue = Arc::new(RwLock::new(VecDeque::new()));

        Self {
            url: config.ingest_api_url.clone(),
            queue,
            http_client,
        }
    }

    pub fn is_empty(&self) -> bool {
        let queue = self.queue.read().expect("could not lock queue for reading");
        queue.is_empty()
    }

    pub fn enqueue(&self, event: Value) {
        let mut queue = self.queue.write().expect("could not lock queue");
        queue.push_back(event);
    }

    pub fn enqueue_many(&self, events: Vec<Value>) {
        let mut queue = self.queue.write().expect("could not lock queue");
        queue.extend(events);
    }

    fn dequeue_many(&self, max: usize) -> Vec<Value> {
        let mut queue = self.queue.write().expect("could not lock queue");
        if queue.is_empty() {
            return Vec::new();
        }

        let dequeue_len = min(queue.len(), max);
        queue.drain(..dequeue_len).collect()
    }

    pub async fn flush(&self) {
        trace!("flushing tracking events");
        if self.is_empty() {
            trace!("nothing to send");
            return;
        }

        let mut failed_items = Vec::new();
        loop {
            let events_to_send = self.dequeue_many(25);
            if events_to_send.is_empty() {
                break;
            }

            trace!("preparing {} events to send", events_to_send.len());

            let body = json!(events_to_send);
            let response = self
                .http_client
                .post(self.url.clone())
                .json(&body)
                .send()
                .await;
            match response {
                Ok(response) => match response.status().is_success() {
                    true => {
                        trace!("sent {} tracking events", events_to_send.len());
                    }
                    false => {
                        debug!(
                            "failed to track_event with status code {}",
                            response.status()
                        );
                        if response.status().is_server_error() {
                            failed_items.extend(events_to_send);
                        }
                    }
                },
                Err(err) => {
                    failed_items.extend(events_to_send);
                    debug!("failed to track_event: {}", err.to_string());
                }
            }
        }

        self.enqueue_many(failed_items);
    }
}
