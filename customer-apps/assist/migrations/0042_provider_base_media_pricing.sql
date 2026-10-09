-- Reconcile stored customer base rates with provider cost and remove flat image
-- add-ons from token-metered image routes. The configured multiplier still applies
-- during settlement.
UPDATE model_route_targets
SET input_credits_per_million=CASE WHEN provider_input_cost_micros_per_million>0 THEN provider_input_cost_micros_per_million*10 ELSE input_credits_per_million END,
    output_credits_per_million=CASE WHEN provider_output_cost_micros_per_million>0 THEN provider_output_cost_micros_per_million*10 ELSE output_credits_per_million END,
    image_credits=CASE WHEN provider_image_cost_micros>0 THEN provider_image_cost_micros*10
                       WHEN provider_input_cost_micros_per_million>0 OR provider_output_cost_micros_per_million>0 THEN 0
                       ELSE image_credits END,
    audio_credits_per_minute=CASE WHEN provider_audio_cost_micros_per_minute>0 THEN provider_audio_cost_micros_per_minute*10 ELSE audio_credits_per_minute END,
    updated_at=unixepoch()
WHERE provider_input_cost_micros_per_million>0 OR provider_output_cost_micros_per_million>0
   OR provider_image_cost_micros>0 OR provider_audio_cost_micros_per_minute>0;

UPDATE model_rates
SET input_credits_per_million=CASE WHEN provider_input_cost_micros_per_million>0 THEN provider_input_cost_micros_per_million*10 ELSE input_credits_per_million END,
    output_credits_per_million=CASE WHEN provider_output_cost_micros_per_million>0 THEN provider_output_cost_micros_per_million*10 ELSE output_credits_per_million END,
    image_credits=CASE WHEN provider_image_cost_micros>0 THEN provider_image_cost_micros*10
                       WHEN provider_input_cost_micros_per_million>0 OR provider_output_cost_micros_per_million>0 THEN 0
                       ELSE image_credits END,
    audio_credits_per_minute=CASE WHEN provider_audio_cost_micros_per_minute>0 THEN provider_audio_cost_micros_per_minute*10 ELSE audio_credits_per_minute END
WHERE provider_input_cost_micros_per_million>0 OR provider_output_cost_micros_per_million>0
   OR provider_image_cost_micros>0 OR provider_audio_cost_micros_per_minute>0;
