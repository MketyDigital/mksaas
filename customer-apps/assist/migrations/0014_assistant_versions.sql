ALTER TABLE assistants ADD COLUMN archived_at INTEGER;
ALTER TABLE assistants ADD COLUMN deleted_at INTEGER;
ALTER TABLE assistants ADD COLUMN current_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS assistant_config_versions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  config_json TEXT NOT NULL,
  created_by_user_id TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(assistant_id, version)
);
