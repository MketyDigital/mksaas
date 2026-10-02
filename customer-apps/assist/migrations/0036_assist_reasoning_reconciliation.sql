ALTER TABLE assistants
  ADD COLUMN reasoning_mode TEXT NOT NULL DEFAULT 'standard'
  CHECK (reasoning_mode IN ('standard','high','maximum'));

ALTER TABLE assistants
  ADD COLUMN reasoning_fallback_policy TEXT NOT NULL DEFAULT 'allow_lower_effort'
  CHECK (reasoning_fallback_policy IN ('allow_lower_effort','strict'));

ALTER TABLE model_route_targets
  ADD COLUMN reasoning_capabilities_json TEXT;

ALTER TABLE model_route_targets
  ADD COLUMN reasoning_credits_per_million INTEGER
  CHECK (reasoning_credits_per_million IS NULL OR reasoning_credits_per_million >= 0);

ALTER TABLE model_route_targets
  ADD COLUMN provider_reasoning_cost_micros_per_million INTEGER
  CHECK (provider_reasoning_cost_micros_per_million IS NULL OR provider_reasoning_cost_micros_per_million >= 0);

ALTER TABLE usage_events
  ADD COLUMN reasoning_units INTEGER NOT NULL DEFAULT 0 CHECK (reasoning_units >= 0);

ALTER TABLE usage_events
  ADD COLUMN requested_reasoning_mode TEXT NOT NULL DEFAULT 'standard';

ALTER TABLE usage_events
  ADD COLUMN applied_reasoning_mode TEXT NOT NULL DEFAULT 'standard';

CREATE TABLE IF NOT EXISTS inference_attempt_index (
  attempt_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  reservation_id TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  model_alias TEXT NOT NULL,
  reply_job_id TEXT,
  conversation_id TEXT NOT NULL DEFAULT '',
  media_kind TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started','not_submitted','result_recorded','settled','unknown_outcome')),
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  input_units INTEGER,
  output_units INTEGER,
  reasoning_units INTEGER,
  image_units INTEGER,
  audio_seconds REAL,
  provider_cost_micros INTEGER,
  rate_snapshot_json TEXT NOT NULL DEFAULT '{}',
  requested_reasoning_mode TEXT NOT NULL DEFAULT 'standard',
  applied_reasoning_mode TEXT NOT NULL DEFAULT 'standard',
  resolution_usage_json TEXT,
  resolution_idempotency_key TEXT,
  resolved_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_inference_attempt_index_unresolved
  ON inference_attempt_index(customer_id,assistant_id,status,updated_at);

CREATE TABLE IF NOT EXISTS inference_attempt_resolution_audit (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL REFERENCES inference_attempt_index(attempt_id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  outcome TEXT NOT NULL CHECK (outcome IN ('confirmed_not_submitted','recovered_result','provider_charged_no_result','mkety_absorbed_cost','unresolved')),
  evidence_summary TEXT NOT NULL,
  reason TEXT NOT NULL,
  operator_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
