CREATE TABLE IF NOT EXISTS human_approval_actions (
  token_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  approval_id TEXT NOT NULL REFERENCES human_approval_requests(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL,
  delivery_assistant_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_human_approval_actions_request
  ON human_approval_actions(customer_id,approval_id,expires_at);
