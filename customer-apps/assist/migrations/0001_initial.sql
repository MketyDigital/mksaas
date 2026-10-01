PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  logo_url TEXT,
  brand_color TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_domains (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  hostname TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('hosted','custom')),
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0,1)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','failed','disabled')),
  ssl_status TEXT,
  provider_hostname_id TEXT,
  validation_json TEXT,
  created_at INTEGER NOT NULL,
  verified_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_customer_domains_customer ON customer_domains(customer_id);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER,
  telegram_user_id TEXT UNIQUE,
  telegram_username TEXT,
  telegram_linked_at INTEGER,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customer_users (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner','admin','member')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (customer_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_users_user ON customer_users(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS recovery_challenges (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('telegram','operator')),
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_recovery_user ON recovery_challenges(user_id, expires_at);

CREATE TABLE IF NOT EXISTS setup_tokens (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assistants (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','disabled')),
  model_alias TEXT NOT NULL DEFAULT 'mkety-smart',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  memory_enabled INTEGER NOT NULL DEFAULT 1,
  monthly_credit_cap INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(customer_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_assistants_customer ON assistants(customer_id);

CREATE TABLE IF NOT EXISTS assistant_prompt_versions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  instructions TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_at INTEGER NOT NULL,
  published_at INTEGER,
  UNIQUE(assistant_id, version)
);

CREATE TABLE IF NOT EXISTS assistant_channels (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('telegram','web','api')),
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('active','disabled','error')),
  config_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id, channel)
);

CREATE TABLE IF NOT EXISTS assistant_secrets (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id, name)
);

CREATE TABLE IF NOT EXISTS model_routes (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  fallback_provider TEXT,
  fallback_model TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS model_rates (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL,
  version INTEGER NOT NULL,
  input_credits_per_million INTEGER NOT NULL DEFAULT 0,
  output_credits_per_million INTEGER NOT NULL DEFAULT 0,
  image_credits INTEGER NOT NULL DEFAULT 0,
  audio_credits_per_minute INTEGER NOT NULL DEFAULT 0,
  effective_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE(alias, version)
);

CREATE TABLE IF NOT EXISTS feature_policy (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  telegram_enabled INTEGER NOT NULL DEFAULT 1,
  vision_enabled INTEGER NOT NULL DEFAULT 1,
  voice_enabled INTEGER NOT NULL DEFAULT 1,
  knowledge_enabled INTEGER NOT NULL DEFAULT 1,
  reminders_enabled INTEGER NOT NULL DEFAULT 1,
  human_handoff_enabled INTEGER NOT NULL DEFAULT 1,
  tools_enabled INTEGER NOT NULL DEFAULT 0,
  vm_models_enabled INTEGER NOT NULL DEFAULT 0,
  max_assistants INTEGER NOT NULL DEFAULT 5,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS commercial_policy (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  subscription_amount_minor INTEGER NOT NULL DEFAULT 0,
  billing_period TEXT NOT NULL DEFAULT 'monthly',
  included_credits INTEGER NOT NULL DEFAULT 0,
  provider_envelope_bps INTEGER NOT NULL DEFAULT 2500,
  operations_reserve_bps INTEGER NOT NULL DEFAULT 300,
  rate_multiplier_bps INTEGER NOT NULL DEFAULT 10000,
  hard_stop_enabled INTEGER NOT NULL DEFAULT 1,
  topup_enabled INTEGER NOT NULL DEFAULT 1,
  grace_period_days INTEGER NOT NULL DEFAULT 3,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_accounts (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  lifetime_granted INTEGER NOT NULL DEFAULT 0,
  lifetime_consumed INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT REFERENCES assistants(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  kind TEXT NOT NULL,
  reference_id TEXT,
  balance_after INTEGER NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_customer ON credit_ledger(customer_id, created_at);

CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT REFERENCES assistants(id) ON DELETE SET NULL,
  conversation_id TEXT,
  model_alias TEXT,
  provider TEXT,
  provider_model TEXT,
  input_units INTEGER NOT NULL DEFAULT 0,
  output_units INTEGER NOT NULL DEFAULT 0,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  provider_cost_micros INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_usage_customer ON usage_events(customer_id, created_at);

CREATE TABLE IF NOT EXISTS provider_cost_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  usage_event_id TEXT REFERENCES usage_events(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  cost_micros INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_collections (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  r2_key TEXT,
  title TEXT NOT NULL,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_knowledge (
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES knowledge_collections(id) ON DELETE CASCADE,
  PRIMARY KEY (assistant_id, collection_id)
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_conversation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(customer_id, assistant_id, channel, external_conversation_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT,
  media_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  memory_text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  due_at INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at INTEGER NOT NULL,
  delivered_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, due_at);

CREATE TABLE IF NOT EXISTS human_handoffs (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open',
  reason TEXT,
  created_at INTEGER NOT NULL,
  resolved_at INTEGER
);

CREATE TABLE IF NOT EXISTS payment_events (
  id TEXT PRIMARY KEY,
  provider_event_id TEXT NOT NULL UNIQUE,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  amount_minor INTEGER,
  currency TEXT,
  payload_hash TEXT,
  processed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  metadata_json TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_customer ON audit_events(customer_id, created_at);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_event_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  payload_hash TEXT,
  received_at INTEGER NOT NULL,
  processed_at INTEGER,
  UNIQUE(source, external_event_id)
);

INSERT OR IGNORE INTO model_routes
(id, alias, provider, provider_model, fallback_provider, fallback_model, status, created_at, updated_at)
VALUES
('route_fast','mkety-fast','workers-ai','@cf/meta/llama-3.1-8b-instruct',NULL,NULL,'active',unixepoch(),unixepoch()),
('route_smart','mkety-smart','workers-ai','@cf/meta/llama-3.3-70b-instruct-fp8-fast',NULL,NULL,'active',unixepoch(),unixepoch());

INSERT OR IGNORE INTO model_rates
(id, alias, version, input_credits_per_million, output_credits_per_million, image_credits, audio_credits_per_minute, effective_at, created_at)
VALUES
('rate_fast_v1','mkety-fast',1,1000,2000,0,0,unixepoch(),unixepoch()),
('rate_smart_v1','mkety-smart',1,2500,5000,0,0,unixepoch(),unixepoch());
