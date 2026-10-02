ALTER TABLE provider_connections ADD COLUMN default_model TEXT;

CREATE TABLE IF NOT EXISTS model_route_targets (
  scope_key TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(id) ON DELETE CASCADE,
  alias TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0),
  provider TEXT NOT NULL,
  provider_model TEXT NOT NULL,
  provider_connection_id TEXT REFERENCES provider_connections(id) ON DELETE RESTRICT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  input_credits_per_million INTEGER NOT NULL DEFAULT 0,
  output_credits_per_million INTEGER NOT NULL DEFAULT 0,
  image_credits INTEGER NOT NULL DEFAULT 0,
  audio_credits_per_minute INTEGER NOT NULL DEFAULT 0,
  provider_input_cost_micros_per_million INTEGER NOT NULL DEFAULT 0,
  provider_output_cost_micros_per_million INTEGER NOT NULL DEFAULT 0,
  provider_image_cost_micros INTEGER NOT NULL DEFAULT 0,
  provider_audio_cost_micros_per_minute INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(scope_key,position)
);

CREATE INDEX IF NOT EXISTS idx_model_route_targets_lookup
  ON model_route_targets(scope_key,enabled,position);

INSERT OR IGNORE INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at
)
SELECT
  'global:' || r.alias,NULL,r.alias,0,r.provider,r.provider_model,r.provider_connection_id,
  CASE WHEN r.status='active' THEN 1 ELSE 0 END,
  COALESCE(m.input_credits_per_million,0),COALESCE(m.output_credits_per_million,0),
  COALESCE(m.image_credits,0),COALESCE(m.audio_credits_per_minute,0),
  COALESCE(m.provider_input_cost_micros_per_million,0),COALESCE(m.provider_output_cost_micros_per_million,0),
  COALESCE(m.provider_image_cost_micros,0),COALESCE(m.provider_audio_cost_micros_per_minute,0),
  strftime('%s','now'),strftime('%s','now')
FROM model_routes r
LEFT JOIN model_rates m ON m.id=(
  SELECT id FROM model_rates x WHERE x.alias=r.alias ORDER BY x.version DESC LIMIT 1
);

INSERT OR IGNORE INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at
)
SELECT
  'global:' || r.alias,NULL,r.alias,1,r.fallback_provider,r.fallback_model,r.fallback_provider_connection_id,1,
  COALESCE(m.input_credits_per_million,0),COALESCE(m.output_credits_per_million,0),
  COALESCE(m.image_credits,0),COALESCE(m.audio_credits_per_minute,0),
  COALESCE(m.provider_input_cost_micros_per_million,0),COALESCE(m.provider_output_cost_micros_per_million,0),
  COALESCE(m.provider_image_cost_micros,0),COALESCE(m.provider_audio_cost_micros_per_minute,0),
  strftime('%s','now'),strftime('%s','now')
FROM model_routes r
LEFT JOIN model_rates m ON m.id=(
  SELECT id FROM model_rates x WHERE x.alias=r.alias ORDER BY x.version DESC LIMIT 1
)
WHERE r.fallback_provider IS NOT NULL AND r.fallback_model IS NOT NULL;

INSERT OR IGNORE INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at
)
SELECT
  'customer:' || c.customer_id || ':' || c.alias,c.customer_id,c.alias,0,c.provider,c.provider_model,c.provider_connection_id,
  CASE WHEN c.status='active' THEN 1 ELSE 0 END,
  COALESCE(m.input_credits_per_million,0),COALESCE(m.output_credits_per_million,0),
  COALESCE(m.image_credits,0),COALESCE(m.audio_credits_per_minute,0),
  COALESCE(m.provider_input_cost_micros_per_million,0),COALESCE(m.provider_output_cost_micros_per_million,0),
  COALESCE(m.provider_image_cost_micros,0),COALESCE(m.provider_audio_cost_micros_per_minute,0),
  strftime('%s','now'),strftime('%s','now')
FROM customer_model_routes c
LEFT JOIN model_rates m ON m.id=(
  SELECT id FROM model_rates x WHERE x.alias=c.alias ORDER BY x.version DESC LIMIT 1
);

INSERT OR IGNORE INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at
)
SELECT
  'customer:' || c.customer_id || ':' || c.alias,c.customer_id,c.alias,1,c.fallback_provider,c.fallback_model,c.fallback_provider_connection_id,1,
  COALESCE(m.input_credits_per_million,0),COALESCE(m.output_credits_per_million,0),
  COALESCE(m.image_credits,0),COALESCE(m.audio_credits_per_minute,0),
  COALESCE(m.provider_input_cost_micros_per_million,0),COALESCE(m.provider_output_cost_micros_per_million,0),
  COALESCE(m.provider_image_cost_micros,0),COALESCE(m.provider_audio_cost_micros_per_minute,0),
  strftime('%s','now'),strftime('%s','now')
FROM customer_model_routes c
LEFT JOIN model_rates m ON m.id=(
  SELECT id FROM model_rates x WHERE x.alias=c.alias ORDER BY x.version DESC LIMIT 1
)
WHERE c.fallback_provider IS NOT NULL AND c.fallback_model IS NOT NULL;
