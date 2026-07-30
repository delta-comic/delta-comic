use std::{collections::HashSet, path::Path};

use super::{
  CompletedRange, Repository, merge_ranges, missing_ranges, next_revision, now_millis,
  split_ranges, validate_saf_document_uri,
};
use crate::Error;
use crate::domain::{
  Destination, DestinationKind, DownloadSource, DownloadTask, DownloaderSettings, HttpSource,
  TaskKind, TaskStatus,
};

impl Repository {
  pub async fn set_status(&self, id: &str, status: TaskStatus) -> super::Result<DownloadTask> {
    self
        .mutate_task(
          id,
          "status = ?, speed_bytes_per_second = CASE WHEN ? IN ('downloading', 'seeding') THEN speed_bytes_per_second ELSE 0 END, error_code = NULL, error_message = NULL",
          &[status.as_db(), status.as_db()],
        )
        .await
  }

  async fn mutate_task(
    &self,
    id: &str,
    assignments: &str,
    text_bindings: &[&str],
  ) -> super::Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let sql = format!("UPDATE tasks SET {assignments}, updated_at = ?, revision = ? WHERE id = ?");
    let mut query = sqlx::query(&sql);
    for binding in text_bindings {
      query = query.bind(*binding);
    }
    let result = query
      .bind(now_millis())
      .bind(revision)
      .bind(id)
      .execute(&mut *transaction)
      .await?;
    if result.rows_affected() == 0 {
      return Err(Error::NotFound(id.to_string()));
    }
    transaction.commit().await?;
    self.require_task(id).await
  }
}

async fn initialized(repository: &Repository) {
  repository
    .initialize(
      &Destination {
        id: "default".into(),
        label: "Downloads".into(),
        kind: DestinationKind::Managed,
        path: "/tmp/downloads".into(),
        is_default: true,
      },
      &DownloaderSettings::platform_default(),
    )
    .await
    .unwrap();
}

fn task(id: impl Into<String>) -> DownloadTask {
  let id = id.into();
  let now = now_millis();
  DownloadTask {
    id: id.clone(),
    collection_key: None,
    asset_key: None,
    kind: TaskKind::Http,
    title: format!("{id}.bin"),
    source: DownloadSource::Http(HttpSource {
      mirrors: Vec::new(),
      expected_size: None,
      etag: None,
      last_modified: None,
      expires_at: None,
    }),
    destination_id: "default".into(),
    relative_path: format!("{id}.bin"),
    status: TaskStatus::Queued,
    priority: 5,
    queue_position: now,
    total_bytes: None,
    downloaded_bytes: 0,
    speed_bytes_per_second: 0,
    error_code: None,
    error_message: None,
    checksum: None,
    etag: None,
    last_modified: None,
    final_path: Some(format!("/tmp/downloads/{id}.bin")),
    retry_count: 0,
    created_at: now,
    updated_at: now,
    revision: 0,
  }
}

#[test]
fn merges_adjacent_and_overlapping_ranges() {
  assert_eq!(
    merge_ranges(vec![
      CompletedRange { start: 10, end: 20 },
      CompletedRange { start: 0, end: 10 },
      CompletedRange { start: 18, end: 25 },
    ]),
    vec![CompletedRange { start: 0, end: 25 }],
  );
}

#[test]
fn calculates_and_splits_missing_ranges() {
  let missing = missing_ranges(100, &[CompletedRange { start: 20, end: 40 }]);
  assert_eq!(
    missing,
    vec![
      CompletedRange { start: 0, end: 20 },
      CompletedRange {
        start: 40,
        end: 100
      }
    ]
  );
  assert_eq!(split_ranges(&missing, 4, 5).len(), 4);
}

#[tokio::test]
async fn persists_settings() {
  let repository = Repository::memory().await.unwrap();
  let destination = Destination {
    id: "default".into(),
    label: "Downloads".into(),
    kind: DestinationKind::Managed,
    path: "/tmp/downloads".into(),
    is_default: true,
  };
  let settings = DownloaderSettings::platform_default();
  repository
    .initialize(&destination, &settings)
    .await
    .unwrap();
  assert_eq!(
    repository.get_settings().await.unwrap().max_active_tasks,
    settings.max_active_tasks
  );
}

#[tokio::test]
async fn user_transitions_and_late_worker_updates_cannot_resurrect_terminal_state() {
  let repository = Repository::memory().await.unwrap();
  initialized(&repository).await;
  let mut task = task("state-machine");
  repository.insert_task(&mut task).await.unwrap();

  assert_eq!(
    repository.pause_task(&task.id).await.unwrap().status,
    TaskStatus::Paused
  );
  assert!(
    repository
      .update_probe(&task.id, Some(8), None, None)
      .await
      .is_err()
  );
  repository.resume_task(&task.id).await.unwrap();
  repository.begin_probe(&task.id).await.unwrap();
  repository
    .update_probe(&task.id, Some(8), None, None)
    .await
    .unwrap();
  repository.pause_task(&task.id).await.unwrap();
  assert!(repository.update_progress(&task.id, 4, 1).await.is_err());

  repository
    .set_status(&task.id, TaskStatus::Completed)
    .await
    .unwrap();
  assert!(repository.resume_task(&task.id).await.is_err());
  assert!(repository.retry_task(&task.id).await.is_err());
  assert!(repository.cancel_task(&task.id).await.is_err());
  assert_eq!(
    repository.get_task(&task.id).await.unwrap().unwrap().status,
    TaskStatus::Completed
  );
}

#[tokio::test]
async fn single_writer_pool_serializes_concurrent_revisions() {
  let root = tempfile::tempdir().unwrap();
  let repository = Repository::open(&root.path().join("downloader.sqlite"))
    .await
    .unwrap();
  initialized(&repository).await;
  let mut ids = Vec::new();
  for index in 0..24 {
    let mut task = task(format!("parallel-{index}"));
    ids.push(task.id.clone());
    repository.insert_task(&mut task).await.unwrap();
  }

  let handles = ids
    .into_iter()
    .map(|id| {
      let repository = repository.clone();
      tokio::spawn(async move { repository.set_priority(&id, 10).await.unwrap().revision })
    })
    .collect::<Vec<_>>();
  let mut revisions = HashSet::new();
  for handle in handles {
    assert!(revisions.insert(handle.await.unwrap()));
  }
  assert_eq!(revisions.len(), 24);
}

#[cfg(not(target_os = "android"))]
#[tokio::test]
async fn desktop_network_reprobe_waits_until_due_without_consuming_retries() {
  let repository = Repository::memory().await.unwrap();
  initialized(&repository).await;
  let mut task = task("offline");
  repository.insert_task(&mut task).await.unwrap();
  let waiting = repository
    .set_failure(&task.id, &Error::Network("connection failed"))
    .await
    .unwrap();
  assert_eq!(waiting.status, TaskStatus::WaitingForNetwork);
  assert_eq!(waiting.retry_count, 0);

  assert!(
    repository
      .requeue_due_network_tasks(waiting.updated_at.saturating_sub(1), 20)
      .await
      .unwrap()
      .is_empty()
  );
  let requeued = repository
    .requeue_due_network_tasks(waiting.updated_at, 20)
    .await
    .unwrap();
  assert_eq!(requeued.len(), 1);
  assert_eq!(requeued[0].status, TaskStatus::Queued);
  assert_eq!(requeued[0].retry_count, 0);
}

#[test]
fn accepts_only_documents_from_the_registered_saf_tree() {
  let tree = "content://provider/tree/primary%3ADownloads";
  assert!(
    validate_saf_document_uri(
      tree,
      "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Fcomic.cbz",
    )
    .is_ok()
  );
  for invalid in [
    tree,
    "content://other/tree/primary%3ADownloads/document/primary%3ADownloads%2Fcomic.cbz",
    "content://provider/tree/primary%3AOther/document/primary%3AOther%2Fcomic.cbz",
    "file:///tmp/comic.cbz",
  ] {
    assert!(validate_saf_document_uri(tree, invalid).is_err());
  }
}

#[tokio::test]
async fn persists_saf_export_until_native_commit() {
  let repository = Repository::memory().await.unwrap();
  let settings = DownloaderSettings::platform_default();
  repository
    .initialize(
      &Destination {
        id: "default".into(),
        label: "Downloads".into(),
        kind: DestinationKind::Managed,
        path: "/tmp/downloads".into(),
        is_default: true,
      },
      &settings,
    )
    .await
    .unwrap();
  let saf = Destination {
    id: "saf-test".into(),
    label: "Shared".into(),
    kind: DestinationKind::AndroidSaf,
    path: "content://provider/tree/primary%3ADownloads".into(),
    is_default: false,
  };
  repository.register_destination(&saf).await.unwrap();
  let now = now_millis();
  let mut task = DownloadTask {
    id: "saf-task".into(),
    collection_key: None,
    asset_key: None,
    kind: TaskKind::Http,
    title: "comic.cbz".into(),
    source: DownloadSource::Http(HttpSource {
      mirrors: Vec::new(),
      expected_size: None,
      etag: None,
      last_modified: None,
      expires_at: None,
    }),
    destination_id: saf.id.clone(),
    relative_path: "Comic/comic.cbz".into(),
    status: TaskStatus::Verifying,
    priority: 5,
    queue_position: now,
    total_bytes: Some(4),
    downloaded_bytes: 4,
    speed_bytes_per_second: 0,
    error_code: None,
    error_message: None,
    checksum: None,
    etag: None,
    last_modified: None,
    final_path: Some("/tmp/staging/comic.cbz".into()),
    retry_count: 0,
    created_at: now,
    updated_at: now,
    revision: 0,
  };
  repository.insert_task(&mut task).await.unwrap();
  repository
    .upsert_pending_saf_export(&task.id, &saf.id, Path::new("/tmp/staging/comic.cbz"))
    .await
    .unwrap();
  let instruction = repository
    .pending_saf_export(&task.id)
    .await
    .unwrap()
    .unwrap();
  assert_eq!(instruction.relative_path, "Comic/comic.cbz");
  assert!(!instruction.is_directory);

  let failed = repository
    .fail_saf_export(&task.id, "provider is full")
    .await
    .unwrap();
  assert_eq!(failed.status, TaskStatus::Failed);
  repository
    .set_status(&task.id, TaskStatus::Verifying)
    .await
    .unwrap();
  assert!(
    repository
      .complete_saf_export(
        &task.id,
        "content://provider/tree/primary%3AOther/document/primary%3AOther%2Fcomic.cbz",
      )
      .await
      .is_err()
  );
  let completed = repository
      .complete_saf_export(
        &task.id,
        "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2FComic%2Fcomic.cbz",
      )
      .await
      .unwrap();
  assert_eq!(completed.status, TaskStatus::Completed);
  assert_eq!(
    repository
      .saf_export_record(&task.id)
      .await
      .unwrap()
      .unwrap()
      .state,
    "completed"
  );
  repository.clear_saf_export(&task.id).await.unwrap();
  assert!(
    repository
      .saf_export_record(&task.id)
      .await
      .unwrap()
      .is_none()
  );
}

#[tokio::test]
async fn direct_saf_state_resumes_only_the_same_temporary_document() {
  let repository = Repository::memory().await.unwrap();
  initialized(&repository).await;
  let destination = Destination {
    id: "saf-direct".into(),
    label: "Shared".into(),
    kind: DestinationKind::AndroidSaf,
    path: "content://provider/tree/primary%3ADownloads".into(),
    is_default: false,
  };
  repository.register_destination(&destination).await.unwrap();
  let mut task = task("direct-task");
  task.destination_id = destination.id.clone();
  task.relative_path = "Comic/chapter.cbz".into();
  repository.insert_task(&mut task).await.unwrap();

  let initial = repository
    .direct_saf_instruction(&task.id)
    .await
    .unwrap()
    .unwrap();
  assert_eq!(initial.temporary_name, ".delta-direct-task.part");
  assert_eq!(initial.expected_length, task.total_bytes);
  assert_eq!(initial.temporary_document_uri, None);
  assert!(!initial.ready_to_commit);

  let first = "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Ffirst";
  repository
    .begin_direct_saf_transfer(&task.id, first)
    .await
    .unwrap();
  repository
    .replace_completed_ranges(&task.id, &[CompletedRange { start: 0, end: 4 }])
    .await
    .unwrap();
  repository
    .begin_direct_saf_transfer(&task.id, first)
    .await
    .unwrap();
  assert_eq!(
    repository.completed_ranges(&task.id).await.unwrap(),
    vec![CompletedRange { start: 0, end: 4 }]
  );
  repository
    .mark_direct_saf_ready(&task.id, first)
    .await
    .unwrap();
  let ready = repository
    .direct_saf_instruction(&task.id)
    .await
    .unwrap()
    .unwrap();
  assert_eq!(ready.temporary_document_uri.as_deref(), Some(first));
  assert!(ready.ready_to_commit);
  assert!(
    repository
      .pending_saf_export(&task.id)
      .await
      .unwrap()
      .is_none()
  );
  assert!(repository.has_pending_saf_commit(&task.id).await.unwrap());

  let replacement =
    "content://provider/tree/primary%3ADownloads/document/primary%3ADownloads%2Freplacement";
  repository
    .begin_direct_saf_transfer(&task.id, replacement)
    .await
    .unwrap();
  assert!(
    repository
      .completed_ranges(&task.id)
      .await
      .unwrap()
      .is_empty()
  );
  assert!(
    repository
      .begin_direct_saf_transfer(&task.id, "content://other/tree/root/document/outside",)
      .await
      .is_err()
  );
  repository
    .abandon_direct_saf_transfer(&task.id)
    .await
    .unwrap();
  assert!(!repository.has_pending_saf_commit(&task.id).await.unwrap());
}
