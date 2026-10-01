ALTER TABLE commercial_policy ADD COLUMN funding_mode TEXT NOT NULL DEFAULT 'full_period'
  CHECK (funding_mode IN ('full_period','prepaid_partial'));
ALTER TABLE commercial_policy ADD COLUMN minimum_funding_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commercial_policy ADD COLUMN setup_fee_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commercial_policy ADD COLUMN credit_rollover INTEGER NOT NULL DEFAULT 1 CHECK (credit_rollover IN (0,1));

UPDATE commercial_policy
SET provider_envelope_bps=1500,
    operations_reserve_bps=1000,
    rate_multiplier_bps=10000
WHERE provider_envelope_bps=2500
  AND operations_reserve_bps=300
  AND rate_multiplier_bps=10000;
