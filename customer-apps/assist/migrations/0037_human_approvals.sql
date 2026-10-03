CREATE TABLE IF NOT EXISTS human_operations_settings (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  approvals_enabled INTEGER NOT NULL DEFAULT 0 CHECK (approvals_enabled IN (0,1)),
  pause_conversation INTEGER NOT NULL DEFAULT 0 CHECK (pause_conversation IN (0,1)),
  allowed_kinds_json TEXT NOT NULL DEFAULT '["verify_payment","verify_partner_signup","approve_action","human_answer","custom"]',
  updated_at INTEGER NOT NULL,
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  PRIMARY KEY (customer_id, assistant_id)
);

CREATE TABLE IF NOT EXISTS human_approval_requests (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('verify_payment','verify_partner_signup','approve_action','human_answer','custom')),
  question TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  evidence_message_ids_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','answered','expired','cancelled')),
  decision_text TEXT,
  decided_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  decided_at INTEGER,
  expires_at INTEGER NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (customer_id, assistant_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_human_approvals_customer_status
  ON human_approval_requests(customer_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_human_approvals_conversation
  ON human_approval_requests(customer_id,assistant_id,conversation_id,created_at DESC);

CREATE TABLE IF NOT EXISTS human_approval_audit (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  actor_user_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected','answered','expired','cancelled')),
  decision_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_human_approval_audit_request
  ON human_approval_audit(customer_id,assistant_id,approval_id,created_at);
