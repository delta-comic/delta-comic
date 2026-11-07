use http::{HeaderMap, HeaderName, HeaderValue, Method, header};

use crate::Result;

#[inline]
pub fn create_headers(
  raw_headers: &[(String, String)],
  method: Method,
  user_agent: Option<String>,
  data: Option<&[u8]>,
) -> Result<HeaderMap> {
  let mut headers = HeaderMap::with_capacity(raw_headers.len());
  for (h, v) in raw_headers {
    let name = HeaderName::from_bytes(h.as_bytes()).inspect_err(|_| {
      tracing::warn!("Invalid header name from frontend: {}", h);
    })?;
    let value = HeaderValue::from_bytes(v.as_bytes()).inspect_err(|_| {
      tracing::warn!("Invalid header value from frontend: {} = {}", h, v);
    })?;

    headers.append(name, value);
  }

  if data.is_none() && matches!(method, Method::POST | Method::PUT) {
    headers.append(header::CONTENT_LENGTH, HeaderValue::from_static("0"));
  }

  if headers.contains_key(header::RANGE) {
    headers.append(
      header::ACCEPT_ENCODING,
      HeaderValue::from_static("identity"),
    );
  }

  if !headers.contains_key(header::USER_AGENT)
    && let Some(ua) = user_agent
  {
    if let Ok(value) = HeaderValue::from_str(ua.as_str()) {
      headers.append(header::USER_AGENT, value);
    } else {
      tracing::warn!("Invalid User-Agent: {}", ua);
    }
  }

  Ok(headers)
}
