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
#[path = "../test/src/saf_contract.rs"]
mod tests;
