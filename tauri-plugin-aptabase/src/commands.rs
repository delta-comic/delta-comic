use serde_json::Value;
use std::sync::Arc;
use tauri::{command, State};

use crate::client::AptabaseClient;

#[command]
pub fn track_event(
    client: State<'_, Arc<AptabaseClient>>,
    name: &str,
    props: Option<Value>,
) -> Result<(), String> {
    client.track_event(name, props)
}
