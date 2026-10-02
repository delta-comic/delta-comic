use std::{
  collections::BTreeSet,
  sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
  },
};

#[derive(Clone, Debug, Default)]
pub(crate) struct WebviewRegistry {
  inner: Arc<WebviewRegistryInner>,
}

#[derive(Debug, Default)]
struct WebviewRegistryInner {
  labels: Mutex<BTreeSet<String>>,
  next_id: AtomicU64,
}

impl WebviewRegistry {
  pub(crate) fn insert(&self, label: impl Into<String>) {
    self.labels().insert(label.into());
  }

  pub(crate) fn remove(&self, label: &str) {
    self.labels().remove(label);
  }

  pub(crate) fn list(&self) -> Vec<String> {
    self.labels().iter().cloned().collect()
  }

  pub(crate) fn next_label(&self) -> String {
    let id = self.inner.next_id.fetch_add(1, Ordering::Relaxed);
    format!("delta-auth-page-{id}")
  }

  fn labels(&self) -> std::sync::MutexGuard<'_, BTreeSet<String>> {
    self
      .inner
      .labels
      .lock()
      .expect("webview registry mutex poisoned")
  }
}

pub(crate) fn validate_page_label(label: &str) -> Result<(), String> {
  if label.trim().is_empty() {
    return Err("page label cannot be empty".to_string());
  }
  if label.chars().any(|ch| ch.is_control()) {
    return Err(format!("page label contains control characters: {label:?}"));
  }
  if label.contains('/') || label.contains('\\') {
    return Err(format!(
      "page label cannot contain path separators: {label}"
    ));
  }
  Ok(())
}

#[cfg(test)]
#[path = "../test/src/webview_registry.rs"]
mod tests;
