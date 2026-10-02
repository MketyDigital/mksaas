ALTER TABLE provider_connections ADD COLUMN fallback_enabled INTEGER NOT NULL DEFAULT 0 CHECK (fallback_enabled IN (0,1));
ALTER TABLE provider_connections ADD COLUMN fallback_priority INTEGER NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS idx_provider_connections_managed_fallback
  ON provider_connections(ownership,status,fallback_enabled,fallback_priority,provider);

-- Existing external connections remain disabled as automatic fallbacks until Ops explicitly enables them.
-- Repository-bootstrapped Azure Foundry is promoted by runtime bootstrap after a successful real inference test.
