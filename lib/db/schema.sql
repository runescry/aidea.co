CREATE TABLE IF NOT EXISTS profiles (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_credentials (
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, provider)
);

CREATE TABLE IF NOT EXISTS action_queue (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default',
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS harness_entities (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default',
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS latest_briefs (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_action_queue_user_status ON action_queue (user_id, status);

CREATE TABLE IF NOT EXISTS chat_store (
  user_id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chat_conversations (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  messages JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_meta (
  user_id TEXT PRIMARY KEY,
  active_conversation_id TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_updated
  ON chat_conversations (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS action_audit (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL DEFAULT 'default',
  action_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_action_audit_user_resolved
  ON action_audit (user_id, resolved_at DESC);

CREATE TABLE IF NOT EXISTS api_rate_limits (
  scope TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  window_start BIGINT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, key_hash, window_start)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_expires
  ON api_rate_limits (expires_at);

CREATE TABLE IF NOT EXISTS user_accounts (
  user_id TEXT PRIMARY KEY,
  nango_user_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  monitors_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_accounts_monitors
  ON user_accounts (mode, monitors_enabled);
