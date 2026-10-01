ALTER TABLE payment_checkouts ADD COLUMN settlement_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_checkout_settlement_key ON payment_checkouts(settlement_key) WHERE settlement_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS payment_method_health (
  method TEXT PRIMARY KEY CHECK (method IN ('nowpayments','flutterwave','kora')),
  enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
  healthy INTEGER NOT NULL DEFAULT 0 CHECK (healthy IN (0,1)),
  config_json TEXT,
  updated_at INTEGER NOT NULL
);
INSERT OR IGNORE INTO payment_method_health(method,enabled,healthy,updated_at) VALUES
('nowpayments',0,0,unixepoch()),
('flutterwave',1,1,unixepoch()),
('kora',0,0,unixepoch());
