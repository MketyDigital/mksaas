CREATE TABLE IF NOT EXISTS telegram_business_connections (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  business_connection_id TEXT NOT NULL,
  business_user_id TEXT NOT NULL,
  user_chat_id TEXT,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  rights_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id,business_connection_id)
);
CREATE INDEX IF NOT EXISTS idx_tg_business_connection_owner
  ON telegram_business_connections(assistant_id,business_user_id,is_enabled);

CREATE TABLE IF NOT EXISTS user_access_controls (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','suspended','banned')),
  reason TEXT,
  changed_by_operator_id TEXT,
  changed_at INTEGER NOT NULL,
  PRIMARY KEY(customer_id,user_id)
);

CREATE TABLE IF NOT EXISTS conversation_access_controls (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  external_sender_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','suspended','banned')),
  reason TEXT,
  changed_by_operator_id TEXT,
  changed_at INTEGER NOT NULL,
  PRIMARY KEY(customer_id,assistant_id,channel,external_sender_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_access_controls_state
  ON conversation_access_controls(customer_id,assistant_id,state);
