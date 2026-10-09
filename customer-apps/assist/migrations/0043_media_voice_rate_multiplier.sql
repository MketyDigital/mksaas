-- Set explicit safety base rates for provider routes with unknown media pricing.
-- Preserve known provider prices; inherit each customer's existing multiplier for
-- media/voice so this rollout does not change current percentage behavior.
ALTER TABLE commercial_policy
  ADD COLUMN media_rate_multiplier_bps INTEGER NOT NULL DEFAULT 10000;

UPDATE commercial_policy
SET media_rate_multiplier_bps=rate_multiplier_bps;

UPDATE model_route_targets
SET image_credits=CASE
      WHEN provider_image_cost_micros>0 THEN provider_image_cost_micros*10
      ELSE 200000
    END,
    updated_at=unixepoch()
WHERE alias='mkety-media-vision';

UPDATE model_route_targets
SET audio_credits_per_minute=CASE
      WHEN provider_audio_cost_micros_per_minute>0 THEN provider_audio_cost_micros_per_minute*10
      ELSE 200000
    END,
    updated_at=unixepoch()
WHERE alias='mkety-media-speech';

UPDATE model_rates
SET image_credits=CASE
      WHEN provider_image_cost_micros>0 THEN provider_image_cost_micros*10
      ELSE 200000
    END
WHERE alias='mkety-media-vision';

UPDATE model_rates
SET audio_credits_per_minute=CASE
      WHEN provider_audio_cost_micros_per_minute>0 THEN provider_audio_cost_micros_per_minute*10
      ELSE 200000
    END
WHERE alias='mkety-media-speech';
