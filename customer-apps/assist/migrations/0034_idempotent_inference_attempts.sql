ALTER TABLE usage_events ADD COLUMN provider_attempt_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_provider_attempt_once
  ON usage_events(provider_attempt_id)
  WHERE provider_attempt_id IS NOT NULL;

ALTER TABLE provider_cost_events ADD COLUMN provider_attempt_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_cost_attempt_once
  ON provider_cost_events(provider_attempt_id)
  WHERE provider_attempt_id IS NOT NULL;

ALTER TABLE credit_reservations ADD COLUMN resolution_token TEXT;

CREATE TABLE IF NOT EXISTS inference_settlements (
  reservation_id TEXT PRIMARY KEY REFERENCES credit_reservations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  claim_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('applying','applied')),
  actual_credits INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  applied_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_inference_settlements_scope
  ON inference_settlements(customer_id,assistant_id,status,created_at);
