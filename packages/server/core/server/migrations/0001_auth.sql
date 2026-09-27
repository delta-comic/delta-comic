CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY NOT NULL,
  login_name TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_alg TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  disabled_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_auth_users_login_name
ON auth_users (login_name);

CREATE TABLE IF NOT EXISTS auth_terminals (
  user_id TEXT NOT NULL,
  terminal_uuid TEXT NOT NULL,
  display_name TEXT,
  platform TEXT,
  app_version TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (user_id, terminal_uuid),
  FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_terminals_user_last_seen
ON auth_terminals (user_id, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  terminal_uuid TEXT NOT NULL,
  access_token_hash TEXT UNIQUE NOT NULL,
  refresh_token_hash TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  access_expires_at INTEGER NOT NULL,
  refresh_expires_at INTEGER NOT NULL,
  rotated_at INTEGER,
  revoked_at INTEGER,
  FOREIGN KEY (user_id, terminal_uuid)
    REFERENCES auth_terminals(user_id, terminal_uuid)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_access_token_hash
ON auth_sessions (access_token_hash);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_refresh_token_hash
ON auth_sessions (refresh_token_hash);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user_terminal
ON auth_sessions (user_id, terminal_uuid);