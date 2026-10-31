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

#[cfg(feature = "bittorrent")]
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
