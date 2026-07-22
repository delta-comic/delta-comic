use std::{path::Path, time::Duration};

use sqlx::{
  QueryBuilder, Row, Sqlite, SqlitePool, Transaction,
  sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
};

use crate::{
  domain::{
    Checksum, ChecksumAlgorithm, ContentRefreshContext, Destination, DownloadCollection,
    DownloadSource, DownloadTask, DownloaderSettings, TaskKind, TaskStatus, TorrentTaskDetail,
  },
  error::{Error, Result},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CompletedRange {
  pub start: u64,
  pub end: u64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct IntegritySample {
  pub start: u64,
  pub length: u64,
  pub sha256: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct TorrentSessionIdentity {
  pub info_hash: Option<String>,
  pub session_id: Option<u64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SafExportRecord {
  pub task_id: String,
  pub destination_id: String,
  pub staging_path: String,
  pub document_uri: Option<String>,
  pub state: String,
  pub error_message: Option<String>,
}

#[cfg(any(target_os = "android", test))]
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SafExportInstruction {
  pub tree_uri: String,
  pub relative_path: String,
  pub staging_path: String,
  pub is_directory: bool,
}

impl CompletedRange {
  pub fn new(start: u64, end: u64) -> Result<Self> {
    if start >= end {
      return Err(Error::InvalidInput(
        "completed range must not be empty".into(),
      ));
    }
    Ok(Self { start, end })
  }
}

#[derive(Clone)]
pub struct Repository {
  pool: SqlitePool,
  /// Every mutation is routed through this single-connection pool. SQLite
  /// still serves snapshots from `pool` concurrently under WAL, while writes
  /// are queued instead of contending across progress workers.
  writer: SqlitePool,
}

impl Repository {
  pub async fn open(path: &Path) -> Result<Self> {
    if let Some(parent) = path.parent() {
      tokio::fs::create_dir_all(parent).await?;
    }
    let options = SqliteConnectOptions::new()
      .filename(path)
      .create_if_missing(true)
      .foreign_keys(true)
      .journal_mode(SqliteJournalMode::Wal)
      .synchronous(SqliteSynchronous::Normal)
      .busy_timeout(Duration::from_secs(5));
    let writer = SqlitePoolOptions::new()
      .min_connections(1)
      .max_connections(1)
      .connect_with(options.clone())
      .await?;
    let pool = SqlitePoolOptions::new()
      .min_connections(1)
      .max_connections(4)
      .connect_with(options)
      .await?;
    sqlx::raw_sql(include_str!("../migrations/0001_init.sql"))
      .execute(&writer)
      .await?;
    sqlx::raw_sql(include_str!("../migrations/0002_integrity_samples.sql"))
      .execute(&writer)
      .await?;
    sqlx::raw_sql(include_str!("../migrations/0003_saf_exports.sql"))
      .execute(&writer)
      .await?;
    Ok(Self { pool, writer })
  }

  pub(crate) async fn memory() -> Result<Self> {
    let options = "sqlite::memory:"
      .parse::<SqliteConnectOptions>()?
      .foreign_keys(true)
      .journal_mode(SqliteJournalMode::Memory);
    let pool = SqlitePoolOptions::new()
      .max_connections(1)
      .connect_with(options)
      .await?;
    sqlx::raw_sql(include_str!("../migrations/0001_init.sql"))
      .execute(&pool)
      .await?;
    sqlx::raw_sql(include_str!("../migrations/0002_integrity_samples.sql"))
      .execute(&pool)
      .await?;
    sqlx::raw_sql(include_str!("../migrations/0003_saf_exports.sql"))
      .execute(&pool)
      .await?;
    Ok(Self {
      writer: pool.clone(),
      pool,
    })
  }

  pub async fn initialize(
    &self,
    default_destination: &Destination,
    settings: &DownloaderSettings,
  ) -> Result<()> {
    sqlx::query(
      "INSERT OR IGNORE INTO destinations(id, label, kind, path, is_default, created_at) \
       VALUES (?, ?, ?, ?, 1, ?)",
    )
    .bind(&default_destination.id)
    .bind(&default_destination.label)
    .bind(default_destination.kind.as_db())
    .bind(&default_destination.path)
    .bind(now_millis())
    .execute(&self.writer)
    .await?;
    sqlx::query(
      "INSERT OR IGNORE INTO settings(\
         id, max_active_tasks, connection_budget, per_task_connections, allow_metered, \
         seed_on_complete, seed_ratio, seed_seconds, revision\
       ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 0)",
    )
    .bind(i64::from(settings.max_active_tasks))
    .bind(i64::from(settings.connection_budget))
    .bind(i64::from(settings.per_task_connections))
    .bind(settings.allow_metered)
    .bind(settings.seed_on_complete)
    .bind(settings.seed_ratio)
    .bind(settings.seed_seconds.map(to_i64).transpose()?)
    .execute(&self.writer)
    .await?;
    self.restore_interrupted_tasks().await?;
    Ok(())
  }

  async fn restore_interrupted_tasks(&self) -> Result<()> {
    sqlx::query(
      "UPDATE tasks SET status = 'queued', speed_bytes_per_second = 0, updated_at = ? \
       WHERE status IN ('probing', 'downloading', 'verifying', 'seeding')",
    )
    .bind(now_millis())
    .execute(&self.writer)
    .await?;
    Ok(())
  }

  pub async fn insert_task(&self, task: &mut DownloadTask) -> Result<()> {
    let mut transaction = self.writer.begin().await?;
    insert_task_row(&mut transaction, task).await?;
    transaction.commit().await?;
    Ok(())
  }

  pub async fn insert_collection_tasks(
    &self,
    key: &str,
    title: &str,
    destination_id: &str,
    refresh_context: Option<&ContentRefreshContext>,
    tasks: &mut [DownloadTask],
  ) -> Result<()> {
    let mut transaction = self.writer.begin().await?;
    sqlx::query(
      "INSERT INTO collections(\
         key, title, destination_id, refresh_context_json, created_at\
       ) VALUES (?, ?, ?, ?, ?) \
       ON CONFLICT(key) DO UPDATE SET title = excluded.title, \
       destination_id = excluded.destination_id, \
       refresh_context_json = excluded.refresh_context_json",
    )
    .bind(key)
    .bind(title)
    .bind(destination_id)
    .bind(refresh_context.map(serde_json::to_string).transpose()?)
    .bind(now_millis())
    .execute(&mut *transaction)
    .await?;
    for task in tasks {
      insert_task_row(&mut transaction, task).await?;
    }
    transaction.commit().await?;
    Ok(())
  }

  pub async fn list_tasks(&self) -> Result<Vec<DownloadTask>> {
    let rows =
      sqlx::query("SELECT * FROM tasks ORDER BY priority DESC, queue_position ASC, created_at ASC")
        .fetch_all(&self.pool)
        .await?;
    rows.iter().map(task_from_row).collect()
  }

  pub async fn get_task(&self, id: &str) -> Result<Option<DownloadTask>> {
    let row = sqlx::query("SELECT * FROM tasks WHERE id = ?")
      .bind(id)
      .fetch_optional(&self.pool)
      .await?;
    row.as_ref().map(task_from_row).transpose()
  }

  pub async fn list_collections(&self) -> Result<Vec<DownloadCollection>> {
    let rows = sqlx::query(
      "SELECT c.key, c.title, c.destination_id, c.refresh_context_json, c.created_at, \
       COUNT(t.id) AS task_count, \
       SUM(CASE WHEN t.status = 'completed' THEN 1 ELSE 0 END) AS completed_tasks, \
       CASE WHEN COUNT(t.id) = COUNT(t.total_bytes) THEN SUM(t.total_bytes) END AS total_bytes, \
       COALESCE(SUM(t.downloaded_bytes), 0) AS downloaded_bytes \
       FROM collections c LEFT JOIN tasks t ON t.collection_key = c.key \
       GROUP BY c.key, c.title, c.destination_id, c.refresh_context_json, c.created_at \
       ORDER BY c.created_at DESC",
    )
    .fetch_all(&self.pool)
    .await?;
    rows
      .into_iter()
      .map(|row| {
        Ok(DownloadCollection {
          key: row.try_get("key")?,
          title: row.try_get("title")?,
          destination_id: row.try_get("destination_id")?,
          refresh_context: row
            .try_get::<Option<String>, _>("refresh_context_json")?
            .map(|value| serde_json::from_str(&value))
            .transpose()?,
          task_count: to_u64(row.try_get("task_count")?)?,
          completed_tasks: to_u64(row.try_get("completed_tasks")?)?,
          total_bytes: row
            .try_get::<Option<i64>, _>("total_bytes")?
            .map(to_u64)
            .transpose()?,
          downloaded_bytes: to_u64(row.try_get("downloaded_bytes")?)?,
          created_at: row.try_get("created_at")?,
        })
      })
      .collect()
  }

  pub async fn list_destinations(&self) -> Result<Vec<Destination>> {
    let rows = sqlx::query(
      "SELECT id, label, kind, path, is_default FROM destinations ORDER BY is_default DESC, created_at",
    )
    .fetch_all(&self.pool)
    .await?;
    rows
      .into_iter()
      .map(|row| {
        Ok(Destination {
          id: row.try_get("id")?,
          label: row.try_get("label")?,
          kind: crate::domain::DestinationKind::from_db(row.try_get("kind")?)?,
          path: row.try_get("path")?,
          is_default: row.try_get("is_default")?,
        })
      })
      .collect()
  }

  pub(crate) async fn destination(&self, id: &str) -> Result<Destination> {
    let row =
      sqlx::query("SELECT id, label, kind, path, is_default FROM destinations WHERE id = ?")
        .bind(id)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| Error::InvalidInput(format!("unknown destination: {id}")))?;
    Ok(Destination {
      id: row.try_get("id")?,
      label: row.try_get("label")?,
      kind: crate::domain::DestinationKind::from_db(row.try_get("kind")?)?,
      path: row.try_get("path")?,
      is_default: row.try_get("is_default")?,
    })
  }

  pub async fn next_queued(&self, limit: usize) -> Result<Vec<DownloadTask>> {
    let rows = sqlx::query(
      "SELECT * FROM tasks WHERE status = 'queued' \
       ORDER BY priority DESC, queue_position ASC, created_at ASC LIMIT ?",
    )
    .bind(i64::try_from(limit).unwrap_or(i64::MAX))
    .fetch_all(&self.pool)
    .await?;
    rows.iter().map(task_from_row).collect()
  }

  pub async fn count_active(&self) -> Result<u64> {
    let count: i64 = sqlx::query_scalar(
      "SELECT COUNT(*) FROM tasks WHERE status IN (\
         'queued', 'probing', 'downloading', 'waiting_for_network', 'waiting_for_source', \
         'verifying', 'seeding'\
       )",
    )
    .fetch_one(&self.pool)
    .await?;
    Ok(count.max(0) as u64)
  }

  pub async fn get_settings(&self) -> Result<DownloaderSettings> {
    let row = sqlx::query("SELECT * FROM settings WHERE id = 1")
      .fetch_one(&self.pool)
      .await?;
    Ok(DownloaderSettings {
      max_active_tasks: to_u8(row.try_get::<i64, _>("max_active_tasks")?)?,
      connection_budget: to_u16(row.try_get::<i64, _>("connection_budget")?)?,
      per_task_connections: to_u8(row.try_get::<i64, _>("per_task_connections")?)?,
      allow_metered: row.try_get("allow_metered")?,
      seed_on_complete: row.try_get("seed_on_complete")?,
      seed_ratio: row.try_get("seed_ratio")?,
      seed_seconds: row
        .try_get::<Option<i64>, _>("seed_seconds")?
        .map(to_u64)
        .transpose()?,
      revision: row.try_get("revision")?,
    })
  }

  pub async fn update_settings(&self, settings: &mut DownloaderSettings) -> Result<()> {
    settings.validate()?;
    let mut transaction = self.writer.begin().await?;
    settings.revision = next_revision(&mut transaction).await?;
    sqlx::query(
      "UPDATE settings SET max_active_tasks = ?, connection_budget = ?, \
       per_task_connections = ?, allow_metered = ?, seed_on_complete = ?, seed_ratio = ?, \
       seed_seconds = ?, revision = ? WHERE id = 1",
    )
    .bind(i64::from(settings.max_active_tasks))
    .bind(i64::from(settings.connection_budget))
    .bind(i64::from(settings.per_task_connections))
    .bind(settings.allow_metered)
    .bind(settings.seed_on_complete)
    .bind(settings.seed_ratio)
    .bind(settings.seed_seconds.map(to_i64).transpose()?)
    .bind(settings.revision)
    .execute(&mut *transaction)
    .await?;
    transaction.commit().await?;
    Ok(())
  }

  pub(crate) async fn upsert_pending_saf_export(
    &self,
    task_id: &str,
    destination_id: &str,
    staging_path: &Path,
  ) -> Result<()> {
    sqlx::query(
      "INSERT INTO saf_exports(\
         task_id, destination_id, staging_path, document_uri, state, error_message, updated_at\
       ) VALUES (?, ?, ?, NULL, 'pending', NULL, ?) \
       ON CONFLICT(task_id) DO UPDATE SET destination_id = excluded.destination_id, \
       staging_path = excluded.staging_path, document_uri = NULL, state = 'pending', \
       error_message = NULL, updated_at = excluded.updated_at",
    )
    .bind(task_id)
    .bind(destination_id)
    .bind(staging_path.to_string_lossy().as_ref())
    .bind(now_millis())
    .execute(&self.writer)
    .await?;
    Ok(())
  }

  pub(crate) async fn saf_export_record(&self, task_id: &str) -> Result<Option<SafExportRecord>> {
    let row = sqlx::query(
      "SELECT task_id, destination_id, staging_path, document_uri, state, error_message \
       FROM saf_exports WHERE task_id = ?",
    )
    .bind(task_id)
    .fetch_optional(&self.pool)
    .await?;
    row
      .map(|row| {
        Ok(SafExportRecord {
          task_id: row.try_get("task_id")?,
          destination_id: row.try_get("destination_id")?,
          staging_path: row.try_get("staging_path")?,
          document_uri: row.try_get("document_uri")?,
          state: row.try_get("state")?,
          error_message: row.try_get("error_message")?,
        })
      })
      .transpose()
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn pending_saf_export(
    &self,
    task_id: &str,
  ) -> Result<Option<SafExportInstruction>> {
    let row = sqlx::query(
      "SELECT d.path AS tree_uri, t.relative_path, e.staging_path, t.kind \
       FROM saf_exports e \
       JOIN tasks t ON t.id = e.task_id AND t.destination_id = e.destination_id \
       JOIN destinations d ON d.id = e.destination_id \
       WHERE e.task_id = ? AND e.state = 'pending' AND d.kind = 'android_saf'",
    )
    .bind(task_id)
    .fetch_optional(&self.pool)
    .await?;
    row
      .map(|row| {
        let kind: String = row.try_get("kind")?;
        Ok(SafExportInstruction {
          tree_uri: row.try_get("tree_uri")?,
          relative_path: row.try_get("relative_path")?,
          staging_path: row.try_get("staging_path")?,
          is_directory: kind == TaskKind::Torrent.as_db(),
        })
      })
      .transpose()
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn clear_saf_export(&self, task_id: &str) -> Result<()> {
    sqlx::query("DELETE FROM saf_exports WHERE task_id = ?")
      .bind(task_id)
      .execute(&self.writer)
      .await?;
    Ok(())
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn fail_saf_export(&self, task_id: &str, message: &str) -> Result<DownloadTask> {
    sqlx::query(
      "UPDATE saf_exports SET state = 'pending', error_message = ?, updated_at = ? \
       WHERE task_id = ?",
    )
    .bind(message)
    .bind(now_millis())
    .bind(task_id)
    .execute(&self.writer)
    .await?;
    self
      .set_failure(task_id, &Error::DestinationExport(message.to_owned()))
      .await
  }

  #[cfg(any(target_os = "android", test))]
  pub(crate) async fn complete_saf_export(
    &self,
    task_id: &str,
    document_uri: &str,
  ) -> Result<DownloadTask> {
    let tree_uri: String = sqlx::query_scalar(
      "SELECT d.path FROM saf_exports e \
       JOIN destinations d ON d.id = e.destination_id \
       WHERE e.task_id = ? AND e.state = 'pending' AND d.kind = 'android_saf'",
    )
    .bind(task_id)
    .fetch_optional(&self.pool)
    .await?
    .ok_or_else(|| Error::InvalidInput("SAF export record is missing or invalid".into()))?;
    validate_saf_document_uri(&tree_uri, document_uri)?;
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let task_result = sqlx::query(
      "UPDATE tasks SET status = 'completed', speed_bytes_per_second = 0, \
       error_code = NULL, error_message = NULL, updated_at = ?, revision = ? \
       WHERE id = ? AND status IN ('probing', 'downloading', 'verifying', 'seeding')",
    )
    .bind(now_millis())
    .bind(revision)
    .bind(task_id)
    .execute(&mut *transaction)
    .await?;
    if task_result.rows_affected() != 1 {
      transaction.rollback().await?;
      return Err(Error::InvalidInput(
        "SAF export cannot complete a task that is no longer active".into(),
      ));
    }
    let export_result = sqlx::query(
      "UPDATE saf_exports SET document_uri = ?, state = 'completed', error_message = NULL, \
       updated_at = ? WHERE task_id = ? AND state = 'pending'",
    )
    .bind(document_uri)
    .bind(now_millis())
    .bind(task_id)
    .execute(&mut *transaction)
    .await?;
    if export_result.rows_affected() != 1 {
      transaction.rollback().await?;
      return Err(Error::InvalidInput(
        "SAF export record is missing or already committed".into(),
      ));
    }
    transaction.commit().await?;
    self.require_task(task_id).await
  }

  pub async fn register_destination(&self, destination: &Destination) -> Result<()> {
    if destination.is_default {
      return Err(Error::InvalidInput(
        "the default destination cannot be replaced".into(),
      ));
    }
    if destination.id.trim().is_empty()
      || destination.id == "default"
      || destination.id.len() > 128
      || !destination
        .id
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    {
      return Err(Error::InvalidInput(
        "destination id must be a safe non-default identifier".into(),
      ));
    }
    if destination.label.trim().is_empty() || destination.label.len() > 256 {
      return Err(Error::InvalidInput(
        "destination label must not be empty or oversized".into(),
      ));
    }
    let path = match destination.kind {
      crate::domain::DestinationKind::DesktopDirectory => {
        #[cfg(target_os = "android")]
        {
          return Err(Error::InvalidInput(
            "desktop destinations are unavailable on Android".into(),
          ));
        }
        #[cfg(not(target_os = "android"))]
        {
          let path = tokio::fs::canonicalize(&destination.path)
            .await
            .map_err(|_| Error::InvalidInput("destination directory does not exist".into()))?;
          if !tokio::fs::metadata(&path).await?.is_dir() {
            return Err(Error::InvalidInput(
              "destination path must be a directory".into(),
            ));
          }
          path.to_string_lossy().into_owned()
        }
      }
      crate::domain::DestinationKind::AndroidSaf => {
        if !destination.path.starts_with("content://") {
          return Err(Error::InvalidInput(
            "Android SAF destinations must use a content URI".into(),
          ));
        }
        destination.path.clone()
      }
      crate::domain::DestinationKind::Managed => {
        return Err(Error::InvalidInput(
          "managed destination is reserved for the platform default".into(),
        ));
      }
    };
    sqlx::query(
      "INSERT INTO destinations(id, label, kind, path, is_default, created_at) \
       VALUES (?, ?, ?, ?, 0, ?) \
       ON CONFLICT(id) DO UPDATE SET label = excluded.label, kind = excluded.kind, path = excluded.path",
    )
    .bind(&destination.id)
    .bind(&destination.label)
    .bind(destination.kind.as_db())
    .bind(path)
    .bind(now_millis())
    .execute(&self.writer)
    .await?;
    Ok(())
  }

  #[cfg(test)]
  pub async fn set_status(&self, id: &str, status: TaskStatus) -> Result<DownloadTask> {
    self
      .mutate_task(
        id,
        "status = ?, speed_bytes_per_second = CASE WHEN ? IN ('downloading', 'seeding') THEN speed_bytes_per_second ELSE 0 END, error_code = NULL, error_message = NULL",
        &[status.as_db(), status.as_db()],
      )
      .await
  }

  pub async fn pause_task(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(
        id,
        TaskStatus::Paused,
        &[
          TaskStatus::Queued,
          TaskStatus::Probing,
          TaskStatus::Downloading,
          TaskStatus::WaitingForNetwork,
          TaskStatus::WaitingForSource,
          TaskStatus::Paused,
          TaskStatus::Verifying,
          TaskStatus::Seeding,
        ],
        "pause",
      )
      .await
  }

  pub async fn resume_task(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(
        id,
        TaskStatus::Queued,
        &[
          TaskStatus::Queued,
          TaskStatus::WaitingForNetwork,
          TaskStatus::Paused,
        ],
        "resume",
      )
      .await
  }

  pub async fn retry_task(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(
        id,
        TaskStatus::Queued,
        &[
          TaskStatus::Queued,
          TaskStatus::Failed,
          TaskStatus::Cancelled,
        ],
        "retry",
      )
      .await
  }

  pub async fn cancel_task(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(
        id,
        TaskStatus::Cancelled,
        &[
          TaskStatus::Queued,
          TaskStatus::Probing,
          TaskStatus::Downloading,
          TaskStatus::WaitingForNetwork,
          TaskStatus::WaitingForSource,
          TaskStatus::Paused,
          TaskStatus::Verifying,
          TaskStatus::Seeding,
          TaskStatus::Failed,
          TaskStatus::Cancelled,
        ],
        "cancel",
      )
      .await
  }

  pub async fn begin_probe(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(id, TaskStatus::Probing, &[TaskStatus::Queued], "start")
      .await
  }

  pub async fn begin_verification(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(
        id,
        TaskStatus::Verifying,
        &[
          TaskStatus::Probing,
          TaskStatus::Downloading,
          TaskStatus::Verifying,
          TaskStatus::Seeding,
        ],
        "verify",
      )
      .await
  }

  #[cfg(any(target_os = "android", test))]
  pub async fn resume_pending_export(&self, id: &str) -> Result<DownloadTask> {
    self
      .transition_status(
        id,
        TaskStatus::Verifying,
        &[
          TaskStatus::Queued,
          TaskStatus::Probing,
          TaskStatus::Downloading,
          TaskStatus::Verifying,
          TaskStatus::Seeding,
        ],
        "resume destination export",
      )
      .await
  }

  pub async fn complete_if_active(&self, id: &str) -> Result<Option<DownloadTask>> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET status = 'completed', speed_bytes_per_second = 0, \
       error_code = NULL, error_message = NULL, updated_at = ?, revision = ? \
       WHERE id = ? AND status IN ('probing', 'downloading', 'verifying', 'seeding')",
    )
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    if result.rows_affected() == 0 {
      transaction.rollback().await?;
      return if self.get_task(id).await?.is_some() {
        Ok(None)
      } else {
        Err(Error::NotFound(id.to_string()))
      };
    }
    transaction.commit().await?;
    self.require_task(id).await.map(Some)
  }

  pub async fn requeue_after_system_stop(&self, id: &str) -> Result<Option<DownloadTask>> {
    self
      .conditional_requeue(
        id,
        "UPDATE tasks SET status = 'queued', speed_bytes_per_second = 0, \
         error_code = NULL, error_message = NULL, updated_at = ?, revision = ? \
         WHERE id = ? AND status IN (\
           'probing', 'downloading', 'waiting_for_network', 'verifying', 'seeding'\
         )",
      )
      .await
  }

  #[cfg(any(target_os = "android", test))]
  pub async fn requeue_waiting_for_network(&self, id: &str) -> Result<Option<DownloadTask>> {
    self
      .conditional_requeue(
        id,
        "UPDATE tasks SET status = 'queued', speed_bytes_per_second = 0, \
         error_code = NULL, error_message = NULL, updated_at = ?, revision = ? \
         WHERE id = ? AND status = 'waiting_for_network'",
      )
      .await
  }

  #[cfg(not(target_os = "android"))]
  pub async fn requeue_due_network_tasks(
    &self,
    updated_before: i64,
    limit: usize,
  ) -> Result<Vec<DownloadTask>> {
    if limit == 0 {
      return Ok(Vec::new());
    }
    let mut transaction = self.writer.begin().await?;
    let ids = sqlx::query_scalar::<_, String>(
      "SELECT id FROM tasks WHERE status = 'waiting_for_network' AND updated_at <= ? \
       ORDER BY priority DESC, queue_position ASC LIMIT ?",
    )
    .bind(updated_before)
    .bind(i64::try_from(limit).unwrap_or(i64::MAX))
    .fetch_all(&mut *transaction)
    .await?;
    let mut committed = Vec::with_capacity(ids.len());
    for id in ids {
      let revision = next_revision(&mut transaction).await?;
      let result = sqlx::query(
        "UPDATE tasks SET status = 'queued', speed_bytes_per_second = 0, \
         error_code = NULL, error_message = NULL, updated_at = ?, revision = ? \
         WHERE id = ? AND status = 'waiting_for_network' AND updated_at <= ?",
      )
      .bind(now_millis())
      .bind(revision)
      .bind(&id)
      .bind(updated_before)
      .execute(&mut *transaction)
      .await?;
      if result.rows_affected() == 1 {
        committed.push(id);
      }
    }
    transaction.commit().await?;
    let mut tasks = Vec::with_capacity(committed.len());
    for id in committed {
      tasks.push(self.require_task(&id).await?);
    }
    Ok(tasks)
  }

  async fn conditional_requeue(
    &self,
    id: &str,
    statement: &'static str,
  ) -> Result<Option<DownloadTask>> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(statement)
      .bind(now_millis())
      .bind(revision)
      .bind(id)
      .execute(&mut *transaction)
      .await?;
    if result.rows_affected() == 0 {
      transaction.rollback().await?;
      return if self.get_task(id).await?.is_some() {
        Ok(None)
      } else {
        Err(Error::NotFound(id.to_string()))
      };
    }
    transaction.commit().await?;
    self.require_task(id).await.map(Some)
  }

  pub async fn set_failure(&self, id: &str, error: &Error) -> Result<DownloadTask> {
    let status = match error {
      Error::SourceExpired => TaskStatus::WaitingForSource,
      Error::Network(_) => TaskStatus::WaitingForNetwork,
      Error::Cancelled => TaskStatus::Paused,
      _ => TaskStatus::Failed,
    };
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET status = ?, error_code = ?, error_message = ?, \
       speed_bytes_per_second = 0, updated_at = ?, revision = ? WHERE id = ? \
       AND status IN ('queued', 'probing', 'downloading', 'verifying', 'seeding')",
    )
    .bind(status.as_db())
    .bind(error.code())
    .bind(error.to_string())
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    ensure_task_mutated(
      &mut transaction,
      result.rows_affected(),
      id,
      "record a worker failure for",
    )
    .await?;
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn record_retry(
    &self,
    id: &str,
    retry_count: u8,
    error: &Error,
  ) -> Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET retry_count = ?, error_code = ?, error_message = ?, updated_at = ?, \
       revision = ? WHERE id = ? \
       AND status IN ('probing', 'downloading', 'verifying', 'seeding')",
    )
    .bind(i64::from(retry_count))
    .bind(error.code())
    .bind(error.to_string())
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    ensure_task_mutated(
      &mut transaction,
      result.rows_affected(),
      id,
      "record a retry for",
    )
    .await?;
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn update_probe(
    &self,
    id: &str,
    total_bytes: Option<u64>,
    etag: Option<&str>,
    last_modified: Option<&str>,
  ) -> Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET total_bytes = ?, etag = ?, last_modified = ?, status = 'downloading', \
       updated_at = ?, revision = ? WHERE id = ? \
       AND status IN ('queued', 'probing', 'downloading')",
    )
    .bind(total_bytes.map(to_i64).transpose()?)
    .bind(etag)
    .bind(last_modified)
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    ensure_task_mutated(
      &mut transaction,
      result.rows_affected(),
      id,
      "commit a probe for",
    )
    .await?;
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn update_progress(
    &self,
    id: &str,
    downloaded: u64,
    speed: u64,
  ) -> Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET downloaded_bytes = ?, speed_bytes_per_second = ?, updated_at = ?, \
       revision = ? WHERE id = ? AND status = 'downloading'",
    )
    .bind(to_i64(downloaded)?)
    .bind(to_i64(speed)?)
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    ensure_task_mutated(
      &mut transaction,
      result.rows_affected(),
      id,
      "commit HTTP progress for",
    )
    .await?;
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn update_transfer_progress(
    &self,
    id: &str,
    status: TaskStatus,
    total: u64,
    downloaded: u64,
    speed: u64,
  ) -> Result<DownloadTask> {
    if !matches!(status, TaskStatus::Downloading | TaskStatus::Seeding) {
      return Err(Error::InvalidInput(
        "torrent progress status must be downloading or seeding".into(),
      ));
    }
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET status = ?, total_bytes = ?, downloaded_bytes = ?, \
       speed_bytes_per_second = ?, error_code = NULL, error_message = NULL, updated_at = ?, \
       revision = ? WHERE id = ? AND status IN ('probing', 'downloading', 'seeding')",
    )
    .bind(status.as_db())
    .bind(to_i64(total)?)
    .bind(to_i64(downloaded)?)
    .bind(to_i64(speed)?)
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    ensure_task_mutated(
      &mut transaction,
      result.rows_affected(),
      id,
      "commit torrent progress for",
    )
    .await?;
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn set_paths(&self, id: &str, final_path: &Path, temp_path: &Path) -> Result<()> {
    sqlx::query("UPDATE tasks SET final_path = ?, temp_path = ? WHERE id = ?")
      .bind(final_path.to_string_lossy().as_ref())
      .bind(temp_path.to_string_lossy().as_ref())
      .bind(id)
      .execute(&self.writer)
      .await?;
    Ok(())
  }

  pub async fn completed_ranges(&self, task_id: &str) -> Result<Vec<CompletedRange>> {
    let rows = sqlx::query(
      "SELECT start_offset, committed_end FROM segments \
       WHERE task_id = ? AND committed_end > start_offset ORDER BY start_offset",
    )
    .bind(task_id)
    .fetch_all(&self.pool)
    .await?;
    let mut ranges = Vec::with_capacity(rows.len());
    for row in rows {
      ranges.push(CompletedRange::new(
        to_u64(row.try_get("start_offset")?)?,
        to_u64(row.try_get("committed_end")?)?,
      )?);
    }
    Ok(merge_ranges(ranges))
  }

  pub async fn replace_completed_ranges(
    &self,
    task_id: &str,
    ranges: &[CompletedRange],
  ) -> Result<()> {
    let ranges = merge_ranges(ranges.to_vec());
    let mut transaction = self.writer.begin().await?;
    sqlx::query("DELETE FROM segments WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    for range in ranges {
      sqlx::query(
        "INSERT INTO segments(task_id, start_offset, end_offset, committed_end, state, updated_at) \
         VALUES (?, ?, ?, ?, 'completed', ?)",
      )
      .bind(task_id)
      .bind(to_i64(range.start)?)
      .bind(to_i64(range.end)?)
      .bind(to_i64(range.end)?)
      .bind(now_millis())
      .execute(&mut *transaction)
      .await?;
    }
    transaction.commit().await?;
    Ok(())
  }

  pub async fn integrity_samples(&self, task_id: &str) -> Result<Vec<IntegritySample>> {
    let rows = sqlx::query(
      "SELECT start_offset, length, sha256 FROM integrity_samples \
       WHERE task_id = ? ORDER BY start_offset",
    )
    .bind(task_id)
    .fetch_all(&self.pool)
    .await?;
    rows
      .into_iter()
      .map(|row| {
        Ok(IntegritySample {
          start: to_u64(row.try_get("start_offset")?)?,
          length: to_u64(row.try_get("length")?)?,
          sha256: row.try_get("sha256")?,
        })
      })
      .collect()
  }

  pub async fn replace_integrity_samples(
    &self,
    task_id: &str,
    samples: &[IntegritySample],
  ) -> Result<()> {
    let mut transaction = self.writer.begin().await?;
    sqlx::query("DELETE FROM integrity_samples WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    for sample in samples {
      if sample.length == 0 {
        continue;
      }
      sqlx::query(
        "INSERT INTO integrity_samples(task_id, start_offset, length, sha256) \
         VALUES (?, ?, ?, ?)",
      )
      .bind(task_id)
      .bind(to_i64(sample.start)?)
      .bind(to_i64(sample.length)?)
      .bind(&sample.sha256)
      .execute(&mut *transaction)
      .await?;
    }
    transaction.commit().await?;
    Ok(())
  }

  pub async fn update_torrent_session(
    &self,
    task_id: &str,
    info_hash: Option<&str>,
    session_id: Option<u64>,
    uploaded_bytes: u64,
    peer_count: u64,
    seed_started_at: Option<i64>,
  ) -> Result<()> {
    sqlx::query(
      "INSERT INTO torrent_sessions(\
         task_id, info_hash, session_id, uploaded_bytes, peer_count, seed_started_at\
       ) VALUES (?, ?, ?, ?, ?, ?) \
       ON CONFLICT(task_id) DO UPDATE SET \
         info_hash = COALESCE(excluded.info_hash, torrent_sessions.info_hash), \
         session_id = COALESCE(excluded.session_id, torrent_sessions.session_id), \
         uploaded_bytes = excluded.uploaded_bytes, peer_count = excluded.peer_count, \
         seed_started_at = COALESCE(torrent_sessions.seed_started_at, excluded.seed_started_at)",
    )
    .bind(task_id)
    .bind(info_hash)
    .bind(session_id.map(to_i64).transpose()?)
    .bind(to_i64(uploaded_bytes)?)
    .bind(to_i64(peer_count)?)
    .bind(seed_started_at)
    .execute(&self.writer)
    .await?;
    Ok(())
  }

  pub async fn torrent_detail(&self, task_id: &str) -> Result<Option<TorrentTaskDetail>> {
    let row = sqlx::query(
      "SELECT info_hash, uploaded_bytes, peer_count, seed_started_at \
       FROM torrent_sessions WHERE task_id = ?",
    )
    .bind(task_id)
    .fetch_optional(&self.pool)
    .await?;
    row
      .map(|row| {
        Ok(TorrentTaskDetail {
          info_hash: row.try_get("info_hash")?,
          uploaded_bytes: to_u64(row.try_get("uploaded_bytes")?)?,
          peer_count: to_u64(row.try_get("peer_count")?)?,
          seed_started_at: row.try_get("seed_started_at")?,
        })
      })
      .transpose()
  }

  pub(crate) async fn torrent_session_identity(
    &self,
    task_id: &str,
  ) -> Result<Option<TorrentSessionIdentity>> {
    let row = sqlx::query("SELECT info_hash, session_id FROM torrent_sessions WHERE task_id = ?")
      .bind(task_id)
      .fetch_optional(&self.pool)
      .await?;
    row
      .map(|row| {
        Ok(TorrentSessionIdentity {
          info_hash: row.try_get("info_hash")?,
          session_id: row
            .try_get::<Option<i64>, _>("session_id")?
            .map(to_u64)
            .transpose()?,
        })
      })
      .transpose()
  }

  pub async fn clear_progress(&self, task_id: &str) -> Result<()> {
    let mut transaction = self.writer.begin().await?;
    sqlx::query("DELETE FROM segments WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    sqlx::query("DELETE FROM integrity_samples WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    sqlx::query("UPDATE tasks SET downloaded_bytes = 0 WHERE id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    transaction.commit().await?;
    Ok(())
  }

  pub async fn reset_after_file_deletion(&self, task_id: &str) -> Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    sqlx::query("DELETE FROM segments WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    sqlx::query("DELETE FROM integrity_samples WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    sqlx::query("DELETE FROM torrent_sessions WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    sqlx::query("DELETE FROM saf_exports WHERE task_id = ?")
      .bind(task_id)
      .execute(&mut *transaction)
      .await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET status = 'cancelled', downloaded_bytes = 0, speed_bytes_per_second = 0, \
       error_code = NULL, error_message = NULL, etag = NULL, last_modified = NULL, \
       retry_count = 0, temp_path = NULL, updated_at = ?, revision = ? WHERE id = ?",
    )
    .bind(now_millis())
    .bind(revision)
    .bind(task_id)
    .execute(&mut *transaction)
    .await?;
    if result.rows_affected() == 0 {
      return Err(Error::NotFound(task_id.to_string()));
    }
    transaction.commit().await?;
    self.require_task(task_id).await
  }

  pub async fn set_priority(&self, id: &str, priority: u8) -> Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result =
      sqlx::query("UPDATE tasks SET priority = ?, updated_at = ?, revision = ? WHERE id = ?")
        .bind(i64::from(priority))
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

  pub async fn move_queue(&self, id: &str, before_task_id: Option<&str>) -> Result<DownloadTask> {
    self.require_task(id).await?;
    let position = match before_task_id {
      Some(before) => sqlx::query_scalar::<_, i64>("SELECT queue_position FROM tasks WHERE id = ?")
        .bind(before)
        .fetch_optional(&self.pool)
        .await?
        .ok_or_else(|| Error::NotFound(before.to_string()))?,
      None => {
        sqlx::query_scalar::<_, Option<i64>>("SELECT MAX(queue_position) FROM tasks")
          .fetch_one(&self.pool)
          .await?
          .unwrap_or(0)
          + 2
      }
    };
    let mut transaction = self.writer.begin().await?;
    sqlx::query("UPDATE tasks SET queue_position = queue_position + 2 WHERE queue_position >= ?")
      .bind(position)
      .execute(&mut *transaction)
      .await?;
    let revision = next_revision(&mut transaction).await?;
    sqlx::query("UPDATE tasks SET queue_position = ?, updated_at = ?, revision = ? WHERE id = ?")
      .bind(position + 1)
      .bind(now_millis())
      .bind(revision)
      .bind(id)
      .execute(&mut *transaction)
      .await?;
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn update_source(&self, id: &str, source: &DownloadSource) -> Result<DownloadTask> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query(
      "UPDATE tasks SET source_json = ?, status = 'queued', error_code = NULL, error_message = NULL, \
       updated_at = ?, revision = ? WHERE id = ? AND status = 'waiting_for_source'",
    )
    .bind(serde_json::to_string(source)?)
    .bind(now_millis())
    .bind(revision)
    .bind(id)
    .execute(&mut *transaction)
    .await?;
    if result.rows_affected() == 0 {
      let status = sqlx::query_scalar::<_, String>("SELECT status FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_optional(&mut *transaction)
        .await?;
      return match status {
        Some(status) => Err(Error::InvalidInput(format!(
          "download source can only be updated while waiting for source; current status is {status}",
        ))),
        None => Err(Error::NotFound(id.to_string())),
      };
    }
    transaction.commit().await?;
    self.require_task(id).await
  }

  pub async fn forget(&self, id: &str) -> Result<i64> {
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let result = sqlx::query("DELETE FROM tasks WHERE id = ?")
      .bind(id)
      .execute(&mut *transaction)
      .await?;
    if result.rows_affected() == 0 {
      return Err(Error::NotFound(id.to_string()));
    }
    transaction.commit().await?;
    Ok(revision)
  }

  pub async fn checkpoint(&self) -> Result<()> {
    sqlx::query("PRAGMA wal_checkpoint(PASSIVE)")
      .execute(&self.writer)
      .await?;
    Ok(())
  }

  async fn transition_status(
    &self,
    id: &str,
    target: TaskStatus,
    allowed: &[TaskStatus],
    operation: &str,
  ) -> Result<DownloadTask> {
    debug_assert!(!allowed.is_empty());
    let mut transaction = self.writer.begin().await?;
    let revision = next_revision(&mut transaction).await?;
    let mut builder = QueryBuilder::<Sqlite>::new("UPDATE tasks SET status = ");
    builder
      .push_bind(target.as_db())
      .push(", speed_bytes_per_second = CASE WHEN ")
      .push_bind(target.as_db())
      .push(
        " IN ('downloading', 'seeding') THEN speed_bytes_per_second ELSE 0 END, \
         error_code = NULL, error_message = NULL, updated_at = ",
      )
      .push_bind(now_millis())
      .push(", revision = ")
      .push_bind(revision)
      .push(" WHERE id = ")
      .push_bind(id)
      .push(" AND status IN (");
    {
      let mut separated = builder.separated(", ");
      for status in allowed {
        separated.push_bind(status.as_db());
      }
    }
    builder.push(")");
    let result = builder.build().execute(&mut *transaction).await?;
    if result.rows_affected() == 0 {
      let status = sqlx::query_scalar::<_, String>("SELECT status FROM tasks WHERE id = ?")
        .bind(id)
        .fetch_optional(&mut *transaction)
        .await?;
      transaction.rollback().await?;
      return match status {
        Some(status) => Err(Error::InvalidInput(format!(
          "cannot {operation} a download task in status {status}",
        ))),
        None => Err(Error::NotFound(id.to_string())),
      };
    }
    transaction.commit().await?;
    self.require_task(id).await
  }

  #[cfg(test)]
  async fn mutate_task(
    &self,
    id: &str,
    assignments: &str,
    text_bindings: &[&str],
  ) -> Result<DownloadTask> {
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

  async fn require_task(&self, id: &str) -> Result<DownloadTask> {
    self
      .get_task(id)
      .await?
      .ok_or_else(|| Error::NotFound(id.to_string()))
  }
}

async fn ensure_task_mutated(
  transaction: &mut Transaction<'_, Sqlite>,
  rows_affected: u64,
  id: &str,
  operation: &str,
) -> Result<()> {
  if rows_affected != 0 {
    return Ok(());
  }
  let status = sqlx::query_scalar::<_, String>("SELECT status FROM tasks WHERE id = ?")
    .bind(id)
    .fetch_optional(&mut **transaction)
    .await?;
  match status {
    Some(status) => Err(Error::InvalidInput(format!(
      "cannot {operation} task {id} while it is {status}",
    ))),
    None => Err(Error::NotFound(id.to_string())),
  }
}

#[cfg(any(target_os = "android", test))]
fn validate_saf_document_uri(tree_uri: &str, document_uri: &str) -> Result<()> {
  let tree = url::Url::parse(tree_uri)
    .map_err(|_| Error::InvalidInput("registered SAF tree URI is invalid".into()))?;
  let document = url::Url::parse(document_uri)
    .map_err(|_| Error::InvalidInput("SAF export result URI is invalid".into()))?;
  if tree.scheme() != "content"
    || document.scheme() != "content"
    || tree.host_str() != document.host_str()
    || tree == document
  {
    return Err(Error::InvalidInput(
      "SAF export result is outside its registered document provider".into(),
    ));
  }
  let tree_segments = tree
    .path_segments()
    .map(Iterator::collect::<Vec<_>>)
    .unwrap_or_default();
  let document_segments = document
    .path_segments()
    .map(Iterator::collect::<Vec<_>>)
    .unwrap_or_default();
  let Some(tree_index) = tree_segments.iter().position(|segment| *segment == "tree") else {
    return Err(Error::InvalidInput(
      "registered SAF URI does not identify a document tree".into(),
    ));
  };
  let Some(tree_id) = tree_segments.get(tree_index + 1) else {
    return Err(Error::InvalidInput(
      "registered SAF URI has no tree identifier".into(),
    ));
  };
  if document_segments.get(tree_index) != Some(&"tree")
    || document_segments.get(tree_index + 1) != Some(tree_id)
    || !document_segments.contains(&"document")
  {
    return Err(Error::InvalidInput(
      "SAF export result does not belong to the registered tree".into(),
    ));
  }
  Ok(())
}

async fn insert_task_row(
  transaction: &mut Transaction<'_, Sqlite>,
  task: &mut DownloadTask,
) -> Result<()> {
  task.revision = next_revision(transaction).await?;
  task.queue_position = task.revision;
  let source_json = serde_json::to_string(&task.source)?;
  sqlx::query(
    "INSERT INTO tasks(\
      id, collection_key, asset_key, kind, title, source_json, destination_id, relative_path, \
      status, priority, queue_position, total_bytes, downloaded_bytes, speed_bytes_per_second, \
      checksum_algorithm, checksum_value, etag, last_modified, final_path, temp_path, \
      retry_count, created_at, updated_at, revision\
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  )
  .bind(&task.id)
  .bind(&task.collection_key)
  .bind(&task.asset_key)
  .bind(task.kind.as_db())
  .bind(&task.title)
  .bind(source_json)
  .bind(&task.destination_id)
  .bind(&task.relative_path)
  .bind(task.status.as_db())
  .bind(i64::from(task.priority))
  .bind(task.queue_position)
  .bind(task.total_bytes.map(to_i64).transpose()?)
  .bind(to_i64(task.downloaded_bytes)?)
  .bind(to_i64(task.speed_bytes_per_second)?)
  .bind(task.checksum.as_ref().map(|value| value.algorithm.as_db()))
  .bind(task.checksum.as_ref().map(|value| value.value.as_str()))
  .bind(&task.etag)
  .bind(&task.last_modified)
  .bind(&task.final_path)
  .bind(task.final_path.as_ref().map(|path| format!("{path}.part")))
  .bind(i64::from(task.retry_count))
  .bind(task.created_at)
  .bind(task.updated_at)
  .bind(task.revision)
  .execute(&mut **transaction)
  .await?;
  Ok(())
}

fn task_from_row(row: &sqlx::sqlite::SqliteRow) -> Result<DownloadTask> {
  let source: DownloadSource = serde_json::from_str(row.try_get("source_json")?)?;
  let checksum_algorithm = row
    .try_get::<Option<String>, _>("checksum_algorithm")?
    .map(|value| ChecksumAlgorithm::from_db(&value))
    .transpose()?;
  let checksum_value = row.try_get::<Option<String>, _>("checksum_value")?;
  let checksum = checksum_algorithm
    .zip(checksum_value)
    .map(|(algorithm, value)| Checksum { algorithm, value });
  Ok(DownloadTask {
    id: row.try_get("id")?,
    collection_key: row.try_get("collection_key")?,
    asset_key: row.try_get("asset_key")?,
    kind: TaskKind::from_db(row.try_get("kind")?)?,
    title: row.try_get("title")?,
    source,
    destination_id: row.try_get("destination_id")?,
    relative_path: row.try_get("relative_path")?,
    status: TaskStatus::from_db(row.try_get("status")?)?,
    priority: to_u8(row.try_get("priority")?)?,
    queue_position: row.try_get("queue_position")?,
    total_bytes: row
      .try_get::<Option<i64>, _>("total_bytes")?
      .map(to_u64)
      .transpose()?,
    downloaded_bytes: to_u64(row.try_get("downloaded_bytes")?)?,
    speed_bytes_per_second: to_u64(row.try_get("speed_bytes_per_second")?)?,
    error_code: row.try_get("error_code")?,
    error_message: row.try_get("error_message")?,
    checksum,
    etag: row.try_get("etag")?,
    last_modified: row.try_get("last_modified")?,
    final_path: row.try_get("final_path")?,
    retry_count: to_u8(row.try_get("retry_count")?)?,
    created_at: row.try_get("created_at")?,
    updated_at: row.try_get("updated_at")?,
    revision: row.try_get("revision")?,
  })
}

async fn next_revision(transaction: &mut Transaction<'_, Sqlite>) -> Result<i64> {
  Ok(
    sqlx::query_scalar::<_, i64>(
      "UPDATE downloader_meta SET revision = revision + 1 WHERE id = 1 RETURNING revision",
    )
    .fetch_one(&mut **transaction)
    .await?,
  )
}

pub fn merge_ranges(mut ranges: Vec<CompletedRange>) -> Vec<CompletedRange> {
  ranges.sort_unstable_by_key(|range| range.start);
  let mut merged: Vec<CompletedRange> = Vec::with_capacity(ranges.len());
  for range in ranges {
    if let Some(previous) = merged.last_mut()
      && range.start <= previous.end
    {
      previous.end = previous.end.max(range.end);
      continue;
    }
    merged.push(range);
  }
  merged
}

pub fn missing_ranges(total: u64, completed: &[CompletedRange]) -> Vec<CompletedRange> {
  let completed = merge_ranges(completed.to_vec());
  let mut cursor = 0;
  let mut missing = Vec::new();
  for range in completed {
    if cursor < range.start {
      missing.push(CompletedRange {
        start: cursor,
        end: range.start.min(total),
      });
    }
    cursor = cursor.max(range.end.min(total));
    if cursor >= total {
      break;
    }
  }
  if cursor < total {
    missing.push(CompletedRange {
      start: cursor,
      end: total,
    });
  }
  missing
    .into_iter()
    .filter(|range| range.start < range.end)
    .collect()
}

pub fn split_ranges(
  ranges: &[CompletedRange],
  target_count: usize,
  minimum_size: u64,
) -> Vec<CompletedRange> {
  if target_count <= ranges.len() {
    return ranges.to_vec();
  }
  let mut ranges = ranges.to_vec();
  while ranges.len() < target_count {
    let candidate = ranges
      .iter()
      .enumerate()
      .filter(|(_, range)| range.end - range.start >= minimum_size.saturating_mul(2))
      .max_by_key(|(_, range)| range.end - range.start)
      .map(|(index, _)| index);
    let Some(index) = candidate else { break };
    let range = ranges.remove(index);
    let midpoint = range.start + (range.end - range.start) / 2;
    ranges.push(CompletedRange {
      start: range.start,
      end: midpoint,
    });
    ranges.push(CompletedRange {
      start: midpoint,
      end: range.end,
    });
    ranges.sort_unstable_by_key(|range| range.start);
  }
  ranges
}

pub fn now_millis() -> i64 {
  std::time::SystemTime::now()
    .duration_since(std::time::UNIX_EPOCH)
    .unwrap_or_default()
    .as_millis()
    .try_into()
    .unwrap_or(i64::MAX)
}

fn to_i64(value: u64) -> Result<i64> {
  value
    .try_into()
    .map_err(|_| Error::InvalidInput("numeric value exceeds SQLite range".into()))
}

fn to_u64(value: i64) -> Result<u64> {
  value
    .try_into()
    .map_err(|_| Error::InvalidInput("database contained a negative size".into()))
}

fn to_u8(value: i64) -> Result<u8> {
  value
    .try_into()
    .map_err(|_| Error::InvalidInput("database value exceeds u8 range".into()))
}

fn to_u16(value: i64) -> Result<u16> {
  value
    .try_into()
    .map_err(|_| Error::InvalidInput("database value exceeds u16 range".into()))
}

#[cfg(test)]
mod tests {
  use std::{collections::HashSet, path::Path};

  use super::{
    CompletedRange, Repository, merge_ranges, missing_ranges, now_millis, split_ranges,
    validate_saf_document_uri,
  };
  use crate::Error;
  use crate::domain::{
    Destination, DestinationKind, DownloadSource, DownloadTask, DownloaderSettings, HttpSource,
    TaskKind, TaskStatus,
  };

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
}
