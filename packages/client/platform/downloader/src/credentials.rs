use std::sync::{Arc, Mutex, PoisonError};

use keyring_core::{CredentialStore, Entry, api::CredentialStoreApi};
use uuid::Uuid;

use crate::{Error, Result, SecretResolver};

const CREDENTIAL_PREFIX: &str = "credential:";
const CREDENTIAL_SERVICE: &str = "org.wenxig.delta-comic.downloader";
// Windows Credential Manager limits generic credential blobs to 2560 bytes. Keeping a small
// margin gives every supported platform the same predictable contract.
const MAX_SECRET_BYTES: usize = 2400;

#[derive(Clone)]
pub(crate) struct CredentialVault {
  /// `None` on platforms without a supported native credential store.
  store: Option<Arc<CredentialStore>>,
  // Some native stores do not reliably order operations on the same entry across threads.
  gate: Arc<Mutex<()>>,
}

impl std::fmt::Debug for CredentialVault {
  fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    formatter.write_str("CredentialVault([native store])")
  }
}

impl CredentialVault {
  pub(crate) fn system() -> Result<Self> {
    #[cfg(target_os = "macos")]
    {
      apple_native_keyring_store::keychain::Store::new()
        .map(Self::from_keyring_store)
        .map_err(|_| credential_error("initialize the macOS Keychain"))
    }
    #[cfg(target_os = "windows")]
    {
      windows_native_keyring_store::Store::new()
        .map(Self::from_keyring_store)
        .map_err(|_| credential_error("initialize Windows Credential Manager"))
    }
    #[cfg(target_os = "android")]
    {
      let configuration = std::collections::HashMap::from([("name", "delta-comic-downloader")]);
      android_native_keyring_store::Store::new_with_configuration(&configuration)
        .map(Self::from_keyring_store)
        .map_err(|_| credential_error("initialize the Android Keystore"))
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "android")))]
    {
      Ok(Self {
        store: None,
        gate: Arc::default(),
      })
    }
  }

  #[cfg_attr(
    not(any(
      test,
      target_os = "macos",
      target_os = "windows",
      target_os = "android"
    )),
    allow(dead_code)
  )]
  fn from_keyring_store<S>(store: Arc<S>) -> Self
  where
    S: CredentialStoreApi + Send + Sync + 'static,
  {
    Self {
      store: Some(store),
      gate: Arc::default(),
    }
  }

  fn entry(&self, id: &str, operation: &str) -> Result<Entry> {
    self
      .store
      .as_ref()
      .ok_or_else(|| credential_error(&format!("{operation} on this platform")))?
      .build(CREDENTIAL_SERVICE, id, None)
      .map_err(|_| credential_error("open an entry"))
  }

  pub(crate) fn store(&self, value: &str) -> Result<String> {
    if value.is_empty() {
      return Err(Error::InvalidInput("secret value must not be empty".into()));
    }
    if value.len() > MAX_SECRET_BYTES {
      return Err(Error::InvalidInput(format!(
        "secret value exceeds the cross-platform {MAX_SECRET_BYTES} byte limit"
      )));
    }
    let id = Uuid::new_v4().to_string();
    let entry = self.entry(&id, "store a secret")?;
    let _guard = self.gate.lock().unwrap_or_else(PoisonError::into_inner);
    entry
      .set_password(value)
      .map_err(|_| credential_error("store a secret"))?;
    Ok(format!("{CREDENTIAL_PREFIX}{id}"))
  }

  pub(crate) fn delete(&self, secret_ref: &str) -> Result<()> {
    let entry = self.entry(&credential_id(secret_ref)?, "delete a secret")?;
    let _guard = self.gate.lock().unwrap_or_else(PoisonError::into_inner);
    match entry.delete_credential() {
      Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
      Err(_) => Err(credential_error("delete a secret")),
    }
  }
}

impl SecretResolver for CredentialVault {
  fn resolve(&self, secret_ref: &str) -> Result<Option<String>> {
    let entry = self.entry(&credential_id(secret_ref)?, "read a secret")?;
    let _guard = self.gate.lock().unwrap_or_else(PoisonError::into_inner);
    match entry.get_password() {
      Ok(value) => Ok(Some(value)),
      Err(keyring_core::Error::NoEntry) => Ok(None),
      Err(_) => Err(credential_error("read a secret")),
    }
  }
}

/// Resolves native credential references; any other reference is reported as unresolved.
struct NativeSecretResolver(CredentialVault);

impl SecretResolver for NativeSecretResolver {
  fn resolve(&self, secret_ref: &str) -> Result<Option<String>> {
    if secret_ref.starts_with(CREDENTIAL_PREFIX) {
      self.0.resolve(secret_ref)
    } else {
      Ok(None)
    }
  }
}

pub(crate) fn resolver(credentials: CredentialVault) -> Arc<dyn SecretResolver> {
  Arc::new(NativeSecretResolver(credentials))
}

fn credential_id(secret_ref: &str) -> Result<String> {
  let raw = secret_ref
    .strip_prefix(CREDENTIAL_PREFIX)
    .ok_or_else(|| Error::InvalidInput("secretRef is not a native credential reference".into()))?;
  let id = Uuid::parse_str(raw)
    .map_err(|_| Error::InvalidInput("secretRef contains an invalid credential ID".into()))?;
  let canonical = id.to_string();
  if raw != canonical {
    return Err(Error::InvalidInput(
      "secretRef credential ID is not canonical".into(),
    ));
  }
  Ok(canonical)
}

fn credential_error(operation: &str) -> Error {
  // Native errors are deliberately not forwarded: platform diagnostics may contain account or
  // service metadata, and credentials must never enter IPC errors or ordinary logs.
  Error::CredentialStore(format!("native credential store could not {operation}"))
}

#[cfg(test)]
#[path = "../test/src/credentials.rs"]
mod tests;
