-- Reconcile managed Workers AI model selection after the 2026-09-28 benchmark.
-- This migration is intentionally idempotent and data-repair oriented. It exists
-- because some connected environments recorded later Drizzle migration history
-- without materializing the model-selection seed rows from 0027.

INSERT INTO "saas_template"."ai_models"
  ("provider_key","native_model","display_name","status","managed","enabled","capabilities","limits","provider_cost_metadata")
VALUES
  (
    'workers-ai',
    '@cf/google/gemma-4-26b-a4b-it',
    'Gemma 4 26B A4B',
    'active',
    true,
    true,
    '{"text":true,"vision":true,"embeddings":false,"tools":true,"reasoning":true,"structuredOutput":true}'::jsonb,
    '{"contextTokens":256000}'::jsonb,
    '{"inputPerMillionUsd":0.10,"outputPerMillionUsd":0.30,"verifiedOn":"2026-09-28"}'::jsonb
  ),
  (
    'workers-ai',
    '@cf/zai-org/glm-5.3-flash',
    'GLM-5.3 Flash',
    'active',
    true,
    true,
    '{"text":true,"vision":true,"embeddings":false,"tools":true,"reasoning":true,"structuredOutput":true}'::jsonb,
    '{"contextTokens":1310720}'::jsonb,
    '{"inputPerMillionUsd":0.15,"outputPerMillionUsd":0.50,"cachedInputPerMillionUsd":0.03,"verifiedOn":"2026-09-28"}'::jsonb
  ),
  (
    'workers-ai',
    '@cf/qwen/qwen3.8-27b',
    'Qwen 3.8 27B',
    'benchmarked-reserve',
    true,
    false,
    '{"text":true,"vision":true,"embeddings":false,"tools":true,"reasoning":true,"structuredOutput":true}'::jsonb,
    '{"contextTokens":262144}'::jsonb,
    '{"inputPerMillionUsd":0.45,"outputPerMillionUsd":3.20,"cachedInputPerMillionUsd":0.05,"verifiedOn":"2026-09-28"}'::jsonb
  )
ON CONFLICT ("provider_key","native_model") DO UPDATE
SET
  "display_name"=EXCLUDED."display_name",
  "status"=EXCLUDED."status",
  "managed"=EXCLUDED."managed",
  "enabled"=EXCLUDED."enabled",
  "capabilities"=EXCLUDED."capabilities",
  "limits"=EXCLUDED."limits",
  "provider_cost_metadata"=EXCLUDED."provider_cost_metadata",
  "updated_at"=now();
--> statement-breakpoint

INSERT INTO "saas_template"."ai_model_aliases" ("alias","model_id","stable")
SELECT 'mkety-economy', m."id", true
FROM "saas_template"."ai_models" m
WHERE m."provider_key"='workers-ai'
  AND m."native_model"='@cf/google/gemma-4-26b-a4b-it'
ON CONFLICT ("alias") DO UPDATE
SET "model_id"=EXCLUDED."model_id", "stable"=true, "updated_at"=now();
--> statement-breakpoint

INSERT INTO "saas_template"."ai_model_aliases" ("alias","model_id","stable")
SELECT 'mkety-smart', m."id", true
FROM "saas_template"."ai_models" m
WHERE m."provider_key"='workers-ai'
  AND m."native_model"='@cf/zai-org/glm-5.3-flash'
ON CONFLICT ("alias") DO UPDATE
SET "model_id"=EXCLUDED."model_id", "stable"=true, "updated_at"=now();
--> statement-breakpoint

UPDATE "saas_template"."ai_routes"
SET
  "priority"=100,
  "enabled"=true,
  "policy"='{"routing":"task-class","taskClass":"economy","fallback":"mkety-smart"}'::jsonb,
  "updated_at"=now()
WHERE "tenant_id" IS NULL
  AND "project_id" IS NULL
  AND "model_alias"='mkety-economy';
--> statement-breakpoint

INSERT INTO "saas_template"."ai_routes"
  ("tenant_id","project_id","model_alias","provider_connection_id","priority","enabled","policy")
SELECT
  NULL,
  NULL,
  'mkety-economy',
  NULL,
  100,
  true,
  '{"routing":"task-class","taskClass":"economy","fallback":"mkety-smart"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM "saas_template"."ai_routes"
  WHERE "tenant_id" IS NULL
    AND "project_id" IS NULL
    AND "model_alias"='mkety-economy'
);
--> statement-breakpoint

UPDATE "saas_template"."ai_routes"
SET
  "priority"=100,
  "enabled"=true,
  "policy"='{"routing":"task-class","taskClass":"smart","fallback":"mkety-economy"}'::jsonb,
  "updated_at"=now()
WHERE "tenant_id" IS NULL
  AND "project_id" IS NULL
  AND "model_alias"='mkety-smart';
--> statement-breakpoint

INSERT INTO "saas_template"."ai_routes"
  ("tenant_id","project_id","model_alias","provider_connection_id","priority","enabled","policy")
SELECT
  NULL,
  NULL,
  'mkety-smart',
  NULL,
  100,
  true,
  '{"routing":"task-class","taskClass":"smart","fallback":"mkety-economy"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1
  FROM "saas_template"."ai_routes"
  WHERE "tenant_id" IS NULL
    AND "project_id" IS NULL
    AND "model_alias"='mkety-smart'
);
