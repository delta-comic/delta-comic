PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS downloader_meta (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  revision INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO downloader_meta(id, revision) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS collections (
  key TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  refresh_context_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY(destination_id) REFERENCES destinations(id)
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY NOT NULL,
  collection_key TEXT,
  asset_key TEXT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  source_json TEXT NOT NULL,
  destination_id TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  status TEXT NOT NULL,
  priority INTEGER NOT NULL,
  queue_position INTEGER NOT NULL,
  total_bytes INTEGER,
  downloaded_bytes INTEGER NOT NULL DEFAULT 0,
  speed_bytes_per_second INTEGER NOT NULL DEFAULT 0,
  error_code TEXT,
  error_message TEXT,
  checksum_algorithm TEXT,
  checksum_value TEXT,
  etag TEXT,
  last_modified TEXT,
  final_path TEXT,
  temp_path TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revision INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(destination_id) REFERENCES destinations(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_queue
ON tasks(status, priority DESC, queue_position ASC);

CREATE INDEX IF NOT EXISTS idx_tasks_collection
ON tasks(collection_key, created_at ASC);

CREATE TABLE IF NOT EXISTS segments (
  task_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  committed_end INTEGER NOT NULL,
  state TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(task_id, start_offset),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS torrent_sessions (
  task_id TEXT PRIMARY KEY NOT NULL,
  info_hash TEXT,
  session_id INTEGER,
  fast_resume_path TEXT,
  uploaded_bytes INTEGER NOT NULL DEFAULT 0,
  peer_count INTEGER NOT NULL DEFAULT 0,
  seed_started_at INTEGER,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  max_active_tasks INTEGER NOT NULL,
  connection_budget INTEGER NOT NULL,
  per_task_connections INTEGER NOT NULL,
  allow_metered INTEGER NOT NULL DEFAULT 1,
  seed_on_complete INTEGER NOT NULL DEFAULT 0,
  seed_ratio REAL,
  seed_seconds INTEGER,
  revision INTEGER NOT NULL DEFAULT 0
);
