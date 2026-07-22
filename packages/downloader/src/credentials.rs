use std::sync::Arc;

#[cfg(any(
  test,
  target_os = "macos",
  target_os = "windows",
  target_os = "android"
))]
use keyring_core::{CredentialStore, api::CredentialStoreApi};
#[cfg(any(
  test,
  target_os = "macos",
  target_os = "windows",
  target_os = "android"
))]
use std::sync::Mutex;
use uuid::Uuid;

use crate::{Error, Result, SecretResolver};

const CREDENTIAL_PREFIX: &str = "credential:";
const CREDENTIAL_SERVICE: &str = "org.wenxig.delta-comic.downloader";
// Windows Credential Manager limits generic credential blobs to 2560 bytes. Keeping a small
// margin gives every supported platform the same predictable contract.
const MAX_SECRET_BYTES: usize = 2400;

trait CredentialBackend: Send + Sync + 'static {
  fn set(&self, id: &str, value: &str) -> Result<()>;
  fn get(&self, id: &str) -> Result<Option<String>>;
  fn delete(&self, id: &str) -> Result<()>;
}

#[cfg(any(
  test,
  target_os = "macos",
  target_os = "windows",
  target_os = "android"
))]
struct KeyringBackend {
  store: Arc<CredentialStore>,
  // Some native stores do not reliably order operations on the same entry across threads.
  gate: Mutex<()>,
}

#[cfg(any(
  test,
  target_os = "macos",
  target_os = "windows",
  target_os = "android"
))]
impl KeyringBackend {
  fn entry(&self, id: &str) -> Result<keyring_core::Entry> {
    self
      .store
      .build(CREDENTIAL_SERVICE, id, None)
      .map_err(|_| credential_error("open an entry"))
  }
}

#[cfg(any(
  test,
  target_os = "macos",
  target_os = "windows",
  target_os = "android"
))]
impl CredentialBackend for KeyringBackend {
  fn set(&self, id: &str, value: &str) -> Result<()> {
    let _guard = self
      .gate
      .lock()
      .unwrap_or_else(std::sync::PoisonError::into_inner);
    self
      .entry(id)?
      .set_password(value)
      .map_err(|_| credential_error("store a secret"))
  }

  fn get(&self, id: &str) -> Result<Option<String>> {
    let _guard = self
      .gate
      .lock()
      .unwrap_or_else(std::sync::PoisonError::into_inner);
    match self.entry(id)?.get_password() {
      Ok(value) => Ok(Some(value)),
      Err(keyring_core::Error::NoEntry) => Ok(None),
      Err(_) => Err(credential_error("read a secret")),
    }
  }

  fn delete(&self, id: &str) -> Result<()> {
    let _guard = self
      .gate
      .lock()
      .unwrap_or_else(std::sync::PoisonError::into_inner);
    match self.entry(id)?.delete_credential() {
      Ok(()) | Err(keyring_core::Error::NoEntry) => Ok(()),
      Err(_) => Err(credential_error("delete a secret")),
    }
  }
}

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "android")))]
struct UnsupportedBackend;

#[cfg(not(any(target_os = "macos", target_os = "windows", target_os = "android")))]
impl CredentialBackend for UnsupportedBackend {
  fn set(&self, _id: &str, _value: &str) -> Result<()> {
    Err(credential_error("store a secret on this platform"))
  }

  fn get(&self, _id: &str) -> Result<Option<String>> {
    Err(credential_error("read a secret on this platform"))
  }

  fn delete(&self, _id: &str) -> Result<()> {
    Err(credential_error("delete a secret on this platform"))
  }
}

#[derive(Clone)]
pub(crate) struct CredentialVault {
  backend: Arc<dyn CredentialBackend>,
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
        backend: Arc::new(UnsupportedBackend),
      })
    }
  }

  #[cfg(any(
    test,
    target_os = "macos",
    target_os = "windows",
    target_os = "android"
  ))]
  fn from_keyring_store<S>(store: Arc<S>) -> Self
  where
    S: CredentialStoreApi + Send + Sync + 'static,
  {
    let store: Arc<CredentialStore> = store;
    Self {
      backend: Arc::new(KeyringBackend {
        store,
        gate: Mutex::new(()),
      }),
    }
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
    self.backend.set(&id, value)?;
    Ok(format!("{CREDENTIAL_PREFIX}{id}"))
  }

  pub(crate) fn delete(&self, secret_ref: &str) -> Result<()> {
    self.backend.delete(&credential_id(secret_ref)?)
  }
}

impl SecretResolver for CredentialVault {
  fn resolve(&self, secret_ref: &str) -> Result<Option<String>> {
    self.backend.get(&credential_id(secret_ref)?)
  }
}

struct ChainedSecretResolver {
  credentials: CredentialVault,
  custom: Option<Arc<dyn SecretResolver>>,
}

impl SecretResolver for ChainedSecretResolver {
  fn resolve(&self, secret_ref: &str) -> Result<Option<String>> {
    if secret_ref.starts_with(CREDENTIAL_PREFIX) {
      return self.credentials.resolve(secret_ref);
    }
    match &self.custom {
      Some(custom) => custom.resolve(secret_ref),
      None => Ok(None),
    }
  }
}

pub(crate) fn resolver(
  credentials: CredentialVault,
  custom: Option<Arc<dyn SecretResolver>>,
) -> Arc<dyn SecretResolver> {
  Arc::new(ChainedSecretResolver {
    credentials,
    custom,
  })
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
mod tests {
  use super::*;

  struct CustomResolver;

  impl SecretResolver for CustomResolver {
    fn resolve(&self, secret_ref: &str) -> Result<Option<String>> {
      Ok(Some(format!("custom:{secret_ref}")))
    }
  }

  fn vault() -> CredentialVault {
    CredentialVault::from_keyring_store(keyring_core::mock::Store::new().unwrap())
  }

  #[test]
  fn creates_unforgeable_canonical_references_and_deletes_idempotently() {
    let vault = vault();
    let reference = vault.store("Bearer private-token").unwrap();

    assert!(reference.starts_with(CREDENTIAL_PREFIX));
    assert_eq!(
      vault.resolve(&reference).unwrap().as_deref(),
      Some("Bearer private-token")
    );
    vault.delete(&reference).unwrap();
    vault.delete(&reference).unwrap();
    assert_eq!(vault.resolve(&reference).unwrap(), None);
  }

  #[test]
  fn rejects_arbitrary_keys_noncanonical_ids_and_oversized_values() {
    let vault = vault();
    assert!(vault.resolve("plugin-selected-key").is_err());
    assert!(
      vault
        .resolve("credential:550E8400-E29B-41D4-A716-446655440000")
        .is_err()
    );
    assert!(vault.store(&"x".repeat(MAX_SECRET_BYTES + 1)).is_err());
  }

  #[test]
  fn debug_output_never_contains_stored_values() {
    let vault = vault();
    vault.store("never-print-this").unwrap();
    let debug = format!("{vault:?}");
    assert!(!debug.contains("never-print-this"));
  }

  #[test]
  fn credential_references_cannot_fall_through_to_a_custom_resolver() {
    let vault = vault();
    let resolver = resolver(vault, Some(Arc::new(CustomResolver)));

    assert_eq!(
      resolver.resolve("host-secret").unwrap().as_deref(),
      Some("custom:host-secret")
    );
    assert!(resolver.resolve("credential:not-a-uuid").is_err());
  }
}
