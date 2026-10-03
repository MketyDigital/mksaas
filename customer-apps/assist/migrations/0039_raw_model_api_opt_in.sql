ALTER TABLE customer_api_keys ADD COLUMN mode TEXT NOT NULL DEFAULT 'assistant'
  CHECK (mode IN ('assistant','raw_model'));
ALTER TABLE customer_api_keys ADD COLUMN model_allowlist_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE credit_ledger ADD COLUMN workload_type TEXT;
ALTER TABLE credit_ledger ADD COLUMN workload_id TEXT;
ALTER TABLE usage_events ADD COLUMN workload_type TEXT;
ALTER TABLE usage_events ADD COLUMN workload_id TEXT;

CREATE TABLE IF NOT EXISTS raw_model_api_settings (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  allowed_models_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS raw_model_reservations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  api_key_id TEXT NOT NULL REFERENCES customer_api_keys(id) ON DELETE CASCADE,
  reserved_credits INTEGER NOT NULL CHECK (reserved_credits > 0),
  status TEXT NOT NULL CHECK (status IN ('open','settled','released')),
  settled_credits INTEGER,
  created_at INTEGER NOT NULL,
  settled_at INTEGER,
  idempotency_key TEXT,
  resolution_token TEXT,
  UNIQUE (customer_id,api_key_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_raw_model_reservations_customer
  ON raw_model_reservations(customer_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS raw_model_settlements (
  reservation_id TEXT PRIMARY KEY REFERENCES raw_model_reservations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  api_key_id TEXT NOT NULL REFERENCES customer_api_keys(id) ON DELETE CASCADE,
  claim_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('applying','applied')),
  actual_credits INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  applied_at INTEGER
);

CREATE TABLE IF NOT EXISTS workload_inference_attempt_index (
  attempt_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  workload_type TEXT NOT NULL CHECK (workload_type IN ('api_key')),
  workload_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL REFERENCES raw_model_reservations(id) ON DELETE CASCADE,
  request_hash TEXT NOT NULL,
  model_alias TEXT NOT NULL,
  conversation_id TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started','not_submitted','result_recorded','settled','unknown_outcome')),
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  input_units INTEGER,
  output_units INTEGER,
  reasoning_units INTEGER,
  provider_cost_micros INTEGER,
  rate_snapshot_json TEXT NOT NULL DEFAULT '{}',
  requested_reasoning_mode TEXT NOT NULL DEFAULT 'standard',
  applied_reasoning_mode TEXT NOT NULL DEFAULT 'standard',
  resolution_usage_json TEXT,
  resolution_idempotency_key TEXT,
  resolved_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_workload_attempts_unresolved
  ON workload_inference_attempt_index(customer_id,workload_type,workload_id,status,updated_at);

CREATE TABLE IF NOT EXISTS workload_attempt_resolution_audit (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES workload_inference_attempt_index(attempt_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  outcome TEXT NOT NULL CHECK (outcome IN ('confirmed_not_submitted','recovered_result','provider_charged_no_result','mkety_absorbed_cost','unresolved')),
  evidence_summary TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
