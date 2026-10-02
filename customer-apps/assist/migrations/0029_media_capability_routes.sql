-- Capability-specific media routing for Assist.
-- These aliases are operator-managed routes, not selectable customer assistant models.
-- Vision and speech can be run Workers-only, frontier-only, or mixed by reordering/disabling targets in Ops.

INSERT OR IGNORE INTO model_routes
(id,alias,provider,provider_model,fallback_provider,fallback_model,status,created_at,updated_at,byok_policy)
VALUES
('route_media_vision','mkety-media-vision','workers-ai','@cf/google/gemma-4-26b-a4b-it','workers-ai','@cf/zai-org/glm-5.3-flash','active',unixepoch(),unixepoch(),'managed'),
('route_media_speech','mkety-media-speech','workers-ai','@cf/openai/whisper','workers-ai','@cf/openai/whisper-large-v3-turbo','active',unixepoch(),unixepoch(),'managed');

INSERT OR IGNORE INTO model_rates (
  id,alias,version,input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,provider_image_cost_micros,
  provider_audio_cost_micros_per_minute,effective_at,created_at
) VALUES
('rate_media_vision_v1','mkety-media-vision',1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch()),
('rate_media_speech_v1','mkety-media-speech',1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch());

INSERT OR IGNORE INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,created_at,updated_at
) VALUES
('global:mkety-media-vision',NULL,'mkety-media-vision',0,'workers-ai','@cf/google/gemma-4-26b-a4b-it',NULL,1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch()),
('global:mkety-media-vision',NULL,'mkety-media-vision',1,'workers-ai','@cf/zai-org/glm-5.3-flash',NULL,1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch()),
('global:mkety-media-speech',NULL,'mkety-media-speech',0,'workers-ai','@cf/openai/whisper',NULL,1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch()),
('global:mkety-media-speech',NULL,'mkety-media-speech',1,'workers-ai','@cf/openai/whisper-large-v3-turbo',NULL,1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch()),
('global:mkety-media-speech',NULL,'mkety-media-speech',2,'workers-ai','@cf/deepgram/nova-3',NULL,1,0,0,0,0,0,0,0,0,unixepoch(),unixepoch());
