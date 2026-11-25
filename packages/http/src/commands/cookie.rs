use crate::{GlobalState, InstanceKey};
use reqwest::cookie::CookieStore;
use serde::{Deserialize, Serialize};
use specta::Type;
#[warn(unused_imports)]
use tracing::warn;

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SetCookieConfig {
  #[specta(type = String)]
  url: url::Url,
  content: String,
  instance_key: InstanceKey,
}

pub async fn set_cookie(state: &GlobalState, config: SetCookieConfig) -> crate::Result<()> {
  let mut header_value = reqwest::header::HeaderValue::from_str(&config.content)?;
  header_value.set_sensitive(true);
  let mut header_values = std::iter::once(&header_value);
  state
    .cookies_jar
    .get(&config.instance_key)
    .expect("failed to get cookies jar for instance key")
    .set_cookies(&mut header_values, &config.url);
  Ok(())
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GetCookieConfig {
  #[specta(type = String)]
  url: url::Url,
  name: String,
  instance_key: InstanceKey,
}

pub async fn get_cookie(
  state: &GlobalState,
  config: GetCookieConfig,
) -> crate::Result<Option<String>> {
  Ok(
    state
      .cookies_jar
      .get(&config.instance_key)
      .expect("failed to get cookies jar for instance key")
      .get_cookie_value(&config.url, &config.name),
  )
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GetAllDomainCookiesConfig {
  #[specta(type = String)]
  url: url::Url,
  instance_key: InstanceKey,
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CookieEntry {
  domain: String,
  name: String,
  value: String,
}

pub async fn get_all_domain_cookies(
  state: &GlobalState,
  config: GetAllDomainCookiesConfig,
) -> crate::Result<Vec<CookieEntry>> {
  let cookies = state
    .cookies_jar
    .get(&config.instance_key)
    .expect("failed to get cookies jar for instance key")
    .get_all_domain_cookie_values(&config.url);
  Ok(
    cookies
      .into_iter()
      .map(|(domain, name, value)| CookieEntry {
        domain,
        name,
        value,
      })
      .collect(),
  )
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GetAllCookiesConfig {
  instance_key: String,
}

pub async fn get_all_cookies(
  state: &GlobalState,
  config: GetAllCookiesConfig,
) -> crate::Result<Vec<CookieEntry>> {
  let cookies = state
    .cookies_jar
    .get(&config.instance_key)
    .expect("failed to get cookies jar for instance key")
    .get_all_cookie_values();
  Ok(
    cookies
      .into_iter()
      .map(|(domain, name, value)| CookieEntry {
        domain,
        name,
        value,
      })
      .collect(),
  )
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DeleteCookieConfig {
  #[specta(type = String)]
  url: url::Url,
  path: Option<String>,
  name: String,
  instance_key: String,
}

pub async fn delete_cookie(state: &GlobalState, config: DeleteCookieConfig) -> crate::Result<bool> {
  Ok(
    state
      .cookies_jar
      .get(&config.instance_key)
      .expect("failed to get cookies jar for instance key")
      .delete_cookie(
        &config.url,
        &config.path.unwrap_or("/".to_string()),
        &config.name,
      )?,
  )
}

#[derive(Debug, Deserialize, Serialize, Type, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ClearCookiesConfig {
  instance_key: String,
}

pub async fn clear_cookie(state: &GlobalState, config: ClearCookiesConfig) -> crate::Result<()> {
  Ok(
    state
      .cookies_jar
      .get(&config.instance_key)
      .expect("failed to get cookies jar for instance key")
      .clear_cookie()?,
  )
}
