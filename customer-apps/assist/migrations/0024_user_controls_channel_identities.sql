ALTER TABLE conversations ADD COLUMN last_sender_id TEXT;

CREATE TABLE IF NOT EXISTS account_controls (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','suspended','banned')),
  reason TEXT,
  expires_at INTEGER,
  updated_by_operator_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (customer_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_account_controls_state ON account_controls(customer_id,state,expires_at);

CREATE TABLE IF NOT EXISTS channel_sender_controls (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'active' CHECK (state IN ('active','paused','suspended','banned')),
  reason TEXT,
  expires_at INTEGER,
  updated_by_operator_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (assistant_id,channel,sender_id)
);
CREATE INDEX IF NOT EXISTS idx_channel_sender_controls_state ON channel_sender_controls(customer_id,assistant_id,channel,state,expires_at);

CREATE TABLE IF NOT EXISTS assistant_channel_identities (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  assistant_id TEXT NOT NULL REFERENCES assistants(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  platform_user_id TEXT NOT NULL,
  identity_role TEXT NOT NULL CHECK (identity_role IN ('owner','operator','assistant','connected_account')),
  connection_mode TEXT NOT NULL DEFAULT 'bot_api' CHECK (connection_mode IN ('bot_api','secretary','mtproto','other')),
  is_self_identity INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(assistant_id,channel,platform_user_id)
);
CREATE INDEX IF NOT EXISTS idx_assistant_channel_identities_lookup
  ON assistant_channel_identities(assistant_id,channel,platform_user_id,is_self_identity);
