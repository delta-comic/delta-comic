CREATE TABLE IF NOT EXISTS sync_entities (
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  data_json TEXT,
  data_hash TEXT NOT NULL,
  version TEXT NOT NULL,
  client_changed_at INTEGER NOT NULL,
  server_updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  last_terminal_uuid TEXT NOT NULL,
  last_op_id TEXT NOT NULL,
  PRIMARY KEY (user_id, collection, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_entities_user_collection
ON sync_entities (user_id, collection);

CREATE TABLE IF NOT EXISTS sync_changes (
  server_seq INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  data_json TEXT,
  data_hash TEXT NOT NULL,
  version TEXT NOT NULL,
  client_changed_at INTEGER NOT NULL,
  server_changed_at INTEGER NOT NULL,
  deleted_at INTEGER,
  origin_terminal_uuid TEXT NOT NULL,
  origin_op_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sync_changes_user_seq
ON sync_changes (user_id, server_seq);

CREATE INDEX IF NOT EXISTS idx_sync_changes_user_collection_seq
ON sync_changes (user_id, collection, server_seq);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_changes_origin_op
ON sync_changes (user_id, origin_terminal_uuid, origin_op_id);

CREATE TABLE IF NOT EXISTS sync_ops (
  user_id TEXT NOT NULL,
  terminal_uuid TEXT NOT NULL,
  op_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  base_version TEXT,
  result TEXT NOT NULL,
  server_seq INTEGER,
  entity_version TEXT,
  error_code TEXT,
  error_message TEXT,
  received_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, terminal_uuid, op_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_ops_user_received
ON sync_ops (user_id, received_at DESC);

CREATE TABLE IF NOT EXISTS sync_terminal_cursors (
  user_id TEXT NOT NULL,
  terminal_uuid TEXT NOT NULL,
  last_pulled_seq INTEGER NOT NULL DEFAULT 0,
  last_pushed_at INTEGER,
  last_seen_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, terminal_uuid)
);