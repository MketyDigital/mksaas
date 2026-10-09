-- Local/preview databases may not have the production connection. In that
-- case this migration is a safe no-op; the production cutover acceptance gate
-- must verify zero Sol references before serving traffic on the new version.
-- D1 does not allow temporary tables inside migrations; this helper table is
-- created and dropped inside the migration transaction.
CREATE TABLE _migration_0044_luna_scopes AS
SELECT DISTINCT scope_key,customer_id,alias
FROM model_route_targets
WHERE lower(provider_model) LIKE '%gpt-5.6-sol%'
  AND alias <> 'mkety-media-speech'
  AND EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider='azure-foundry' AND default_model='gpt-6-luna-1'
      AND status='active' AND validated_at IS NOT NULL AND ownership='mkety'
  );

-- Move existing rows out of the active ordinal range, remove only Sol and any
-- previous Luna row, then compact the unchanged non-Sol chain after Luna.
UPDATE model_route_targets
SET position=position+10000
  WHERE scope_key IN (SELECT scope_key FROM _migration_0044_luna_scopes);

DELETE FROM model_route_targets
WHERE scope_key IN (SELECT scope_key FROM _migration_0044_luna_scopes)
  AND (lower(provider_model) LIKE '%gpt-5.6-sol%' OR
       (provider='azure-foundry' AND provider_model='gpt-6-luna-1'));

INSERT INTO model_route_targets (
  scope_key,customer_id,alias,position,provider,provider_model,provider_connection_id,enabled,
  input_credits_per_million,output_credits_per_million,image_credits,audio_credits_per_minute,
  provider_input_cost_micros_per_million,provider_output_cost_micros_per_million,
  provider_image_cost_micros,provider_audio_cost_micros_per_minute,
  created_at,updated_at,reasoning_capabilities_json,reasoning_credits_per_million,
  provider_reasoning_cost_micros_per_million
)
SELECT s.scope_key,s.customer_id,s.alias,0,'azure-foundry','gpt-6-luna-1',pc.id,1,
       20000000,100000000,0,0,0,0,0,0,unixepoch(),unixepoch(),
       '["standard","high","maximum"]',NULL,NULL
FROM _migration_0044_luna_scopes s
JOIN provider_connections pc ON pc.id=(SELECT id FROM provider_connections
  WHERE provider='azure-foundry' AND default_model='gpt-6-luna-1' AND status='active'
    AND validated_at IS NOT NULL AND ownership='mkety'
  ORDER BY created_at DESC LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM model_route_targets t
  WHERE t.scope_key=s.scope_key AND t.position=0
);

-- Reindex preserved fallback rows without changing their values/order.
UPDATE model_route_targets
SET position=position+10000
WHERE scope_key IN (SELECT scope_key FROM _migration_0044_luna_scopes)
  AND position>=10000;

WITH ranked AS (
  SELECT scope_key,position,
         ROW_NUMBER() OVER (PARTITION BY scope_key ORDER BY position)-1 AS new_position
  FROM model_route_targets
  WHERE scope_key IN (SELECT scope_key FROM _migration_0044_luna_scopes)
)
UPDATE model_route_targets
SET position=(SELECT new_position FROM ranked r
              WHERE r.scope_key=model_route_targets.scope_key
                AND r.position=model_route_targets.position)
WHERE scope_key IN (SELECT scope_key FROM _migration_0044_luna_scopes);

-- Keep legacy route summaries in sync for older readers and operator screens.
UPDATE model_routes
SET provider='azure-foundry',provider_model='gpt-6-luna-1',
    provider_connection_id=(SELECT id FROM provider_connections WHERE provider='azure-foundry'
      AND default_model='gpt-6-luna-1' AND status='active' AND validated_at IS NOT NULL
      AND ownership='mkety' ORDER BY created_at DESC LIMIT 1),
    fallback_provider=(SELECT provider FROM model_route_targets
      WHERE scope_key=('global:' || model_routes.alias) AND position>0 AND enabled=1 ORDER BY position LIMIT 1),
    fallback_model=(SELECT provider_model FROM model_route_targets
      WHERE scope_key=('global:' || model_routes.alias) AND position>0 AND enabled=1 ORDER BY position LIMIT 1),
    fallback_provider_connection_id=(SELECT provider_connection_id FROM model_route_targets
      WHERE scope_key=('global:' || model_routes.alias) AND position>0 AND enabled=1 ORDER BY position LIMIT 1),
    updated_at=unixepoch()
WHERE alias IN (SELECT alias FROM _migration_0044_luna_scopes);

UPDATE customer_model_routes
SET provider='azure-foundry',provider_model='gpt-6-luna-1',
    provider_connection_id=(SELECT id FROM provider_connections WHERE provider='azure-foundry'
      AND default_model='gpt-6-luna-1' AND status='active' AND validated_at IS NOT NULL
      AND ownership='mkety' ORDER BY created_at DESC LIMIT 1),
    fallback_provider=(SELECT provider FROM model_route_targets
      WHERE scope_key=('customer:' || customer_model_routes.customer_id || ':' || customer_model_routes.alias)
        AND position>0 AND enabled=1 ORDER BY position LIMIT 1),
    fallback_model=(SELECT provider_model FROM model_route_targets
      WHERE scope_key=('customer:' || customer_model_routes.customer_id || ':' || customer_model_routes.alias)
        AND position>0 AND enabled=1 ORDER BY position LIMIT 1),
    fallback_provider_connection_id=(SELECT provider_connection_id FROM model_route_targets
      WHERE scope_key=('customer:' || customer_model_routes.customer_id || ':' || customer_model_routes.alias)
        AND position>0 AND enabled=1 ORDER BY position LIMIT 1),
    updated_at=unixepoch()
WHERE EXISTS (
  SELECT 1 FROM _migration_0044_luna_scopes s
  WHERE s.scope_key=('customer:' || customer_model_routes.customer_id || ':' || customer_model_routes.alias)
);

DROP TABLE _migration_0044_luna_scopes;
