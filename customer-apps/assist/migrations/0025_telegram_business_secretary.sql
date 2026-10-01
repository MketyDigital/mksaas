ALTER TABLE reply_jobs ADD COLUMN business_connection_id TEXT;
ALTER TABLE conversations ADD COLUMN business_connection_id TEXT;

CREATE TABLE IF NOT EXISTS telegram_business_connections (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  business_connection_id TEXT NOT NULL,
  business_user_id TEXT NOT NULL,
  user_chat_id TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  rights_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id,business_connection_id)
);
CREATE INDEX IF NOT EXISTS idx_telegram_business_connection_owner
  ON telegram_business_connections(assistant_id,business_user_id,is_enabled);

CREATE TABLE IF NOT EXISTS telegram_webhook_capabilities (
  assistant_id TEXT PRIMARY KEY REFERENCES assistants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  last_synced_at INTEGER,
  last_error TEXT
);
