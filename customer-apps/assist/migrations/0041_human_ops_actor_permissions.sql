CREATE TABLE IF NOT EXISTS human_ops_actor_permissions (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  destination_id TEXT NOT NULL REFERENCES human_ops_destinations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  allowed_kinds_json TEXT NOT NULL DEFAULT '[]',
  can_reply INTEGER NOT NULL DEFAULT 0 CHECK (can_reply IN (0,1)),
  updated_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (destination_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_human_ops_actor_permissions_customer
  ON human_ops_actor_permissions(customer_id,destination_id,user_id);
