ALTER TABLE assistants ADD COLUMN monthly_credit_cap_mode TEXT NOT NULL DEFAULT 'soft'
  CHECK (monthly_credit_cap_mode IN ('soft','hard'));

-- Preserve the existing enforcement behavior for any assistant that already has a cap.
UPDATE assistants SET monthly_credit_cap_mode='hard' WHERE monthly_credit_cap>0;

-- A legacy zero was treated as uncapped by runtime; make that meaning explicit.
UPDATE assistants SET monthly_credit_cap=NULL WHERE monthly_credit_cap=0;

CREATE INDEX IF NOT EXISTS idx_inference_attempt_index_review
  ON inference_attempt_index(status,updated_at DESC,attempt_id DESC);
CREATE INDEX IF NOT EXISTS idx_workload_attempt_index_review
  ON workload_inference_attempt_index(status,updated_at DESC,attempt_id DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_usage_monthly_cap
  ON usage_events(customer_id,assistant_id,created_at);
CREATE INDEX IF NOT EXISTS idx_assistant_reservations_monthly_cap
  ON credit_reservations(customer_id,assistant_id,status);
