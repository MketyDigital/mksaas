ALTER TABLE human_approval_requests ADD COLUMN proposed_response TEXT NOT NULL DEFAULT '';
ALTER TABLE human_approval_requests ADD COLUMN operations_destination_id TEXT;
ALTER TABLE human_approval_requests ADD COLUMN operations_message_id TEXT;
ALTER TABLE human_operations_settings ADD COLUMN human_acknowledgement TEXT NOT NULL DEFAULT 'Thanks, I have that. I’ll continue from here.';
ALTER TABLE human_approval_audit ADD COLUMN actor_telegram_user_id TEXT;
ALTER TABLE human_approval_audit ADD COLUMN destination_id TEXT;
ALTER TABLE reply_jobs ADD COLUMN delivery_role TEXT NOT NULL DEFAULT 'assistant' CHECK (delivery_role IN ('assistant','human'));
ALTER TABLE reply_jobs ADD COLUMN human_approval_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reply_jobs_human_approval_once
  ON reply_jobs(human_approval_id) WHERE human_approval_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS human_ops_destinations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'telegram' CHECK (channel='telegram'),
  chat_id TEXT NOT NULL,
  message_thread_id TEXT,
  delivery_assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  destination_type TEXT NOT NULL CHECK (destination_type IN ('group','supergroup')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','revoked')),
  allowed_kinds_json TEXT NOT NULL DEFAULT '["verify_payment","verify_partner_signup","approve_action","human_answer","custom"]',
  assistant_scope_json TEXT NOT NULL DEFAULT '[]',
  created_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_human_ops_destination_unique
  ON human_ops_destinations(customer_id,chat_id,COALESCE(message_thread_id,''));
CREATE INDEX IF NOT EXISTS idx_human_ops_destinations_customer
  ON human_ops_destinations(customer_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS human_ops_link_challenges (
  token_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  delivery_assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  assistant_scope_json TEXT NOT NULL,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  consumed_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS human_ops_actions (
  token_hash TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  approval_id TEXT NOT NULL REFERENCES human_approval_requests(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL,
  destination_id TEXT NOT NULL REFERENCES human_ops_destinations(id) ON DELETE CASCADE,
  delivery_assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approved','rejected','reply')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_human_ops_actions_request
  ON human_ops_actions(customer_id,approval_id,expires_at);

CREATE TABLE IF NOT EXISTS human_ops_reply_captures (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  destination_id TEXT NOT NULL REFERENCES human_ops_destinations(id) ON DELETE CASCADE,
  approval_id TEXT NOT NULL REFERENCES human_approval_requests(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','captured','expired','cancelled')),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  captured_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_human_ops_reply_capture_active
  ON human_ops_reply_captures(destination_id,telegram_user_id,status,expires_at);
