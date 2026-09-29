-- Record the 2026-09-28 managed-model benchmark decision without enabling customer inference.
-- Gemma 4 is the managed primary/economy model.
-- GLM-5.3 Flash is the managed smart/complex model.
-- Qwen 3.8 27B remains a benchmarked reserve and is not selected by default.

UPDATE "saas_template"."ai_models"
SET "status"='active', "enabled"=true, "updated_at"=now()
WHERE "provider_key"='workers-ai'
  AND "native_model" IN (
    '@cf/google/gemma-4-26b-a4b-it',
    '@cf/zai-org/glm-5.3-flash'
  );

UPDATE "saas_template"."ai_models"
SET "status"='benchmarked-reserve', "enabled"=false, "updated_at"=now()
WHERE "provider_key"='workers-ai'
  AND "native_model"='@cf/qwen/qwen3.8-27b';

INSERT INTO "saas_template"."ai_model_aliases" ("alias","model_id","stable")
SELECT 'mkety-economy', m."id", true
FROM "saas_template"."ai_models" m
WHERE m."provider_key"='workers-ai' AND m."native_model"='@cf/google/gemma-4-26b-a4b-it'
ON CONFLICT ("alias") DO UPDATE
SET "model_id"=EXCLUDED."model_id", "stable"=true, "updated_at"=now();

INSERT INTO "saas_template"."ai_model_aliases" ("alias","model_id","stable")
SELECT 'mkety-smart', m."id", true
FROM "saas_template"."ai_models" m
WHERE m."provider_key"='workers-ai' AND m."native_model"='@cf/zai-org/glm-5.3-flash'
ON CONFLICT ("alias") DO UPDATE
SET "model_id"=EXCLUDED."model_id", "stable"=true, "updated_at"=now();

INSERT INTO "saas_template"."ai_routes"
  ("tenant_id","project_id","model_alias","provider_connection_id","priority","enabled","policy")
SELECT NULL, NULL, seed.alias, NULL, 100, true, seed.policy::jsonb
FROM (VALUES
  ('mkety-economy', '{"routing":"task-class","taskClass":"economy","fallback":"mkety-smart"}'),
  ('mkety-smart', '{"routing":"task-class","taskClass":"smart","fallback":"mkety-economy"}')
) AS seed(alias, policy)
WHERE NOT EXISTS (
  SELECT 1
  FROM "saas_template"."ai_routes" r
  WHERE r."tenant_id" IS NULL
    AND r."project_id" IS NULL
    AND r."model_alias"=seed.alias
);
