use std::time::Duration;

use log::debug;
use reqwest::Url;

use crate::InitOptions;

#[derive(Debug, Clone)]
pub struct Config {
    pub app_key: String,
    pub ingest_api_url: Url,
    pub flush_interval: Duration,
}

static LOCAL: &str = "http://localhost:3000";
static US_REGION: &str = "https://us.aptabase.com";
static EU_REGION: &str = "https://eu.aptabase.com";

#[cfg(not(debug_assertions))]
static DEFAULT_FLUSH_INTERVAL: Duration = Duration::from_secs(60);

#[cfg(debug_assertions)]
static DEFAULT_FLUSH_INTERVAL: Duration = Duration::from_secs(2);

const VALID_REGIONS: &[&str] = &["US", "EU", "DEV", "SH"];

impl Config {
    pub fn new(app_key: String, opts: InitOptions) -> Self {
        let parts = app_key.split("-").collect::<Vec<&str>>();
        if parts.len() != 3 || !VALID_REGIONS.contains(&parts[1]) {
            debug!(
                "The Aptabase App Key '{}' is invalid. Tracking will be disabled.",
                app_key
            );
            return Config::default();
        }

        let base_url: String = match parts[1] {
            "EU" => EU_REGION.into(),
            "US" => US_REGION.into(),
            "DEV" => LOCAL.into(),
            "SH" => {
                if let Some(host) = opts.host {
                    host
                } else {
                    debug!("Host parameter must be defined when using Self-Hosted App Key. Tracking will be disabled.");
                    return Config::default();
                }
            }
            _ => return Config::default(),
        };

        Self {
            app_key,
            ingest_api_url: format!("{}/api/v0/events", base_url).parse().unwrap(),
            flush_interval: opts.flush_interval.unwrap_or(DEFAULT_FLUSH_INTERVAL),
        }
    }
}

impl Default for Config {
    fn default() -> Self {
        Self {
            app_key: String::new(),
            ingest_api_url: Url::parse(LOCAL).unwrap(),
            flush_interval: DEFAULT_FLUSH_INTERVAL,
        }
    }
}
