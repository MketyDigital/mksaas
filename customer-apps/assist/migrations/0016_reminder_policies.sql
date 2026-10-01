ALTER TABLE conversations ADD COLUMN reminders_opt_out INTEGER NOT NULL DEFAULT 0 CHECK (reminders_opt_out IN (0,1));
ALTER TABLE reminders ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE reminders ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 3;
ALTER TABLE reminders ADD COLUMN last_error TEXT;
ALTER TABLE reminders ADD COLUMN cancelled_at INTEGER;
ALTER TABLE reminders ADD COLUMN idempotency_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_idempotency ON reminders(customer_id,idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS reminder_policies (
  assistant_id TEXT PRIMARY KEY REFERENCES assistants(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  approval_mode TEXT NOT NULL DEFAULT 'manual' CHECK (approval_mode IN ('manual','auto')),
  timezone TEXT NOT NULL DEFAULT 'UTC',
  quiet_start_hour INTEGER,
  quiet_end_hour INTEGER,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  updated_at INTEGER NOT NULL
);
