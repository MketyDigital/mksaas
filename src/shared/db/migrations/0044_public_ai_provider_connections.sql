BEGIN;

-- A platform connection is authoritative when one already exists. Remove the
-- duplicate public-only credential so Public and Workspace use one key.
DELETE FROM "saas_template"."ai_provider_connections" AS legacy
WHERE legacy."tenant_id" IS NULL
  AND legacy."project_id" IS NULL
  AND legacy."mode" = 'public'
  AND EXISTS (
    SELECT 1
    FROM "saas_template"."ai_provider_connections" AS platform
    WHERE platform."tenant_id" IS NULL
      AND platform."project_id" IS NULL
      AND platform."mode" = 'platform'
      AND platform."provider_key" = legacy."provider_key"
  );

-- Keep the most recently updated legacy connection if historical duplicate
-- public rows exist for the same provider. Preserve its encrypted secret.
WITH ranked_public_connections AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "provider_key"
      ORDER BY "updated_at" DESC, "id" DESC
    ) AS position
  FROM "saas_template"."ai_provider_connections"
  WHERE "tenant_id" IS NULL
    AND "project_id" IS NULL
    AND "mode" = 'public'
)
DELETE FROM "saas_template"."ai_provider_connections" AS legacy
USING ranked_public_connections AS ranked
WHERE legacy."id" = ranked."id"
  AND ranked.position > 1;

UPDATE "saas_template"."ai_provider_connections"
SET "mode" = 'platform'
WHERE "tenant_id" IS NULL
  AND "project_id" IS NULL
  AND "mode" = 'public';

COMMIT;
