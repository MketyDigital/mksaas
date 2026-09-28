-- Make Mkety Mail commercial/product operations available on existing production databases.
-- This migration is additive and does not rewrite existing Billing history.

INSERT INTO "saas_template"."billing_plans" ("key","name","description","status")
VALUES
  ('mail-starter','Mail Starter','Professional business email for solo operators and small teams.','active'),
  ('mail-growth','Mail Growth','Business email, shared inboxes and customer communication for growing teams.','active'),
  ('mail-business','Mail Business','Higher-capacity business email, API/SMTP and team communication controls.','active')
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "status" = 'active',
  "updated_at" = now();

WITH desired("key","amount_minor") AS (
  VALUES
    ('mail-starter', 499::bigint),
    ('mail-growth', 999::bigint),
    ('mail-business', 2499::bigint)
)
INSERT INTO "saas_template"."billing_plan_versions"
  ("plan_id","version","amount_minor","currency","billing_interval","is_public","metadata_reference","effective_from")
SELECT
  p."id",
  COALESCE((SELECT MAX(v2."version") FROM "saas_template"."billing_plan_versions" v2 WHERE v2."plan_id" = p."id"),0) + 1,
  d."amount_minor",
  'USD',
  'monthly',
  true,
  'self-service:' || d."key",
  now()
FROM desired d
JOIN "saas_template"."billing_plans" p ON p."key" = d."key"
WHERE NOT EXISTS (
  SELECT 1
  FROM "saas_template"."billing_plan_versions" v
  WHERE v."plan_id" = p."id" AND v."effective_to" IS NULL
);

INSERT INTO "saas_template"."billing_plan_version_entitlements"
  ("plan_version_id","entitlement_key","enabled")
SELECT v."id",'workspace.mail',true
FROM "saas_template"."billing_plan_versions" v
JOIN "saas_template"."billing_plans" p ON p."id" = v."plan_id"
WHERE p."key" IN ('mail-starter','mail-growth','mail-business')
  AND v."effective_to" IS NULL
ON CONFLICT ("plan_version_id","entitlement_key") DO UPDATE SET "enabled" = true;

INSERT INTO "saas_template"."platform_app_control_center_modules"
  ("module_key","label","description","href","icon_key","level","enabled","required_permission","sort_order","status","metadata_json","published_at")
VALUES (
  'mail-operations',
  'Mkety Mail',
  'Operate Mail tenants, reconcile the commercial catalog, manage workspace state, domain sending/routing readiness, and inspect product capacity without exposing provider secrets.',
  '/admin/platform-control/mail',
  'mail',
  3,
  true,
  'platform:plans',
  47,
  'published',
  '{"domain":"multi-domain","status":"active","editableScope":["Mail catalog reconciliation","tenant Mail status","onboarding state","domain sending/routing state","mail DNS readiness state","customer-safe commercial configuration"],"protectedScope":["provider secrets","verified payment settlement","immutable billing history","cross-tenant message content","silent quota bypass","canonical price mutation without an explicit version change"],"implementationNotes":"Mail operations are protected by the global Platform Control allowlist plus plan/billing permissions. Billing remains authoritative for purchased Mail tiers."}'::jsonb,
  now()
)
ON CONFLICT ("module_key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "description" = EXCLUDED."description",
  "href" = EXCLUDED."href",
  "icon_key" = EXCLUDED."icon_key",
  "level" = EXCLUDED."level",
  "enabled" = EXCLUDED."enabled",
  "required_permission" = EXCLUDED."required_permission",
  "sort_order" = EXCLUDED."sort_order",
  "status" = 'published',
  "metadata_json" = EXCLUDED."metadata_json",
  "published_at" = COALESCE("platform_app_control_center_modules"."published_at", now()),
  "updated_at" = now()
WHERE "platform_app_control_center_modules"."updated_by" IS NULL;
