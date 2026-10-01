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
