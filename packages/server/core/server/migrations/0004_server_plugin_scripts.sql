CREATE TABLE IF NOT EXISTS server_plugin_scripts (
  plugin_id TEXT PRIMARY KEY NOT NULL,
  source TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0, 1)),
  interval_hours INTEGER NOT NULL DEFAULT 1 CHECK (interval_hours BETWEEN 1 AND 168),
  next_run_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (plugin_id) REFERENCES server_plugin_installations(plugin_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_plugin_scripts_due
ON server_plugin_scripts (enabled, next_run_at ASC);

CREATE TABLE IF NOT EXISTS server_plugin_script_runs (
  id TEXT PRIMARY KEY NOT NULL,
  plugin_id TEXT NOT NULL,
  trigger TEXT NOT NULL CHECK (trigger IN ('manual', 'scheduled')),
  status TEXT NOT NULL CHECK (status IN ('failed', 'succeeded')),
  input_json TEXT,
  result_json TEXT,
  error_message TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL,
  FOREIGN KEY (plugin_id) REFERENCES server_plugin_scripts(plugin_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_plugin_script_runs_plugin_started
ON server_plugin_script_runs (plugin_id, started_at DESC);
