ALTER TABLE telegram_link_challenges ADD COLUMN assistant_id TEXT;
ALTER TABLE users ADD COLUMN telegram_recovery_assistant_id TEXT;

ALTER TABLE customers ADD COLUMN billing_status TEXT NOT NULL DEFAULT 'current';
ALTER TABLE customers ADD COLUMN grace_until INTEGER;
