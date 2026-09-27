CREATE TABLE IF NOT EXISTS server_plugin_registry (
  plugin_id TEXT PRIMARY KEY NOT NULL,
  manifest_json TEXT NOT NULL,
  source TEXT NOT NULL,
  trusted INTEGER NOT NULL DEFAULT 1 CHECK (trusted IN (0, 1)),
  registered_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_server_plugin_registry_updated
ON server_plugin_registry (updated_at DESC);

CREATE TABLE IF NOT EXISTS server_plugin_installations (
  plugin_id TEXT PRIMARY KEY NOT NULL,
  installed_version TEXT NOT NULL,
  desired_state TEXT NOT NULL CHECK (desired_state IN ('disabled', 'enabled')),
  observed_state TEXT NOT NULL
    CHECK (observed_state IN ('disabled', 'enabled', 'failed', 'installed')),
  config_json TEXT NOT NULL DEFAULT '{}',
  installed_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_error TEXT,
  last_health_json TEXT,
  last_health_at INTEGER,
  FOREIGN KEY (plugin_id) REFERENCES server_plugin_registry(plugin_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_plugin_installations_state
ON server_plugin_installations (desired_state, observed_state, updated_at DESC);

CREATE TABLE IF NOT EXISTS server_plugin_jobs (
  id TEXT PRIMARY KEY NOT NULL,
  plugin_id TEXT NOT NULL,
  action TEXT NOT NULL
    CHECK (action IN ('configure', 'disable', 'enable', 'health', 'install', 'register', 'uninstall', 'update')),
  status TEXT NOT NULL CHECK (status IN ('failed', 'queued', 'running', 'succeeded')),
  result_json TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_server_plugin_jobs_plugin_created
ON server_plugin_jobs (plugin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_server_plugin_jobs_status_updated
ON server_plugin_jobs (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS server_plugin_audit (
  id TEXT PRIMARY KEY NOT NULL,
  plugin_id TEXT NOT NULL,
  job_id TEXT NOT NULL,
  action TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('failed', 'succeeded')),
  actor_id TEXT NOT NULL,
  detail_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (job_id) REFERENCES server_plugin_jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_server_plugin_audit_created
ON server_plugin_audit (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_server_plugin_audit_plugin_created
ON server_plugin_audit (plugin_id, created_at DESC);
