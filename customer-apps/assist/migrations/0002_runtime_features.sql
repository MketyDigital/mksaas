ALTER TABLE knowledge_items ADD COLUMN content_text TEXT;
ALTER TABLE knowledge_items ADD COLUMN metadata_json TEXT;

CREATE TABLE IF NOT EXISTS assistant_tools (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  endpoint_url TEXT NOT NULL,
  auth_header_ciphertext TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id, name)
);

CREATE TABLE IF NOT EXISTS credit_reservations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  reserved_credits INTEGER NOT NULL,
  settled_credits INTEGER,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','settled','released')),
  created_at INTEGER NOT NULL,
  settled_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_open ON credit_reservations(customer_id, status);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  r2_key TEXT,
  mime_type TEXT,
  size_bytes INTEGER,
  transcript TEXT,
  vision_text TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_usage_limits (
  assistant_id TEXT PRIMARY KEY REFERENCES assistants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  daily_credit_cap INTEGER,
  monthly_credit_cap INTEGER,
  max_output_tokens INTEGER NOT NULL DEFAULT 1024,
  updated_at INTEGER NOT NULL
);
