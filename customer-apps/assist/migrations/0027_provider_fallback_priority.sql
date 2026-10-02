ALTER TABLE provider_connections ADD COLUMN fallback_enabled INTEGER NOT NULL DEFAULT 0 CHECK (fallback_enabled IN (0,1));
ALTER TABLE provider_connections ADD COLUMN fallback_priority INTEGER NOT NULL DEFAULT 100;
ALTER TABLE provider_connections ADD COLUMN provider_input_cost_micros_per_million INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_connections ADD COLUMN provider_output_cost_micros_per_million INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_connections ADD COLUMN input_credits_per_million INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_connections ADD COLUMN output_credits_per_million INTEGER NOT NULL DEFAULT 0;
ALTER TABLE provider_connections ADD COLUMN provider_cost_verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_provider_connections_managed_fallback
  ON provider_connections(ownership,status,fallback_enabled,fallback_priority,provider);

-- External managed fallbacks remain off until a real inference test passes and an Ops-verified
-- provider cost card has been supplied. This prevents failover from bypassing Mkety credit economics.
