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

CREATE TABLE IF NOT EXISTS human_approval_notification_preferences (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (customer_id,user_id)
);
