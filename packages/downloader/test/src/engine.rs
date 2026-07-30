use std::{
  collections::BTreeMap,
  fs::OpenOptions,
  path::PathBuf,
  sync::{Arc, Mutex as StdMutex},
  time::Duration,
};

use tempfile::TempDir;
use tokio::time::timeout;
use tokio_util::sync::CancellationToken;

use super::{BackgroundClaim, DirectSafTarget, Engine, EngineEvent};
#[cfg(feature = "bittorrent")]
use crate::domain::{Checksum, ChecksumAlgorithm};
use crate::{
  domain::{
    ContentRefreshContext, Destination, DestinationKind, DownloadAsset, DownloadSource,
    EnqueuePlanInput, HttpHeaderValue, HttpMirror, HttpSource, TaskStatus, TorrentInput,
    TorrentSource,
  },
  error::Error,
  persistence::CompletedRange,
};

fn asset(key: &str, relative_path: &str, size: u64) -> DownloadAsset {
  DownloadAsset {
    key: key.into(),
    relative_path: relative_path.into(),
    size: Some(size),
    checksum: None,
    source: DownloadSource::Http(HttpSource {
      mirrors: vec![HttpMirror {
        url: "https://example.invalid/file".into(),
        priority: 0,
        headers: BTreeMap::new(),
      }],
      expected_size: Some(size),
      etag: None,
      last_modified: None,
      expires_at: None,
    }),
  }
}

#[test]
fn preserves_user_and_terminal_states_after_a_worker_stops() {
  for status in [
    TaskStatus::Queued,
    TaskStatus::WaitingForNetwork,
    TaskStatus::WaitingForSource,
    TaskStatus::Paused,
    TaskStatus::Completed,
    TaskStatus::Failed,
    TaskStatus::Cancelled,
  ] {
    assert!(Engine::should_preserve_external_status(status));
  }
  for status in [
    TaskStatus::Probing,
    TaskStatus::Downloading,
    TaskStatus::Verifying,
    TaskStatus::Seeding,
  ] {
    assert!(!Engine::should_preserve_external_status(status));
  }
}

#[test]
fn controlled_task_waits_only_for_queued_and_active_states() {
  for status in [
    TaskStatus::Queued,
    TaskStatus::Probing,
    TaskStatus::Downloading,
    TaskStatus::Verifying,
    TaskStatus::Seeding,
  ] {
    assert!(Engine::should_wait_for_controlled_task(status));
  }
  for status in [
    TaskStatus::WaitingForNetwork,
    TaskStatus::WaitingForSource,
    TaskStatus::Paused,
    TaskStatus::Completed,
    TaskStatus::Failed,
    TaskStatus::Cancelled,
  ] {
    assert!(!Engine::should_wait_for_controlled_task(status));
  }
}

async fn engine(root: &TempDir) -> Engine {
  Engine::open(
    &root.path().join("downloader.sqlite"),
    &root.path().join("downloads"),
    None,
    |_| {},
  )
  .await
  .unwrap()
}

async fn enqueue_test_task(engine: &Engine) -> crate::DownloadTask {
  engine
    .enqueue_plan(EnqueuePlanInput {
      key: "comic:control-test".into(),
      title: "Control test".into(),
      assets: vec![asset("ep-1", "001.cbz", 10)],
      destination_id: None,
      priority: None,
      refresh_context: None,
    })
    .await
    .unwrap()
    .remove(0)
}

#[tokio::test]
async fn claims_a_task_control_only_once_under_concurrency() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let mut claims = tokio::task::JoinSet::new();
  for _ in 0..16 {
    let engine = engine.clone();
    claims.spawn(async move { engine.try_claim_control("same-task").await.is_some() });
  }

  let mut successful_claims = 0;
  while let Some(result) = claims.join_next().await {
    successful_claims += usize::from(result.unwrap());
  }

  assert_eq!(successful_claims, 1);
  assert_eq!(engine.controls.lock().await.len(), 1);
}

#[tokio::test]
async fn shutdown_waits_for_worker_checkpoint_and_requeues_only_interrupted_tasks() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let interrupted = enqueue_test_task(&engine).await;
  let paused = engine
    .enqueue_plan(EnqueuePlanInput {
      key: "comic:user-paused".into(),
      title: "User paused".into(),
      assets: vec![asset("ep-2", "002.cbz", 10)],
      destination_id: None,
      priority: None,
      refresh_context: None,
    })
    .await
    .unwrap()
    .remove(0);
  engine
    .repository
    .set_status(&interrupted.id, TaskStatus::Downloading)
    .await
    .unwrap();
  engine
    .repository
    .set_status(&paused.id, TaskStatus::Paused)
    .await
    .unwrap();
  let control = engine.try_claim_control(&interrupted.id).await.unwrap();

  let shutting_down = engine.clone();
  let mut shutdown = tokio::spawn(async move { shutting_down.shutdown().await });
  timeout(Duration::from_secs(1), control.cancelled())
    .await
    .expect("shutdown did not cancel the active worker");
  assert!(
    timeout(Duration::from_millis(50), &mut shutdown)
      .await
      .is_err(),
    "shutdown returned before the worker released its control"
  );

  engine
    .repository
    .replace_completed_ranges(&interrupted.id, &[CompletedRange { start: 0, end: 8 }])
    .await
    .unwrap();
  engine.controls.lock().await.remove(&interrupted.id);
  engine.workers_changed.notify_waiters();

  timeout(Duration::from_secs(3), shutdown)
    .await
    .expect("shutdown did not finish after the worker stopped")
    .unwrap()
    .unwrap();
  assert_eq!(
    engine
      .repository
      .get_task(&interrupted.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Queued
  );
  assert_eq!(
    engine
      .repository
      .get_task(&paused.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Paused
  );
  assert!(engine.try_claim_control("after-shutdown").await.is_none());
  drop(engine);

  let reopened = self::engine(&root).await;
  assert_eq!(
    reopened
      .repository
      .get_task(&interrupted.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Queued
  );
  assert_eq!(
    reopened
      .repository
      .completed_ranges(&interrupted.id)
      .await
      .unwrap(),
    vec![CompletedRange { start: 0, end: 8 }]
  );
}

#[test]
fn background_resource_limits_enforce_both_task_and_connection_budgets() {
  let mut settings = crate::DownloaderSettings::platform_default();
  settings.max_active_tasks = 20;
  settings.connection_budget = 8;
  settings.per_task_connections = 4;
  assert_eq!(Engine::background_resource_limits(&settings), (8, 1));

  settings.max_active_tasks = 2;
  settings.connection_budget = 16;
  assert_eq!(Engine::background_resource_limits(&settings), (2, 4));
}

#[tokio::test]
async fn background_claims_atomically_respect_the_global_task_limit() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let mut claims = tokio::task::JoinSet::new();
  for index in 0..16 {
    let engine = engine.clone();
    claims.spawn(async move {
      matches!(
        engine
          .try_claim_background_control(&format!("task-{index}"), 3, 0)
          .await,
        BackgroundClaim::Claimed(_)
      )
    });
  }

  let mut successful_claims = 0;
  while let Some(result) = claims.join_next().await {
    successful_claims += usize::from(result.unwrap());
  }
  assert_eq!(successful_claims, 3);
  assert_eq!(engine.controls.lock().await.len(), 3);
}

#[tokio::test]
async fn system_stop_invalidates_a_background_worker_waiting_for_capacity() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;
  let generation = engine.background_stop_generation(&task.id).await;

  engine.system_stop_task(&task.id).await.unwrap();

  assert!(matches!(
    engine
      .try_claim_background_control(&task.id, 1, generation)
      .await,
    BackgroundClaim::Stopped
  ));
  assert!(!engine.controls.lock().await.contains_key(&task.id));
}

#[tokio::test]
async fn run_task_now_waits_when_an_existing_control_is_still_queued() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;
  engine
    .controls
    .lock()
    .await
    .insert(task.id.clone(), CancellationToken::new());

  let waiting_engine = engine.clone();
  let task_id = task.id.clone();
  let mut execution = tokio::spawn(async move { waiting_engine.run_task_now(&task_id).await });

  assert!(
    timeout(Duration::from_millis(50), &mut execution)
      .await
      .is_err()
  );
  engine
    .repository
    .set_status(&task.id, TaskStatus::Completed)
    .await
    .unwrap();

  timeout(Duration::from_secs(1), execution)
    .await
    .expect("queued control waiter did not observe completion")
    .unwrap()
    .unwrap();
  assert!(engine.controls.lock().await.contains_key(&task.id));
}

#[tokio::test]
async fn run_task_now_rejects_source_waiting_and_terminal_states_without_claiming_them() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;

  for status in [
    TaskStatus::WaitingForSource,
    TaskStatus::Paused,
    TaskStatus::Failed,
    TaskStatus::Cancelled,
  ] {
    engine
      .repository
      .set_status(&task.id, status)
      .await
      .unwrap();
    let error = engine.run_task_now(&task.id).await.unwrap_err();
    assert!(matches!(error, Error::InvalidInput(_)));
    assert!(error.to_string().contains(status.as_db()));
    assert!(!engine.controls.lock().await.contains_key(&task.id));
  }

  engine
    .repository
    .set_status(&task.id, TaskStatus::Completed)
    .await
    .unwrap();
  engine.run_task_now(&task.id).await.unwrap();
  assert!(!engine.controls.lock().await.contains_key(&task.id));
}

#[tokio::test]
async fn network_constraint_recovery_only_requeues_waiting_for_network() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;
  engine
    .repository
    .set_failure(&task.id, &Error::Network("offline"))
    .await
    .unwrap();

  engine.prepare_background_task(&task.id).await.unwrap();
  let queued = engine.repository.get_task(&task.id).await.unwrap().unwrap();
  assert_eq!(queued.status, TaskStatus::Queued);
  assert_eq!(queued.error_code, None);
  assert_eq!(queued.error_message, None);

  let paused = engine
    .repository
    .set_status(&task.id, TaskStatus::Paused)
    .await
    .unwrap();
  engine.prepare_background_task(&task.id).await.unwrap();
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .revision,
    paused.revision,
  );
}

#[tokio::test]
async fn system_stop_cancels_the_worker_and_requeues_only_system_owned_states() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;

  for status in [
    TaskStatus::Probing,
    TaskStatus::Downloading,
    TaskStatus::WaitingForNetwork,
    TaskStatus::Verifying,
    TaskStatus::Seeding,
  ] {
    engine
      .repository
      .set_status(&task.id, status)
      .await
      .unwrap();
    let token = CancellationToken::new();
    engine
      .controls
      .lock()
      .await
      .insert(task.id.clone(), token.clone());

    engine.system_stop_task(&task.id).await.unwrap();

    assert!(token.is_cancelled());
    assert_eq!(
      engine
        .repository
        .get_task(&task.id)
        .await
        .unwrap()
        .unwrap()
        .status,
      TaskStatus::Queued,
    );
    engine.controls.lock().await.remove(&task.id);
  }

  for status in [
    TaskStatus::Paused,
    TaskStatus::Cancelled,
    TaskStatus::Completed,
    TaskStatus::Failed,
    TaskStatus::WaitingForSource,
  ] {
    let protected = engine
      .repository
      .set_status(&task.id, status)
      .await
      .unwrap();
    engine.system_stop_task(&task.id).await.unwrap();
    let current = engine.repository.get_task(&task.id).await.unwrap().unwrap();
    assert_eq!(current.status, status);
    assert_eq!(current.revision, protected.revision);
  }
}

#[tokio::test]
async fn completion_does_not_overwrite_a_concurrent_external_state() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;

  engine
    .repository
    .set_status(&task.id, TaskStatus::Downloading)
    .await
    .unwrap();
  engine
    .repository
    .set_status(&task.id, TaskStatus::Paused)
    .await
    .unwrap();

  assert!(!engine.complete_task_if_active(&task.id).await.unwrap());
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Paused,
  );

  engine
    .repository
    .set_status(&task.id, TaskStatus::Verifying)
    .await
    .unwrap();
  assert!(engine.complete_task_if_active(&task.id).await.unwrap());
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Completed,
  );
}

#[tokio::test]
async fn update_source_emits_the_committed_task_and_wakes_the_scheduler() {
  let root = TempDir::new().unwrap();
  let events = Arc::new(StdMutex::new(Vec::new()));
  let captured_events = events.clone();
  let engine = Engine::open(
    &root.path().join("downloader.sqlite"),
    &root.path().join("downloads"),
    None,
    move |event| captured_events.lock().unwrap().push(event),
  )
  .await
  .unwrap();
  let task = enqueue_test_task(&engine).await;
  engine.wake.notified().await;
  events.lock().unwrap().clear();
  engine
    .repository
    .set_failure(&task.id, &Error::SourceExpired)
    .await
    .unwrap();
  let refreshed_source = DownloadSource::Http(HttpSource {
    mirrors: vec![HttpMirror {
      url: "https://refreshed.example/file".into(),
      priority: 10,
      headers: BTreeMap::new(),
    }],
    expected_size: Some(10),
    etag: Some("refreshed-etag".into()),
    last_modified: None,
    expires_at: None,
  });

  let updated = engine
    .update_source(&task.id, &refreshed_source)
    .await
    .unwrap();

  timeout(Duration::from_millis(50), engine.wake.notified())
    .await
    .expect("source update did not wake the scheduler");
  assert_eq!(updated.status, TaskStatus::Queued);
  assert!(updated.error_code.is_none());
  assert!(updated.error_message.is_none());
  match &updated.source {
    DownloadSource::Http(source) => {
      assert_eq!(source.mirrors[0].url, "https://refreshed.example/file");
    }
    DownloadSource::Torrent(_) => panic!("source update changed the source kind"),
  }

  let events = events.lock().unwrap();
  assert_eq!(events.len(), 1);
  match &events[0] {
    EngineEvent::TaskUpsert(payload) => {
      assert_eq!(payload.task.id, task.id);
      assert_eq!(payload.task.status, TaskStatus::Queued);
      assert_eq!(payload.revision, updated.revision);
    }
    event => panic!("unexpected source update event: {event:?}"),
  }
}

#[tokio::test]
async fn update_source_cannot_revive_a_task_that_is_no_longer_waiting_for_source() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;
  let original_source = task.source.clone();
  let refreshed_source = DownloadSource::Http(HttpSource {
    mirrors: vec![HttpMirror {
      url: "https://refreshed.example/file".into(),
      priority: 10,
      headers: BTreeMap::new(),
    }],
    expected_size: Some(10),
    etag: None,
    last_modified: None,
    expires_at: None,
  });

  let paused = engine.pause(&task.id).await.unwrap();
  let error = engine
    .update_source(&task.id, &refreshed_source)
    .await
    .unwrap_err();

  assert!(matches!(error, Error::InvalidInput(_)));
  let persisted = engine.repository.get_task(&task.id).await.unwrap().unwrap();
  assert_eq!(persisted.status, TaskStatus::Paused);
  assert_eq!(persisted.revision, paused.revision);
  assert_eq!(
    serde_json::to_value(&persisted.source).unwrap(),
    serde_json::to_value(&original_source).unwrap()
  );
}

#[tokio::test]
async fn task_events_redact_sources_headers_and_local_paths() {
  const SECRET_URL: &str = "https://secret.example/private?token=url-secret";
  const SECRET_AUTHORIZATION: &str = "Bearer authorization-secret";
  const SECRET_REFERENCE: &str = "credential:cookie-secret";
  const SECRET_MAGNET: &str = "magnet:?xt=urn:btih:secret-info-hash";
  const SECRET_TORRENT_URL: &str = "https://secret.example/private.torrent";
  const SECRET_TORRENT_BYTES: &str = "dG9ycmVudC1zZWNyZXQ=";
  const SECRET_FINAL_PATH: &str = "/private/user/downloads/secret-file";

  let root = TempDir::new().unwrap();
  let events = Arc::new(StdMutex::new(Vec::new()));
  let captured_events = events.clone();
  let engine = Engine::open(
    &root.path().join("downloader.sqlite"),
    &root.path().join("downloads"),
    None,
    move |event| captured_events.lock().unwrap().push(event),
  )
  .await
  .unwrap();
  let mut task = enqueue_test_task(&engine).await;
  events.lock().unwrap().clear();
  task.final_path = Some(SECRET_FINAL_PATH.into());
  task.source = DownloadSource::Http(HttpSource {
    mirrors: vec![HttpMirror {
      url: SECRET_URL.into(),
      priority: 0,
      headers: BTreeMap::from([
        (
          "Authorization".into(),
          HttpHeaderValue::Value {
            value: SECRET_AUTHORIZATION.into(),
          },
        ),
        (
          "Cookie".into(),
          HttpHeaderValue::SecretRef {
            secret_ref: SECRET_REFERENCE.into(),
          },
        ),
      ]),
    }],
    expected_size: Some(10),
    etag: None,
    last_modified: None,
    expires_at: None,
  });
  engine.emit_task(task.clone());

  for input in [
    TorrentInput::Magnet {
      uri: SECRET_MAGNET.into(),
    },
    TorrentInput::Url {
      url: SECRET_TORRENT_URL.into(),
    },
    TorrentInput::Bytes {
      base64: SECRET_TORRENT_BYTES.into(),
    },
  ] {
    task.source = DownloadSource::Torrent(TorrentSource {
      input,
      only_files: vec![0, 2],
      seed_policy: None,
    });
    engine.emit_task(task.clone());
  }

  let events = events.lock().unwrap();
  assert_eq!(events.len(), 4);
  for event in events.iter() {
    let EngineEvent::TaskUpsert(payload) = event else {
      panic!("unexpected redaction event: {event:?}");
    };
    assert!(payload.task.final_path.is_none());
    let serialized = serde_json::to_string(payload).unwrap();
    for secret in [
      SECRET_URL,
      "Authorization",
      SECRET_AUTHORIZATION,
      "Cookie",
      SECRET_REFERENCE,
      SECRET_MAGNET,
      SECRET_TORRENT_URL,
      SECRET_TORRENT_BYTES,
      SECRET_FINAL_PATH,
    ] {
      assert!(!serialized.contains(secret), "event leaked {secret}");
    }
  }
  match &events[0] {
    EngineEvent::TaskUpsert(payload) => match &payload.task.source {
      DownloadSource::Http(source) => {
        assert_eq!(source.mirrors[0].url, "[redacted]");
        assert_eq!(source.mirrors[0].headers.len(), 2);
        assert!(source.mirrors[0].headers.values().all(|value| match value {
          HttpHeaderValue::Value { value } => value == "[redacted]",
          HttpHeaderValue::SecretRef { secret_ref } => secret_ref == "[redacted]",
        }));
      }
      DownloadSource::Torrent(_) => panic!("HTTP event changed its source variant"),
    },
    event => panic!("unexpected redaction event: {event:?}"),
  }
  for (event, expected_variant) in events[1..].iter().zip(["magnet", "url", "bytes"]) {
    let EngineEvent::TaskUpsert(payload) = event else {
      panic!("unexpected redaction event: {event:?}");
    };
    let DownloadSource::Torrent(source) = &payload.task.source else {
      panic!("torrent event changed its source variant");
    };
    match (&source.input, expected_variant) {
      (TorrentInput::Magnet { uri }, "magnet") => assert_eq!(uri, "[redacted]"),
      (TorrentInput::Url { url }, "url") => assert_eq!(url, "[redacted]"),
      (TorrentInput::Bytes { base64 }, "bytes") => assert_eq!(base64, "[redacted]"),
      _ => panic!("torrent input variant was not preserved"),
    }
  }
}

#[tokio::test]
async fn queue_mutations_emit_committed_tasks_and_wake_the_scheduler() {
  let root = TempDir::new().unwrap();
  let events = Arc::new(StdMutex::new(Vec::new()));
  let captured_events = events.clone();
  let engine = Engine::open(
    &root.path().join("downloader.sqlite"),
    &root.path().join("downloads"),
    None,
    move |event| captured_events.lock().unwrap().push(event),
  )
  .await
  .unwrap();
  let task = enqueue_test_task(&engine).await;
  engine.wake.notified().await;
  events.lock().unwrap().clear();

  let prioritized = engine.set_priority(&task.id, 10).await.unwrap();
  timeout(Duration::from_millis(50), engine.wake.notified())
    .await
    .expect("priority update did not wake the scheduler");
  assert_eq!(prioritized.priority, 10);
  {
    let mut events = events.lock().unwrap();
    assert_eq!(events.len(), 1);
    match events.remove(0) {
      EngineEvent::TaskUpsert(payload) => {
        assert_eq!(payload.task.id, task.id);
        assert_eq!(payload.task.priority, 10);
        assert_eq!(payload.revision, prioritized.revision);
      }
      event => panic!("unexpected priority event: {event:?}"),
    }
  }

  let moved = engine.move_queue(&task.id, None).await.unwrap();
  timeout(Duration::from_millis(50), engine.wake.notified())
    .await
    .expect("queue move did not wake the scheduler");
  {
    let mut events = events.lock().unwrap();
    assert_eq!(events.len(), 1);
    match events.remove(0) {
      EngineEvent::TaskUpsert(payload) => {
        assert_eq!(payload.task.id, task.id);
        assert_eq!(payload.task.queue_position, moved.queue_position);
        assert_eq!(payload.revision, moved.revision);
      }
      event => panic!("unexpected queue event: {event:?}"),
    }
  }

  assert!(engine.set_priority(&task.id, 0).await.is_err());
  assert!(
    timeout(Duration::from_millis(20), engine.wake.notified())
      .await
      .is_err()
  );
  assert!(events.lock().unwrap().is_empty());
}

#[tokio::test]
async fn updating_settings_wakes_the_scheduler_after_commit() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let mut settings = engine.repository.get_settings().await.unwrap();
  let old_revision = settings.revision;
  settings.max_active_tasks = 7;

  let updated = engine.update_settings(settings).await.unwrap();

  timeout(Duration::from_millis(50), engine.wake.notified())
    .await
    .expect("settings update did not wake the scheduler");
  assert_eq!(updated.max_active_tasks, 7);
  assert!(updated.revision > old_revision);
  let persisted = engine.repository.get_settings().await.unwrap();
  assert_eq!(persisted.max_active_tasks, 7);
  assert_eq!(persisted.revision, updated.revision);
}

#[tokio::test]
async fn enqueues_a_plan_atomically_with_collection_and_asset_keys() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let tasks = engine
    .enqueue_plan(EnqueuePlanInput {
      key: "comic:42".into(),
      title: "Example Comic".into(),
      assets: vec![asset("ep-1", "001.cbz", 10), asset("ep-2", "002.cbz", 20)],
      destination_id: None,
      priority: Some(8),
      refresh_context: None,
    })
    .await
    .unwrap();

  assert_eq!(tasks.len(), 2);
  assert_eq!(tasks[0].asset_key.as_deref(), Some("ep-1"));
  assert_eq!(tasks[1].asset_key.as_deref(), Some("ep-2"));
  assert!(tasks[0].queue_position < tasks[1].queue_position);
  let collections = engine.repository.list_collections().await.unwrap();
  assert_eq!(collections.len(), 1);
  assert_eq!(collections[0].task_count, 2);
  assert_eq!(collections[0].total_bytes, Some(30));
}

#[tokio::test]
async fn deleting_files_resets_all_resume_state_and_keeps_a_retryable_record() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;
  let final_path = PathBuf::from(task.final_path.as_deref().unwrap());
  let temp_path = PathBuf::from(format!("{}.part", final_path.display()));
  tokio::fs::create_dir_all(final_path.parent().unwrap())
    .await
    .unwrap();
  tokio::fs::write(&final_path, b"completed").await.unwrap();
  tokio::fs::write(&temp_path, b"partial").await.unwrap();
  engine
    .repository
    .update_probe(
      &task.id,
      Some(10),
      Some("\"etag-v1\""),
      Some("last-modified-v1"),
    )
    .await
    .unwrap();
  engine
    .repository
    .replace_completed_ranges(&task.id, &[CompletedRange { start: 0, end: 10 }])
    .await
    .unwrap();
  engine
    .repository
    .update_torrent_session(&task.id, Some("info-hash"), Some(7), 5, 2, Some(1))
    .await
    .unwrap();
  engine
    .repository
    .update_transfer_progress(&task.id, TaskStatus::Downloading, 10, 10, 20)
    .await
    .unwrap();
  engine
    .repository
    .set_status(&task.id, TaskStatus::Completed)
    .await
    .unwrap();

  engine.delete_files(&task.id).await.unwrap();

  assert!(!tokio::fs::try_exists(&final_path).await.unwrap());
  assert!(!tokio::fs::try_exists(&temp_path).await.unwrap());
  assert!(
    engine
      .repository
      .completed_ranges(&task.id)
      .await
      .unwrap()
      .is_empty()
  );
  assert!(
    engine
      .repository
      .torrent_detail(&task.id)
      .await
      .unwrap()
      .is_none()
  );
  let reset = engine.repository.get_task(&task.id).await.unwrap().unwrap();
  assert_eq!(reset.status, TaskStatus::Cancelled);
  assert_eq!(reset.downloaded_bytes, 0);
  assert_eq!(reset.speed_bytes_per_second, 0);
  assert_eq!(reset.retry_count, 0);
  assert!(reset.etag.is_none());
  assert!(reset.last_modified.is_none());
  assert!(reset.error_code.is_none());
  assert!(reset.error_message.is_none());
}

#[cfg(feature = "bittorrent")]
#[tokio::test]
async fn torrent_checksum_verifies_the_selected_downloaded_file() {
  use base64::{Engine as _, engine::general_purpose::STANDARD};
  use librqbit::CreateTorrentOptions;
  use sha2::{Digest, Sha256};

  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let payload = b"torrent checksum payload";
  let source_path = root.path().join("payload.bin");
  tokio::fs::write(&source_path, payload).await.unwrap();
  let spawner = librqbit::spawn_utils::BlockingSpawner::new(2);
  let torrent = librqbit::create_torrent(&source_path, CreateTorrentOptions::default(), &spawner)
    .await
    .unwrap();
  let task = engine
    .enqueue_plan(EnqueuePlanInput {
      key: "torrent:checksum".into(),
      title: "Torrent checksum".into(),
      assets: vec![DownloadAsset {
        key: "payload".into(),
        relative_path: "torrent-output".into(),
        size: Some(payload.len() as u64),
        checksum: Some(Checksum {
          algorithm: ChecksumAlgorithm::Sha256,
          value: hex::encode(Sha256::digest(payload)),
        }),
        source: DownloadSource::Torrent(TorrentSource {
          input: TorrentInput::Bytes {
            base64: STANDARD.encode(torrent.as_bytes().unwrap()),
          },
          only_files: Vec::new(),
          seed_policy: None,
        }),
      }],
      destination_id: None,
      priority: None,
      refresh_context: None,
    })
    .await
    .unwrap()
    .remove(0);
  let torrent_root = PathBuf::from(task.final_path.as_deref().unwrap());
  tokio::fs::create_dir_all(&torrent_root).await.unwrap();
  let downloaded_path = torrent_root.join("payload.bin");
  tokio::fs::write(&downloaded_path, payload).await.unwrap();

  engine
    .run_task_inner(
      &task,
      &engine.repository.get_settings().await.unwrap(),
      CancellationToken::new(),
      None,
    )
    .await
    .unwrap();

  assert!(tokio::fs::try_exists(&downloaded_path).await.unwrap());
  assert!(
    !tokio::fs::try_exists(PathBuf::from(format!("{}.part", torrent_root.display())))
      .await
      .unwrap()
  );
  engine
    .repository
    .set_status(&task.id, TaskStatus::Completed)
    .await
    .unwrap();
  engine.delete_files(&task.id).await.unwrap();
  assert!(!tokio::fs::try_exists(&downloaded_path).await.unwrap());
  assert!(
    engine
      .repository
      .torrent_session_identity(&task.id)
      .await
      .unwrap()
      .is_none()
  );
  engine.torrent.stop().await.unwrap();
}

#[tokio::test]
async fn rejects_a_plan_before_writing_any_partial_tasks() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let result = engine
    .enqueue_plan(EnqueuePlanInput {
      key: "comic:42".into(),
      title: "Example Comic".into(),
      assets: vec![asset("ep-1", "same.cbz", 10), asset("ep-2", "same.cbz", 20)],
      destination_id: None,
      priority: None,
      refresh_context: None,
    })
    .await;

  assert!(result.is_err());
  assert!(engine.repository.list_tasks().await.unwrap().is_empty());
  assert!(
    engine
      .repository
      .list_collections()
      .await
      .unwrap()
      .is_empty()
  );
}

#[tokio::test]
async fn reopens_interrupted_tasks_with_ranges_and_refresh_context() {
  let root = TempDir::new().unwrap();
  let first_engine = engine(&root).await;
  let refresh_context = ContentRefreshContext {
    plugin: "reader".into(),
    content_type: ["reader".into(), "comic".into()],
    content_id: "comic-42".into(),
    episode_id: "ep-7".into(),
    content_page_fingerprint: Some("sha256:content-page".into()),
    provider_fingerprint: "sha256:provider".into(),
    plugin_version: Some("1.2.3".into()),
    plugin_integrity: Some("sha256:archive".into()),
  };
  let tasks = first_engine
    .enqueue_plan(EnqueuePlanInput {
      key: "reader:comic-42".into(),
      title: "Persisted comic".into(),
      assets: vec![asset("ep-7", "007.cbz", 32)],
      destination_id: None,
      priority: Some(9),
      refresh_context: Some(refresh_context.clone()),
    })
    .await
    .unwrap();
  let task_id = tasks[0].id.clone();
  first_engine
    .repository
    .set_status(&task_id, TaskStatus::Downloading)
    .await
    .unwrap();
  first_engine
    .repository
    .replace_completed_ranges(
      &task_id,
      &[
        CompletedRange { start: 0, end: 8 },
        CompletedRange { start: 16, end: 24 },
      ],
    )
    .await
    .unwrap();
  first_engine.handle().checkpoint().await.unwrap();
  drop(first_engine);

  let reopened = engine(&root).await;
  let task = reopened
    .repository
    .get_task(&task_id)
    .await
    .unwrap()
    .unwrap();
  assert_eq!(task.status, TaskStatus::Queued);
  assert_eq!(task.priority, 9);
  assert_eq!(task.asset_key.as_deref(), Some("ep-7"));
  assert_eq!(
    reopened
      .repository
      .completed_ranges(&task_id)
      .await
      .unwrap(),
    vec![
      CompletedRange { start: 0, end: 8 },
      CompletedRange { start: 16, end: 24 },
    ]
  );
  let collections = reopened.repository.list_collections().await.unwrap();
  assert_eq!(collections.len(), 1);
  let restored_context = collections[0].refresh_context.as_ref().unwrap();
  assert_eq!(restored_context.plugin, refresh_context.plugin);
  assert_eq!(restored_context.content_type, refresh_context.content_type);
  assert_eq!(
    restored_context.content_page_fingerprint,
    refresh_context.content_page_fingerprint
  );
  assert_eq!(
    restored_context.provider_fingerprint,
    refresh_context.provider_fingerprint
  );
  assert_eq!(
    restored_context.plugin_version,
    refresh_context.plugin_version
  );
  assert_eq!(
    restored_context.plugin_integrity,
    refresh_context.plugin_integrity
  );
}

#[tokio::test]
async fn saf_completion_waits_for_native_export_and_preserves_failed_staging() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let destination = Destination {
    id: "saf-shared".into(),
    label: "Shared".into(),
    kind: DestinationKind::AndroidSaf,
    path: "content://provider/tree/primary%3ADownloads".into(),
    is_default: false,
  };
  engine
    .repository
    .register_destination(&destination)
    .await
    .unwrap();
  let task = engine
    .enqueue_plan(EnqueuePlanInput {
      key: "comic:saf".into(),
      title: "SAF comic".into(),
      assets: vec![asset("ep-1", "001.cbz", 4)],
      destination_id: Some(destination.id.clone()),
      priority: None,
      refresh_context: None,
    })
    .await
    .unwrap()
    .remove(0);
  let staging = PathBuf::from(task.final_path.as_ref().unwrap());
  tokio::fs::create_dir_all(staging.parent().unwrap())
    .await
    .unwrap();
  tokio::fs::write(&staging, b"data").await.unwrap();
  engine
    .repository
    .upsert_pending_saf_export(&task.id, &destination.id, &staging)
    .await
    .unwrap();
  engine
    .repository
    .set_status(&task.id, TaskStatus::Verifying)
    .await
    .unwrap();

  engine
    .fail_saf_export(&task.id, "provider is full")
    .await
    .unwrap();
  assert!(tokio::fs::try_exists(&staging).await.unwrap());
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Failed
  );

  engine
    .repository
    .set_status(&task.id, TaskStatus::Verifying)
    .await
    .unwrap();
  engine
      .complete_saf_export(
        &task.id,
        "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2FSAF%20comic%2F001.cbz",
      )
      .await
      .unwrap();
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Completed
  );
  assert!(
    !tokio::fs::try_exists(engine.staging_root.join(&task.id))
      .await
      .unwrap()
  );
}

#[tokio::test]
async fn direct_saf_transfer_persists_resume_identity_and_commit_state() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let destination = Destination {
    id: "saf-direct".into(),
    label: "Shared".into(),
    kind: DestinationKind::AndroidSaf,
    path: "content://provider/tree/primary%3ADownloads".into(),
    is_default: false,
  };
  engine
    .repository
    .register_destination(&destination)
    .await
    .unwrap();
  let mut direct_asset = asset("direct", "chapter.cbz", 4);
  let DownloadSource::Http(source) = &mut direct_asset.source else {
    unreachable!();
  };
  source.expires_at = Some(crate::persistence::now_millis() - 1);
  let task = engine
    .enqueue_plan(EnqueuePlanInput {
      key: "direct-plan".into(),
      title: "Direct".into(),
      assets: vec![direct_asset],
      destination_id: Some(destination.id.clone()),
      priority: None,
      refresh_context: None,
    })
    .await
    .unwrap()
    .remove(0);
  let partial_path = root.path().join("provider-document");
  let file = OpenOptions::new()
    .create(true)
    .truncate(false)
    .read(true)
    .write(true)
    .open(&partial_path)
    .unwrap();
  let document_uri =
    "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Fpartial";
  let result = engine
    .run_task_now_with_direct_saf(
      &task.id,
      DirectSafTarget {
        file: Arc::new(file),
        document_uri: document_uri.into(),
      },
    )
    .await;
  assert!(matches!(result, Err(Error::SourceExpired)));
  assert_eq!(
    engine
      .repository
      .saf_export_record(&task.id)
      .await
      .unwrap()
      .unwrap()
      .document_uri
      .as_deref(),
    Some(document_uri)
  );

  engine
    .repository
    .mark_direct_saf_ready(&task.id, document_uri)
    .await
    .unwrap();
  assert!(engine.finish_task_now(&task.id, Ok(())).await.is_err());
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::WaitingForSource
  );
  engine
    .repository
    .set_status(&task.id, TaskStatus::Queued)
    .await
    .unwrap();
  engine.resume_saf_commit(&task.id).await.unwrap();
  assert_eq!(
    engine
      .repository
      .get_task(&task.id)
      .await
      .unwrap()
      .unwrap()
      .status,
    TaskStatus::Verifying
  );
  engine.abandon_direct_saf_transfer(&task.id).await.unwrap();
  assert!(
    engine
      .repository
      .saf_export_record(&task.id)
      .await
      .unwrap()
      .is_none()
  );
}

#[tokio::test]
async fn external_file_deletion_runs_only_after_the_task_is_claimed() {
  let root = TempDir::new().unwrap();
  let engine = engine(&root).await;
  let task = enqueue_test_task(&engine).await;
  let final_path = PathBuf::from(task.final_path.as_ref().unwrap());
  tokio::fs::create_dir_all(final_path.parent().unwrap())
    .await
    .unwrap();
  tokio::fs::write(&final_path, b"keep").await.unwrap();
  engine
    .repository
    .set_status(&task.id, TaskStatus::Downloading)
    .await
    .unwrap();
  let called = Arc::new(std::sync::atomic::AtomicBool::new(false));
  let callback_called = called.clone();
  let result = engine
    .delete_files_with_external(&task.id, move |_, _| {
      callback_called.store(true, std::sync::atomic::Ordering::SeqCst);
      Ok(())
    })
    .await;
  assert!(result.is_err());
  assert!(!called.load(std::sync::atomic::Ordering::SeqCst));
  assert!(tokio::fs::try_exists(final_path).await.unwrap());
}
