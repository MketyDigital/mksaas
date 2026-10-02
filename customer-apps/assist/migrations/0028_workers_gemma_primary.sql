-- Enforce the intended default Workers AI chain on existing production data.
-- Text/default Workers AI: Gemma 4 primary, GLM 5.3 Flash fallback.
-- Image preprocessing and voice transcription remain runtime-direct Gemma/Whisper paths.

UPDATE model_routes
SET provider='workers-ai',
    provider_model='@cf/google/gemma-4-26b-a4b-it',
    provider_connection_id=NULL,
    fallback_provider='workers-ai',
    fallback_model='@cf/zai-org/glm-5.3-flash',
    fallback_provider_connection_id=NULL,
    status='active',
    updated_at=unixepoch()
WHERE alias IN ('mkety-fast','mkety-smart','mkety-reasoning','mkety-vision');

UPDATE model_route_targets
SET provider='workers-ai',
    provider_model='@cf/google/gemma-4-26b-a4b-it',
    provider_connection_id=NULL,
    enabled=1,
    updated_at=unixepoch()
WHERE scope_key IN (
  'global:mkety-fast',
  'global:mkety-smart',
  'global:mkety-reasoning',
  'global:mkety-vision'
) AND position=0;

UPDATE model_route_targets
SET provider='workers-ai',
    provider_model='@cf/zai-org/glm-5.3-flash',
    provider_connection_id=NULL,
    enabled=1,
    updated_at=unixepoch()
WHERE scope_key IN (
  'global:mkety-fast',
  'global:mkety-smart',
  'global:mkety-reasoning',
  'global:mkety-vision'
) AND position=1;

INSERT OR IGNORE INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at
)
SELECT
  p.scope_key,NULL,p.alias,1,'workers-ai','@cf/zai-org/glm-5.3-flash',NULL,1,
  p.input_credits_per_million,p.output_credits_per_million,p.image_credits,p.audio_credits_per_minute,
  p.provider_input_cost_micros_per_million,p.provider_output_cost_micros_per_million,
  p.provider_image_cost_micros,p.provider_audio_cost_micros_per_minute,unixepoch(),unixepoch()
FROM model_route_targets p
WHERE p.scope_key IN (
  'global:mkety-fast',
  'global:mkety-smart',
  'global:mkety-reasoning',
  'global:mkety-vision'
) AND p.position=0;

DELETE FROM model_route_targets
WHERE scope_key IN (
  'global:mkety-fast',
  'global:mkety-smart',
  'global:mkety-reasoning',
  'global:mkety-vision'
)
AND provider='workers-ai'
AND position>1;
