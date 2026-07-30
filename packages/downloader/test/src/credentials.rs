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
