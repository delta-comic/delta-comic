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
#[test]
fn already_managed_torrent_requires_the_same_persisted_task_identity() {
  let identity = TorrentResumeIdentity {
    session_id: Some(7),
    info_hash: Some("0123456789abcdef0123456789abcdef01234567".into()),
  };
  assert!(
    validate_resume_identity(
      7,
      "0123456789abcdef0123456789abcdef01234567",
      Some(&identity)
    )
    .is_ok()
  );
  assert!(validate_resume_identity(7, "0123456789abcdef0123456789abcdef01234567", None).is_err());
  assert!(
    validate_resume_identity(
      8,
      "0123456789abcdef0123456789abcdef01234567",
      Some(&identity)
    )
    .is_err()
  );
  assert!(
    validate_resume_identity(
      7,
      "ffffffffffffffffffffffffffffffffffffffff",
      Some(&identity)
    )
    .is_err()
  );
}

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
#[tokio::test]
async fn removing_a_torrent_clears_its_handle_and_fast_resume() {
  use librqbit::{AddTorrent, AddTorrentOptions, AddTorrentResponse, CreateTorrentOptions};
  use tempfile::TempDir;

  let root = TempDir::new().unwrap();
  let source_path = root.path().join("payload.bin");
  let payload = b"local torrent cleanup fixture";
  tokio::fs::write(&source_path, payload).await.unwrap();
  let spawner = librqbit::spawn_utils::BlockingSpawner::new(2);
  let torrent = librqbit::create_torrent(&source_path, CreateTorrentOptions::default(), &spawner)
    .await
    .unwrap();
  let torrent_bytes = torrent.as_bytes().unwrap();
  let info_hash = torrent.info_hash().as_string();
  let destination = root.path().join("destination");
  tokio::fs::create_dir_all(&destination).await.unwrap();
  let downloaded_path = destination.join("payload.bin");
  tokio::fs::write(&downloaded_path, payload).await.unwrap();

  let session_dir = root.path().join("session");
  let manager = TorrentManager::new(session_dir.clone(), 4).await.unwrap();
  let add_precompleted = || {
    manager.session.add_torrent(
      AddTorrent::from_bytes(torrent_bytes.clone()),
      Some(AddTorrentOptions {
        output_folder: Some(destination.to_string_lossy().into_owned()),
        overwrite: true,
        ..Default::default()
      }),
    )
  };

  let response = add_precompleted().await.unwrap();
  let (id, handle) = match response {
    AddTorrentResponse::Added(id, handle) => (id, handle),
    _ => panic!("fresh torrent was not added"),
  };
  tokio::time::timeout(Duration::from_secs(5), handle.wait_until_initialized())
    .await
    .expect("precompleted torrent initialization timed out")
    .unwrap();
  assert!(handle.stats().finished);

  manager
    .remove(Some(id as u64), Some(&info_hash), false)
    .await
    .unwrap();
  assert!(manager.session.get(id.into()).is_none());
  assert!(tokio::fs::try_exists(&downloaded_path).await.unwrap());
  let persisted = tokio::fs::read_to_string(session_dir.join("session.json"))
    .await
    .unwrap();
  assert!(!persisted.contains(&info_hash));

  let response = add_precompleted().await.unwrap();
  let (id, handle) = match response {
    AddTorrentResponse::Added(id, handle) => (id, handle),
    _ => panic!("deleted torrent handle was not re-added"),
  };
  tokio::time::timeout(Duration::from_secs(5), handle.wait_until_initialized())
    .await
    .expect("re-added torrent initialization timed out")
    .unwrap();
  manager
    .remove(Some(id as u64), Some(&info_hash), true)
    .await
    .unwrap();
  assert!(manager.session.get(id.into()).is_none());
  assert!(!tokio::fs::try_exists(&downloaded_path).await.unwrap());
  manager.stop().await.unwrap();
}

#[cfg(feature = "bittorrent")]
fn reserve_loopback_port() -> u16 {
  loop {
    let listener = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).unwrap();
    let port = listener.local_addr().unwrap().port();
    drop(listener);
    if port < u16::MAX {
      return port;
    }
  }
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
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn local_sessions_transfer_a_selected_file_from_magnet_after_resume() {
  use librqbit::{AddTorrent, AddTorrentOptions, CreateTorrentOptions, Magnet, Session};
  use tempfile::TempDir;

  let root = TempDir::new().unwrap();
  let source = root.path().join("seed");
  tokio::fs::create_dir_all(&source).await.unwrap();
  let ignored_payload = vec![0x31; 32 * 1024];
  let selected_payload = (0..64 * 1024)
    .map(|index| (index % 251) as u8)
    .collect::<Vec<_>>();
  tokio::fs::write(source.join("ignored.bin"), ignored_payload)
    .await
    .unwrap();
  tokio::fs::write(source.join("selected.bin"), &selected_payload)
    .await
    .unwrap();

  let spawner = librqbit::spawn_utils::BlockingSpawner::new(2);
  let torrent = librqbit::create_torrent(
    &source,
    CreateTorrentOptions {
      name: Some("offline-transfer"),
      piece_length: Some(4 * 1024),
      ..Default::default()
    },
    &spawner,
  )
  .await
  .unwrap();
  let torrent_bytes = torrent.as_bytes().unwrap();

  let listen_port = reserve_loopback_port();
  let seeder = Session::new_with_opts(
    root.path().join("unused-seeder-output"),
    offline_session_options(Some(listen_port..listen_port + 1), None),
  )
  .await
  .unwrap();
  let seeder_handle = tokio::time::timeout(
    Duration::from_secs(5),
    seeder.add_torrent(
      AddTorrent::from_bytes(torrent_bytes),
      Some(AddTorrentOptions {
        output_folder: Some(source.to_string_lossy().into_owned()),
        overwrite: true,
        ..Default::default()
      }),
    ),
  )
  .await
  .expect("seeder add timed out")
  .unwrap()
  .into_handle()
  .unwrap();
  tokio::time::timeout(Duration::from_secs(5), seeder_handle.wait_until_completed())
    .await
    .expect("seeder initialization timed out")
    .unwrap();

  let (selected_index, selected_relative_path) = seeder_handle
    .with_metadata(|metadata| {
      metadata
        .file_infos
        .iter()
        .enumerate()
        .find(|(_, file)| file.relative_filename.file_name() == Some("selected.bin".as_ref()))
        .map(|(index, file)| (index, file.relative_filename.clone()))
    })
    .unwrap()
    .expect("selected fixture file is missing from torrent metadata");

  let destination = root.path().join("leecher-output");
  let leecher = Session::new_with_opts(
    root.path().join("unused-leecher-output"),
    offline_session_options(None, None),
  )
  .await
  .unwrap();
  let magnet = Magnet::from_id20(torrent.info_hash(), Vec::new(), None).to_string();
  let peer = std::net::SocketAddr::from((std::net::Ipv4Addr::LOCALHOST, listen_port));
  let leecher_handle = tokio::time::timeout(
    Duration::from_secs(8),
    leecher.add_torrent(
      AddTorrent::from_url(magnet),
      Some(AddTorrentOptions {
        paused: true,
        only_files: Some(vec![selected_index]),
        output_folder: Some(destination.to_string_lossy().into_owned()),
        initial_peers: Some(vec![peer]),
        overwrite: true,
        ..Default::default()
      }),
    ),
  )
  .await
  .expect("magnet metadata resolution timed out")
  .unwrap()
  .into_handle()
  .unwrap();
  tokio::time::timeout(
    Duration::from_secs(5),
    leecher_handle.wait_until_initialized(),
  )
  .await
  .expect("paused leecher initialization timed out")
  .unwrap();
  assert!(leecher_handle.is_paused());
  assert_eq!(leecher_handle.only_files(), Some(vec![selected_index]));

  leecher.unpause(&leecher_handle).await.unwrap();
  tokio::time::timeout(
    Duration::from_secs(10),
    leecher_handle.wait_until_completed(),
  )
  .await
  .expect("local torrent transfer timed out")
  .unwrap();
  assert!(leecher_handle.stats().finished);
  assert_eq!(
    tokio::fs::read(destination.join(selected_relative_path))
      .await
      .unwrap(),
    selected_payload
  );

  leecher.stop().await;
  seeder.stop().await;
}

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
fn settings() -> DownloaderSettings {
  DownloaderSettings {
    seed_on_complete: true,
    seed_ratio: Some(1.5),
    seed_seconds: Some(3_600),
    ..DownloaderSettings::platform_default()
  }
}

#[cfg(feature = "bittorrent")]
#[test]
fn empty_file_selection_means_all_files() {
  assert_eq!(normalize_only_files(&[]), None);
  assert!(same_file_selection(None, &None));
  assert!(!same_file_selection(Some(Vec::new()), &None));
}

#[cfg(feature = "bittorrent")]
#[test]
fn file_selection_is_compared_as_a_set() {
  let expected = normalize_only_files(&[4, 1, 4]);
  assert_eq!(expected, Some(vec![1, 4]));
  assert!(same_file_selection(Some(vec![4, 1]), &expected));
  assert!(!same_file_selection(Some(vec![1, 3]), &expected));
}

#[cfg(feature = "bittorrent")]
#[test]
fn peer_limit_uses_the_scheduler_fair_share() {
  let mut settings = DownloaderSettings::platform_default();
  settings.per_task_connections = 7;
  assert_eq!(torrent_peer_limit(&settings), 7);
  settings.per_task_connections = 0;
  assert_eq!(torrent_peer_limit(&settings), 1);
}

#[cfg(feature = "bittorrent")]
#[test]
fn seeding_is_opt_in_and_source_policy_overrides_thresholds() {
  let mut disabled = settings();
  disabled.seed_on_complete = false;
  assert!(matches!(
    effective_seed_policy(
      Some(&SeedPolicy::Duration {
        duration_seconds: 5
      }),
      &disabled
    ),
    SeedPolicy::None
  ));

  assert!(matches!(
    effective_seed_policy(
      Some(&SeedPolicy::Duration {
        duration_seconds: 5
      }),
      &settings()
    ),
    SeedPolicy::Duration {
      duration_seconds: 5
    }
  ));
  assert!(matches!(
    effective_seed_policy(None, &settings()),
    SeedPolicy::RatioOrDuration {
      ratio: 1.5,
      duration_seconds: 3_600
    }
  ));
}

#[cfg(feature = "bittorrent")]
#[test]
fn ratio_uses_the_real_selected_total() {
  let policy = SeedPolicy::Ratio { ratio: 1.5 };
  assert!(!seed_target_reached(&policy, 1_499, 1_000, 0));
  assert!(seed_target_reached(&policy, 1_500, 1_000, 0));
  assert!(!seed_target_reached(&policy, 1, 0, 0));
}

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
