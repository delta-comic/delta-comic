use super::*;

#[test]
fn torrent_checksum_uses_the_single_actual_downloaded_file() {
  let report = TorrentDownloadReport {
    downloaded_paths: vec![PathBuf::from("download-root/actual-name.cbz")],
  };
  assert_eq!(
    report.checksum_path().unwrap(),
    Path::new("download-root/actual-name.cbz")
  );

  assert!(
    TorrentDownloadReport {
      downloaded_paths: Vec::new()
    }
    .checksum_path()
    .is_err()
  );
  assert!(
    TorrentDownloadReport {
      downloaded_paths: vec![PathBuf::from("one"), PathBuf::from("two")]
    }
    .checksum_path()
    .is_err()
  );
}

#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[test]
fn rejects_unsafe_torrent_metadata_paths() {
  let root = Path::new("download-root");
  assert_eq!(
    safe_torrent_path(root, Path::new("chapter/001.cbz")).unwrap(),
    root.join("chapter/001.cbz")
  );
  assert!(safe_torrent_path(root, Path::new("../outside")).is_err());
  assert!(safe_torrent_path(root, Path::new("/absolute")).is_err());
  assert!(safe_torrent_path(root, Path::new("")).is_err());
}

#[cfg(feature = "bittorrent")]
fn offline_session_options(
  listen_port_range: Option<std::ops::Range<u16>>,
  persistence: Option<librqbit::SessionPersistenceConfig>,
) -> librqbit::SessionOptions {
  let listen = listen_port_range.map(|range| librqbit::ListenerOptions {
    listen_addr: (std::net::Ipv4Addr::LOCALHOST, range.start).into(),
    ipv4_only: true,
    ..Default::default()
  });
  librqbit::SessionOptions {
    dht: None,
    fastresume: persistence.is_some(),
    listen,
    persistence,
    ..Default::default()
  }
}

#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn json_fast_resume_restores_identity_pause_selection_and_destination() {
  use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, CreateTorrentOptions, Session,
    SessionPersistenceConfig,
  };
  use tempfile::TempDir;

  let root = TempDir::new().unwrap();
  let source = root.path().join("source.bin");
  tokio::fs::write(&source, vec![0x7a; 32 * 1024])
    .await
    .unwrap();
  let spawner = librqbit::spawn_utils::BlockingSpawner::new(2);
  let torrent = librqbit::create_torrent(
    &source,
    CreateTorrentOptions {
      name: Some("resume.bin"),
      piece_length: Some(4 * 1024),
      ..Default::default()
    },
    &spawner,
  )
  .await
  .unwrap();
  let torrent_bytes = torrent.as_bytes().unwrap();
  let persistence_dir = root.path().join("session");
  let destination = root.path().join("restored-output");
  let persistence = || SessionPersistenceConfig::Json {
    folder: Some(persistence_dir.clone()),
  };

  let first = Session::new_with_opts(
    root.path().join("unused-default-output"),
    offline_session_options(None, Some(persistence())),
  )
  .await
  .unwrap();
  let response = first
    .add_torrent(
      AddTorrent::from_bytes(torrent_bytes),
      Some(AddTorrentOptions {
        paused: true,
        only_files: Some(vec![0]),
        output_folder: Some(destination.to_string_lossy().into_owned()),
        overwrite: true,
        ..Default::default()
      }),
    )
    .await
    .unwrap();
  let (id, handle) = match response {
    AddTorrentResponse::Added(id, handle) => (id, handle),
    _ => panic!("fresh persisted torrent was not added"),
  };
  tokio::time::timeout(Duration::from_secs(5), handle.wait_until_initialized())
    .await
    .expect("persisted torrent initialization timed out")
    .unwrap();
  assert!(handle.is_paused());
  assert_eq!(handle.only_files(), Some(vec![0]));
  let info_hash = handle.info_hash();
  first.stop().await;
  drop(handle);
  drop(first);

  let persisted = tokio::fs::read_to_string(persistence_dir.join("session.json"))
    .await
    .unwrap();
  assert!(persisted.contains(&destination.to_string_lossy().into_owned()));

  // Simulate an abrupt process death that persisted the torrent as running.
  // TorrentManager must pause it before the engine scheduler can expose it.
  let mut persistence_json = serde_json::from_str::<serde_json::Value>(&persisted).unwrap();
  persistence_json["torrents"][id.to_string()]["is_paused"] = false.into();
  tokio::fs::write(
    persistence_dir.join("session.json"),
    serde_json::to_vec(&persistence_json).unwrap(),
  )
  .await
  .unwrap();

  let restored_manager = TorrentManager::new(persistence_dir, 3).await.unwrap();
  let restored = restored_manager
    .session
    .get(id.into())
    .expect("persisted torrent handle was not restored");
  tokio::time::timeout(Duration::from_secs(5), restored.wait_until_initialized())
    .await
    .expect("restored torrent initialization timed out")
    .unwrap();
  assert_eq!(restored.id(), id);
  assert_eq!(restored.info_hash(), info_hash);
  assert_eq!(restored.only_files(), Some(vec![0]));
  assert!(restored.is_paused());
  restored_manager.stop().await.unwrap();
}

#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[cfg(feature = "bittorrent")]
#[test]
fn ratio_or_duration_stops_at_either_threshold() {
  let policy = SeedPolicy::RatioOrDuration {
    ratio: 2.0,
    duration_seconds: 60,
  };
  assert!(seed_target_reached(&policy, 2_000, 1_000, 5));
  assert!(seed_target_reached(&policy, 0, 1_000, 60));
  assert!(!seed_target_reached(&policy, 1_000, 1_000, 59));
}
