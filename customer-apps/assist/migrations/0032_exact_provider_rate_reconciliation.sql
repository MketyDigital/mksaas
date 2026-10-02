-- Reconcile MKredit rate cards exactly to stored provider-cost micros.
-- At 10,000,000 MKredit/USD, one provider-cost micro-dollar equals 10 MKredit.
-- Preserve manually configured credit rates wherever provider cost is unknown (zero).

-- Cloudflare model-specific/neuron-equivalent precision for Whisper.
UPDATE model_route_targets
SET provider_audio_cost_micros_per_minute=453,
    updated_at=unixepoch()
WHERE provider='workers-ai' AND provider_model='@cf/openai/whisper';

UPDATE model_rates
SET provider_audio_cost_micros_per_minute=453
WHERE alias='mkety-media-speech'
  AND version=(SELECT MAX(version) FROM model_rates WHERE alias='mkety-media-speech');

UPDATE model_route_targets
SET input_credits_per_million=CASE
      WHEN provider_input_cost_micros_per_million>0 THEN provider_input_cost_micros_per_million*10
      ELSE input_credits_per_million END,
    output_credits_per_million=CASE
      WHEN provider_output_cost_micros_per_million>0 THEN provider_output_cost_micros_per_million*10
      ELSE output_credits_per_million END,
    image_credits=CASE
      WHEN provider_image_cost_micros>0 THEN provider_image_cost_micros*10
      ELSE image_credits END,
    audio_credits_per_minute=CASE
      WHEN provider_audio_cost_micros_per_minute>0 THEN provider_audio_cost_micros_per_minute*10
      ELSE audio_credits_per_minute END,
    updated_at=unixepoch();

UPDATE model_rates
SET input_credits_per_million=CASE
      WHEN provider_input_cost_micros_per_million>0 THEN provider_input_cost_micros_per_million*10
      ELSE input_credits_per_million END,
    output_credits_per_million=CASE
      WHEN provider_output_cost_micros_per_million>0 THEN provider_output_cost_micros_per_million*10
      ELSE output_credits_per_million END,
    image_credits=CASE
      WHEN provider_image_cost_micros>0 THEN provider_image_cost_micros*10
      ELSE image_credits END,
    audio_credits_per_minute=CASE
      WHEN provider_audio_cost_micros_per_minute>0 THEN provider_audio_cost_micros_per_minute*10
      ELSE audio_credits_per_minute END;
