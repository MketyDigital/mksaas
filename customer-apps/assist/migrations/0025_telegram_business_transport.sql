ALTER TABLE reply_jobs ADD COLUMN business_connection_id TEXT;
ALTER TABLE conversations ADD COLUMN business_connection_id TEXT;

CREATE TABLE IF NOT EXISTS telegram_webhook_capabilities (
  assistant_id TEXT PRIMARY KEY REFERENCES assistants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0,
  last_synced_at INTEGER,
  last_error TEXT
);
