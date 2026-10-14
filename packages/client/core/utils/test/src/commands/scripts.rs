use super::{callback_name, install_bridge_script};

#[test]
fn callback_name_defaults_when_empty() {
  assert_eq!(callback_name(None), "callback");
  assert_eq!(callback_name(Some("")), "callback");
  assert_eq!(callback_name(Some("  ")), "callback");
  assert_eq!(callback_name(Some("done")), "done");
}

#[test]
fn install_bridge_script_json_escapes_injected_code() {
  let script = install_bridge_script(
    Some("body::before { content: \"x\"; }"),
    Some("callback({ ok: true, text: \"</script>\" })"),
    "finish",
  );

  assert!(script.contains(r#""body::before { content: \"x\"; }""#));
  assert!(script.contains(r#""callback({ ok: true, text: \"</script>\" })""#));
  assert!(script.contains(r#""finish""#));
}
