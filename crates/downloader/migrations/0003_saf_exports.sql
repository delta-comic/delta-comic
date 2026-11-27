CREATE TABLE IF NOT EXISTS saf_exports (
  task_id TEXT PRIMARY KEY NOT NULL,
  destination_id TEXT NOT NULL,
  staging_path TEXT NOT NULL,
  document_uri TEXT,
  state TEXT NOT NULL CHECK(state IN ('pending', 'completed')),
  error_message TEXT,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY(destination_id) REFERENCES destinations(id)
);

CREATE INDEX IF NOT EXISTS idx_saf_exports_destination
ON saf_exports(destination_id, state);
