CREATE TABLE IF NOT EXISTS operator_auth_transactions (
  id TEXT PRIMARY KEY,
  state_hash TEXT NOT NULL UNIQUE,
  code_verifier TEXT NOT NULL,
  nonce TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_operator_auth_transactions_expiry
  ON operator_auth_transactions(expires_at);
