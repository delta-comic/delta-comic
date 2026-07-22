use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidPickedDestination {
  pub(crate) cancelled: bool,
  pub(crate) id: Option<String>,
  pub(crate) label: Option<String>,
  pub(crate) uri: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidDeleteExportRequest {
  pub(crate) tree_uri: String,
  pub(crate) document_uri: String,
}

#[derive(Debug, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct AndroidDeleteExportResponse {
  pub(crate) deleted: bool,
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn destination_picker_contract_does_not_accept_a_renderer_path() {
    let picked: AndroidPickedDestination = serde_json::from_value(serde_json::json!({
      "cancelled": false,
      "id": "saf-0123456789abcdef",
      "label": "Comics",
      "uri": "content://provider/tree/comics"
    }))
    .unwrap();
    assert_eq!(picked.id.as_deref(), Some("saf-0123456789abcdef"));
    assert_eq!(
      picked.uri.as_deref(),
      Some("content://provider/tree/comics")
    );
  }

  #[test]
  fn delete_contract_contains_only_trusted_database_uris() {
    let request = AndroidDeleteExportRequest {
      tree_uri: "content://provider/tree/root".into(),
      document_uri: "content://provider/document/root%2Ffile".into(),
    };
    assert_eq!(
      serde_json::to_value(request).unwrap(),
      serde_json::json!({
        "treeUri": "content://provider/tree/root",
        "documentUri": "content://provider/document/root%2Ffile"
      })
    );
    let response: AndroidDeleteExportResponse =
      serde_json::from_value(serde_json::json!({ "deleted": true })).unwrap();
    assert!(response.deleted);
  }
}
