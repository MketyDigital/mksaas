CREATE TABLE IF NOT EXISTS ops_credit_dispositions (
  id TEXT PRIMARY KEY,
  attempt_id TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  workload_type TEXT NOT NULL CHECK (workload_type IN ('assistant','api_key')),
  workload_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('owner_credit_return')),
  amount_credits INTEGER NOT NULL CHECK (amount_credits > 0),
  idempotency_key TEXT NOT NULL UNIQUE,
  reason TEXT NOT NULL,
  evidence_summary TEXT NOT NULL,
  operator_user_id TEXT NOT NULL REFERENCES operator_users(id),
  created_at INTEGER NOT NULL,
  UNIQUE (workload_type,attempt_id)
);

CREATE INDEX IF NOT EXISTS idx_ops_credit_dispositions_customer
  ON ops_credit_dispositions(customer_id,created_at DESC);
