PRAGMA foreign_keys = OFF;

ALTER TABLE provider_connections RENAME TO provider_connections_old;

CREATE TABLE provider_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN (
    'openai','anthropic','gemini','vertex','cloudflare-ai','bedrock',
    'azure-openai','openai-compatible'
  )),
  endpoint_url TEXT,
  api_key_ciphertext TEXT NOT NULL,
  extra_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO provider_connections
(id,name,provider,endpoint_url,api_key_ciphertext,extra_json,status,created_at,updated_at)
SELECT id,name,provider,endpoint_url,api_key_ciphertext,extra_json,status,created_at,updated_at
FROM provider_connections_old;

DROP TABLE provider_connections_old;

CREATE TABLE IF NOT EXISTS customer_api_keys (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT REFERENCES assistants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_prefix TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  expires_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_customer_api_keys_customer
  ON customer_api_keys(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_api_keys_hash
  ON customer_api_keys(token_hash);

ALTER TABLE usage_events ADD COLUMN api_key_id TEXT;

PRAGMA foreign_keys = ON;
