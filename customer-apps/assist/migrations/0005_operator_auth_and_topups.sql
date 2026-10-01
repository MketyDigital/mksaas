CREATE TABLE IF NOT EXISTS operator_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  password_salt TEXT,
  password_iterations INTEGER NOT NULL DEFAULT 310000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS operator_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  operator_user_id TEXT NOT NULL REFERENCES operator_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operator_sessions_expiry ON operator_sessions(expires_at);

CREATE TABLE IF NOT EXISTS operator_setup_tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_checkouts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reference TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  credits INTEGER NOT NULL,
  canonical_amount_minor INTEGER NOT NULL,
  canonical_currency TEXT NOT NULL DEFAULT 'USD',
  provider_amount_minor INTEGER,
  provider_currency TEXT,
  provider_payment_id TEXT,
  provider_event_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed','cancelled')),
  created_at INTEGER NOT NULL,
  settled_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payment_checkouts_customer ON payment_checkouts(customer_id,created_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_payment_checkout_grant_credits
AFTER UPDATE OF status ON payment_checkouts
WHEN OLD.status='pending' AND NEW.status='paid'
BEGIN
  UPDATE credit_accounts
  SET balance=balance+NEW.credits,
      lifetime_granted=lifetime_granted+NEW.credits,
      updated_at=unixepoch()
  WHERE customer_id=NEW.customer_id;

  INSERT INTO credit_ledger
  (id,customer_id,assistant_id,delta,kind,reference_id,balance_after,created_at)
  SELECT
    'led_' || lower(hex(randomblob(16))),
    NEW.customer_id,
    NULL,
    NEW.credits,
    'topup',
    NEW.id,
    balance,
    unixepoch()
  FROM credit_accounts
  WHERE customer_id=NEW.customer_id;
END;
