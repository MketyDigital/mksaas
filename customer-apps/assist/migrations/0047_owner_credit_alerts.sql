CREATE TABLE IF NOT EXISTS owner_credit_alert_preferences (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(customer_id,user_id)
);

CREATE TABLE IF NOT EXISTS owner_credit_alert_state (
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('soft','critical')),
  armed INTEGER NOT NULL DEFAULT 1 CHECK (armed IN (0,1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(customer_id,alert_level)
);

CREATE TABLE IF NOT EXISTS owner_credit_alert_outbox (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  source_ledger_id TEXT NOT NULL REFERENCES credit_ledger(id) ON DELETE CASCADE,
  alert_level TEXT NOT NULL CHECK (alert_level IN ('soft','critical')),
  balance_atoms INTEGER NOT NULL,
  threshold_atoms INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  lease_expires_at INTEGER,
  claim_token TEXT,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  UNIQUE(source_ledger_id,alert_level)
);
CREATE INDEX IF NOT EXISTS idx_owner_credit_alert_outbox_due
  ON owner_credit_alert_outbox(status,next_attempt_at,created_at);

CREATE TABLE IF NOT EXISTS owner_credit_alert_deliveries (
  outbox_id TEXT NOT NULL REFERENCES owner_credit_alert_outbox(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','skipped','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  sent_at INTEGER,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(outbox_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_owner_credit_alert_deliveries_due
  ON owner_credit_alert_deliveries(outbox_id,status,next_attempt_at);

-- This trigger observes the existing credit ledger rather than touching credit writes.
-- It avoids re-arming on temporary inference reservation releases/refunds.
CREATE TRIGGER IF NOT EXISTS trg_owner_credit_alert_ledger_insert
AFTER INSERT ON credit_ledger
WHEN NEW.delta <> 0
BEGIN
  UPDATE owner_credit_alert_state
  SET armed=1,updated_at=NEW.created_at
  WHERE customer_id=NEW.customer_id AND armed=0
    AND NEW.delta > 0 AND NEW.kind IN ('topup','plan_funding','operator_adjustment')
    AND (
      (alert_level='critical' AND NEW.balance_after > 20000000)
      OR (alert_level='soft' AND NEW.balance_after > COALESCE((
        SELECT CAST(included_credits/5 AS INTEGER) FROM commercial_policy WHERE customer_id=NEW.customer_id
      ),0) AND COALESCE((
        SELECT CAST(included_credits/5 AS INTEGER) FROM commercial_policy WHERE customer_id=NEW.customer_id
      ),0) > 20000000)
    );

  INSERT OR IGNORE INTO owner_credit_alert_outbox
    (id,customer_id,source_ledger_id,alert_level,balance_atoms,threshold_atoms,status,attempts,next_attempt_at,created_at)
  SELECT 'oca_' || lower(hex(randomblob(16))),NEW.customer_id,NEW.id,'critical',NEW.balance_after,
    20000000,'pending',0,NEW.created_at,NEW.created_at
  WHERE NEW.delta < 0 AND NEW.balance_after <= 20000000
    AND NEW.balance_after-NEW.delta > 20000000
    AND COALESCE((SELECT armed FROM owner_credit_alert_state WHERE customer_id=NEW.customer_id AND alert_level='critical'),1)=1;

  INSERT INTO owner_credit_alert_state(customer_id,alert_level,armed,updated_at)
  SELECT NEW.customer_id,'critical',0,NEW.created_at
  WHERE EXISTS (SELECT 1 FROM owner_credit_alert_outbox WHERE source_ledger_id=NEW.id AND alert_level='critical')
  ON CONFLICT(customer_id,alert_level) DO UPDATE SET armed=0,updated_at=excluded.updated_at;

  -- A critical event subsumes the soft reminder and disarms it until true funding clears soft.
  INSERT INTO owner_credit_alert_state(customer_id,alert_level,armed,updated_at)
  SELECT NEW.customer_id,'soft',0,NEW.created_at
  WHERE EXISTS (SELECT 1 FROM owner_credit_alert_outbox WHERE source_ledger_id=NEW.id AND alert_level='critical')
  ON CONFLICT(customer_id,alert_level) DO UPDATE SET armed=0,updated_at=excluded.updated_at;

  INSERT OR IGNORE INTO owner_credit_alert_outbox
    (id,customer_id,source_ledger_id,alert_level,balance_atoms,threshold_atoms,status,attempts,next_attempt_at,created_at)
  SELECT 'oca_' || lower(hex(randomblob(16))),NEW.customer_id,NEW.id,'soft',NEW.balance_after,
    CAST(policy.included_credits/5 AS INTEGER),'pending',0,NEW.created_at,NEW.created_at
  FROM commercial_policy policy
  WHERE policy.customer_id=NEW.customer_id
    AND NEW.delta < 0
    AND policy.included_credits/5 > 20000000
    AND NEW.balance_after > 20000000
    AND NEW.balance_after <= CAST(policy.included_credits/5 AS INTEGER)
    AND NEW.balance_after-NEW.delta > CAST(policy.included_credits/5 AS INTEGER)
    AND COALESCE((SELECT armed FROM owner_credit_alert_state WHERE customer_id=NEW.customer_id AND alert_level='soft'),1)=1;

  INSERT INTO owner_credit_alert_state(customer_id,alert_level,armed,updated_at)
  SELECT NEW.customer_id,'soft',0,NEW.created_at
  WHERE EXISTS (SELECT 1 FROM owner_credit_alert_outbox WHERE source_ledger_id=NEW.id AND alert_level='soft')
  ON CONFLICT(customer_id,alert_level) DO UPDATE SET armed=0,updated_at=excluded.updated_at;
END;
