PRAGMA foreign_keys=OFF;
ALTER TABLE provider_connections RENAME TO provider_connections_pre_0020;
CREATE TABLE provider_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN (
    'openai','anthropic','gemini','vertex','cloudflare-ai','bedrock',
    'azure-openai','azure-foundry','openai-compatible'
  )),
  endpoint_url TEXT,
  api_key_ciphertext TEXT NOT NULL,
  extra_json TEXT,
  capabilities_json TEXT NOT NULL DEFAULT '["text"]',
  ownership TEXT NOT NULL DEFAULT 'mkety' CHECK (ownership IN ('mkety','customer')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  validated_at INTEGER,
  validation_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO provider_connections
(id,name,customer_id,provider,endpoint_url,api_key_ciphertext,extra_json,status,created_at,updated_at)
SELECT id,name,NULL,provider,endpoint_url,api_key_ciphertext,extra_json,status,created_at,updated_at
FROM provider_connections_pre_0020;
DROP TABLE provider_connections_pre_0020;
PRAGMA foreign_keys=ON;

ALTER TABLE model_routes ADD COLUMN byok_policy TEXT NOT NULL DEFAULT 'managed'
  CHECK (byok_policy IN ('managed','strict_byok','explicit_paid_fallback'));

CREATE INDEX IF NOT EXISTS idx_provider_connections_customer
  ON provider_connections(customer_id,ownership,status);

CREATE TABLE IF NOT EXISTS customer_model_routes (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  provider_connection_id TEXT REFERENCES provider_connections(id) ON DELETE RESTRICT,
  fallback_provider TEXT,
  fallback_model TEXT,
  fallback_provider_connection_id TEXT REFERENCES provider_connections(id) ON DELETE RESTRICT,
  byok_policy TEXT NOT NULL DEFAULT 'managed'
    CHECK (byok_policy IN ('managed','strict_byok','explicit_paid_fallback')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(customer_id,alias)
);
CREATE INDEX IF NOT EXISTS idx_customer_model_routes_active
  ON customer_model_routes(customer_id,status,alias);
