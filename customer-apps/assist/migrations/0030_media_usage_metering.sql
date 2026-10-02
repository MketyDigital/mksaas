-- Accurate media capability economics and per-job attribution.
ALTER TABLE reply_jobs ADD COLUMN media_usage_json TEXT;

-- Provider list prices in USD micros. Customer MKredit rates derive from the
-- operator-controlled commercial.creditUsdMicros conversion.
WITH commercial AS (
  SELECT MAX(1, COALESCE(CAST(json_extract(value_json,'$.creditUsdMicros') AS INTEGER),1000)) AS credit_usd_micros
  FROM system_settings WHERE key='commercial'
)
UPDATE model_route_targets
SET provider_input_cost_micros_per_million=100000,
    provider_output_cost_micros_per_million=300000,
    input_credits_per_million=(100000 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    output_credits_per_million=(300000 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    updated_at=unixepoch()
WHERE alias='mkety-media-vision' AND provider='workers-ai' AND provider_model='@cf/google/gemma-4-26b-a4b-it';

WITH commercial AS (
  SELECT MAX(1, COALESCE(CAST(json_extract(value_json,'$.creditUsdMicros') AS INTEGER),1000)) AS credit_usd_micros
  FROM system_settings WHERE key='commercial'
)
UPDATE model_route_targets
SET provider_input_cost_micros_per_million=150000,
    provider_output_cost_micros_per_million=500000,
    input_credits_per_million=(150000 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    output_credits_per_million=(500000 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    updated_at=unixepoch()
WHERE alias='mkety-media-vision' AND provider='workers-ai' AND provider_model='@cf/zai-org/glm-5.3-flash';

WITH commercial AS (
  SELECT MAX(1, COALESCE(CAST(json_extract(value_json,'$.creditUsdMicros') AS INTEGER),1000)) AS credit_usd_micros
  FROM system_settings WHERE key='commercial'
)
UPDATE model_route_targets
SET provider_audio_cost_micros_per_minute=500,
    audio_credits_per_minute=(500 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    updated_at=unixepoch()
WHERE alias='mkety-media-speech' AND provider='workers-ai' AND provider_model='@cf/openai/whisper';

WITH commercial AS (
  SELECT MAX(1, COALESCE(CAST(json_extract(value_json,'$.creditUsdMicros') AS INTEGER),1000)) AS credit_usd_micros
  FROM system_settings WHERE key='commercial'
)
UPDATE model_route_targets
SET provider_audio_cost_micros_per_minute=513,
    audio_credits_per_minute=(513 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    updated_at=unixepoch()
WHERE alias='mkety-media-speech' AND provider='workers-ai' AND provider_model='@cf/openai/whisper-large-v3-turbo';

WITH commercial AS (
  SELECT MAX(1, COALESCE(CAST(json_extract(value_json,'$.creditUsdMicros') AS INTEGER),1000)) AS credit_usd_micros
  FROM system_settings WHERE key='commercial'
)
UPDATE model_route_targets
SET provider_audio_cost_micros_per_minute=5200,
    audio_credits_per_minute=(5200 + (SELECT credit_usd_micros FROM commercial)-1)/(SELECT credit_usd_micros FROM commercial),
    updated_at=unixepoch()
WHERE alias='mkety-media-speech' AND provider='workers-ai' AND provider_model='@cf/deepgram/nova-3';

-- Keep alias-level defaults aligned to the default primary media targets.
UPDATE model_rates SET
  input_credits_per_million=(SELECT input_credits_per_million FROM model_route_targets WHERE scope_key='global:mkety-media-vision' AND position=0),
  output_credits_per_million=(SELECT output_credits_per_million FROM model_route_targets WHERE scope_key='global:mkety-media-vision' AND position=0),
  provider_input_cost_micros_per_million=100000,
  provider_output_cost_micros_per_million=300000
WHERE alias='mkety-media-vision' AND version=(SELECT MAX(version) FROM model_rates WHERE alias='mkety-media-vision');

UPDATE model_rates SET
  audio_credits_per_minute=(SELECT audio_credits_per_minute FROM model_route_targets WHERE scope_key='global:mkety-media-speech' AND position=0),
  provider_audio_cost_micros_per_minute=500
WHERE alias='mkety-media-speech' AND version=(SELECT MAX(version) FROM model_rates WHERE alias='mkety-media-speech');
