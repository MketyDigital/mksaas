-- Support the Ops credit-activity feed's bounded newest-first scan across all customers.
CREATE INDEX IF NOT EXISTS idx_ops_credit_ledger_activity
  ON credit_ledger(created_at DESC,id DESC)
  WHERE kind NOT IN ('topup','plan_funding');

CREATE INDEX IF NOT EXISTS idx_ops_usage_events_activity
  ON usage_events(created_at DESC,id DESC);

CREATE INDEX IF NOT EXISTS idx_ops_payment_checkouts_activity
  ON payment_checkouts(created_at DESC,id DESC);
