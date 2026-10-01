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


-- Current safe Workers AI defaults for first deployment. These are versioned
-- as v2 so historical v1 rows remain immutable.
UPDATE model_routes
SET provider='workers-ai',
    provider_model='@cf/zai-org/glm-4.7-flash',
    provider_connection_id=NULL,
    updated_at=unixepoch()
WHERE alias='mkety-fast';

UPDATE model_routes
SET provider='workers-ai',
    provider_model='@cf/zai-org/glm-5.3-flash',
    provider_connection_id=NULL,
    updated_at=unixepoch()
WHERE alias='mkety-smart';

INSERT OR IGNORE INTO model_rates (
  id,alias,version,input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,provider_image_cost_micros,
  provider_audio_cost_micros_per_minute,effective_at,created_at
) VALUES
('rate_fast_v2','mkety-fast',2,60,400,0,1,60000,400000,0,500,unixepoch(),unixepoch()),
('rate_smart_v2','mkety-smart',2,150,500,0,1,150000,500000,0,500,unixepoch(),unixepoch());


INSERT OR IGNORE INTO model_routes
(id,alias,provider,provider_model,fallback_provider,fallback_model,status,created_at,updated_at)
VALUES
('route_reasoning','mkety-reasoning','workers-ai','@cf/zai-org/glm-5.3-flash','workers-ai','@cf/google/gemma-4-26b-a4b-it','active',unixepoch(),unixepoch()),
('route_vision','mkety-vision','workers-ai','@cf/google/gemma-4-26b-a4b-it','workers-ai','@cf/zai-org/glm-5.3-flash','active',unixepoch(),unixepoch());

INSERT OR IGNORE INTO model_rates (
  id,alias,version,input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,provider_image_cost_micros,
  provider_audio_cost_micros_per_minute,effective_at,created_at
) VALUES
('rate_reasoning_v1','mkety-reasoning',1,150,500,0,1,150000,500000,0,500,unixepoch(),unixepoch()),
('rate_vision_v1','mkety-vision',1,100,300,0,1,100000,300000,0,500,unixepoch(),unixepoch());
