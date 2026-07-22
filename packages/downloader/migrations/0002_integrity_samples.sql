CREATE TABLE IF NOT EXISTS integrity_samples (
  task_id TEXT NOT NULL,
  start_offset INTEGER NOT NULL,
  length INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  PRIMARY KEY(task_id, start_offset),
  FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
