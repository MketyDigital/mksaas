CREATE TABLE IF NOT EXISTS channel_health (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unknown',
  last_checked_at INTEGER,
  last_success_at INTEGER,
  last_error TEXT,
  PRIMARY KEY(customer_id,assistant_id,channel)
);

CREATE TABLE IF NOT EXISTS owner_notification_preferences (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('handoff','reminder_failure','channel_health')),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(customer_id,user_id,kind)
);
