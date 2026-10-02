pub(crate) mod cookies;
mod eval;
pub(crate) mod page;
mod scripts;
pub(crate) mod storage;
mod types;

pub(crate) use types::{
  IframeCollection, InjectCodeOptions, OpenPageOptions, OpenedPage, WebStorageSnapshot,
  WebviewAuthData, WebviewCookie,
};
