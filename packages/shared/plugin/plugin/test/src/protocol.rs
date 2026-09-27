use std::{fs, time::SystemTime};

use super::*;

fn request(method: http::Method, uri: &str) -> http::Request<Vec<u8>> {
  http::Request::builder()
    .method(method)
    .uri(uri)
    .body(Vec::new())
    .unwrap()
}

fn fixture_root() -> PathBuf {
  let token = SystemTime::now()
    .duration_since(SystemTime::UNIX_EPOCH)
    .unwrap()
    .as_nanos();
  let root = std::env::temp_dir().join(format!("delta-comic-plugin-protocol-{token}"));
  fs::create_dir_all(root.join("layout/chunks")).unwrap();
  fs::write(root.join("layout/chunks/page.js"), b"export default 1").unwrap();
  root
}

#[test]
fn serves_nested_plugin_modules_with_cors_headers() {
  let root = fixture_root();
  let response = response_from_root(
    &root,
    request(
      http::Method::GET,
      "plugin://localhost/layout/chunks/page.js",
    ),
  );

  assert_eq!(response.status(), http::StatusCode::OK);
  assert_eq!(response.body(), b"export default 1");
  assert_eq!(
    response.headers()[http::header::CONTENT_TYPE],
    "text/javascript; charset=utf-8"
  );
  assert_eq!(
    response.headers()[http::header::ACCESS_CONTROL_ALLOW_ORIGIN],
    "*"
  );
  fs::remove_dir_all(root).unwrap();
}

#[test]
fn supports_head_and_wasm_content_types() {
  let root = fixture_root();
  fs::write(root.join("layout/module.wasm"), [0, 97, 115, 109]).unwrap();
  let response = response_from_root(
    &root,
    request(http::Method::HEAD, "plugin://localhost/layout/module.wasm"),
  );

  assert_eq!(response.status(), http::StatusCode::OK);
  assert!(response.body().is_empty());
  assert_eq!(
    response.headers()[http::header::CONTENT_TYPE],
    "application/wasm"
  );
  assert_eq!(response.headers()[http::header::CONTENT_LENGTH], "4");
  fs::remove_dir_all(root).unwrap();
}

#[test]
fn rejects_paths_outside_the_plugin_directory() {
  let root = fixture_root();
  for uri in [
    "plugin://localhost/layout/%2e%2e/secret.txt",
    "plugin://localhost/unsafe%3Aid/index.js",
    "plugin://localhost/layout/C:%5Csecret.txt",
  ] {
    let response = response_from_root(&root, request(http::Method::GET, uri));
    assert_eq!(response.status(), http::StatusCode::BAD_REQUEST, "{uri}");
  }
  fs::remove_dir_all(root).unwrap();
}
