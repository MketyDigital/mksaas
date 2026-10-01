ALTER TABLE model_routes ADD COLUMN provider_connection_id TEXT;
ALTER TABLE model_routes ADD COLUMN fallback_provider_connection_id TEXT;
ALTER TABLE model_rates ADD COLUMN provider_input_cost_micros_per_million INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_rates ADD COLUMN provider_output_cost_micros_per_million INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_rates ADD COLUMN provider_image_cost_micros INTEGER NOT NULL DEFAULT 0;
ALTER TABLE model_rates ADD COLUMN provider_audio_cost_micros_per_minute INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS provider_connections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('openai','anthropic','gemini','azure-openai','openai-compatible')),
  endpoint_url TEXT,
  api_key_ciphertext TEXT NOT NULL,
  extra_json TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO system_settings (key,value_json,updated_at)
VALUES ('commercial', '{"creditUsdMicros":1000}', unixepoch());
