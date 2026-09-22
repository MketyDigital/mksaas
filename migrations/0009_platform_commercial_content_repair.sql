-- Reconcile the published Mkety commercial presentation with the approved product contract.
-- This migration intentionally changes public presentation data only. It does not grant
-- entitlements, alter billing state, activate subscriptions, or provision infrastructure.

-- Remove the erroneous Growth public plan and its feature rows.
DELETE FROM "saas_template"."platform_pricing_features"
WHERE "plan_id" IN (
  SELECT "id" FROM "saas_template"."platform_pricing_plans" WHERE "key" = 'growth'
);
DELETE FROM "saas_template"."platform_pricing_plans" WHERE "key" = 'growth';

-- Canonical public plans/workspaces.
INSERT INTO "saas_template"."platform_pricing_plans"
  ("key", "name", "price_label", "billing_label", "description", "highlighted", "cta_label", "cta_href", "sort_order", "status", "updated_at")
VALUES
  ('starter', 'Starter', '$5.99', '/ month', 'Pages-first website and publishing access for lightweight websites, landing pages, portfolios, and simple business sites.', false, 'Get Started', '/signup?plan=starter', 10, 'published', now()),
  ('ai-workspace', 'AI Workspace', '$16.99', '/ month', 'AI Agent Builder access with knowledge, tools, model choice, testing, versions, publishing, supported integrations, and run history.', false, 'Get Started', '/signup?plan=ai-workspace', 20, 'published', now()),
  ('automation-workspace', 'Automation Workspace', '$16.99', '/ month', 'Visual workflow access with webhooks, schedules, API actions, conditions, integrations, retries, and execution history.', false, 'Get Started', '/signup?plan=automation-workspace', 30, 'published', now()),
  ('deploy-workspace', 'Deploy Workspace', '$9.99', '/ month', 'Managed serverless and edge deployment for lightweight web apps, APIs, portals, and other bounded application workloads.', false, 'Get Started', '/signup?plan=deploy-workspace', 40, 'published', now()),
  ('mkety-one', 'Mkety One', '$49', '/ month', 'The complete self-service Mkety bundle: Starter plus AI, Automation, and Deploy Workspaces.', true, 'Get Started', '/signup?plan=mkety-one', 50, 'published', now()),
  ('enterprise', 'Enterprise', 'Custom', NULL, 'For custom systems, specialized implementations, trading infrastructure, enterprise support, and managed delivery.', false, 'Talk to Mkety Enterprise', '/contact', 60, 'published', now())
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "price_label" = EXCLUDED."price_label",
  "billing_label" = EXCLUDED."billing_label",
  "description" = EXCLUDED."description",
  "highlighted" = EXCLUDED."highlighted",
  "cta_label" = EXCLUDED."cta_label",
  "cta_href" = EXCLUDED."cta_href",
  "sort_order" = EXCLUDED."sort_order",
  "status" = 'published',
  "updated_at" = now()
WHERE "platform_pricing_plans"."updated_by" IS NULL;

DELETE FROM "saas_template"."platform_pricing_features"
WHERE "plan_id" IN (
  SELECT "id" FROM "saas_template"."platform_pricing_plans"
  WHERE "key" IN ('starter','ai-workspace','automation-workspace','deploy-workspace','mkety-one','enterprise')
    AND "updated_by" IS NULL
);

INSERT INTO "saas_template"."platform_pricing_features" ("plan_id", "label", "sort_order", "enabled")
SELECT p."id", f."label", f."sort_order", true
FROM "saas_template"."platform_pricing_plans" p
JOIN (VALUES
  ('starter', 'Project workspace', 0),
  ('starter', 'Core platform access', 10),
  ('starter', 'SolutionHub discovery', 20),
  ('starter', 'Usage and credits visibility', 30),
  ('ai-workspace', 'AI agents', 0),
  ('ai-workspace', 'Knowledge connections', 10),
  ('ai-workspace', 'Model selection', 20),
  ('ai-workspace', 'Tools and runs', 30),
  ('ai-workspace', 'Versions and publishing', 40),
  ('automation-workspace', 'Workflow builder', 0),
  ('automation-workspace', 'Triggers and actions', 10),
  ('automation-workspace', 'Conditions and transformations', 20),
  ('automation-workspace', 'Webhooks', 30),
  ('automation-workspace', 'Run history', 40),
  ('deploy-workspace', 'Application and environment management', 0),
  ('deploy-workspace', 'Release configuration', 10),
  ('deploy-workspace', 'Deployment history', 20),
  ('deploy-workspace', 'Project-scoped deployment records', 30),
  ('mkety-one', 'Starter included', 0),
  ('mkety-one', 'AI Workspace included', 10),
  ('mkety-one', 'Automation Workspace included', 20),
  ('mkety-one', 'Deploy Workspace included', 30),
  ('mkety-one', 'Unified Mkety workspace access', 40),
  ('enterprise', 'Custom implementation', 0),
  ('enterprise', 'Enterprise support', 10),
  ('enterprise', 'Trading infrastructure options', 20),
  ('enterprise', 'Managed integrations and delivery', 30)
) AS f("key", "label", "sort_order") ON p."key" = f."key"
WHERE p."updated_by" IS NULL;

-- Untouched seed records have no actor identity. Refresh only those records so launch
-- copy and docs are rebuilt from the current production-safe defaults by the seeder.
-- Any admin-managed record (created_by or updated_by populated) is preserved.
DELETE FROM "saas_template"."platform_page_sections" s
USING "saas_template"."platform_pages" p
WHERE s."page_id" = p."id"
  AND p."slug" IN ('home','platform','workspaces','solutions','academy','pricing','enterprise','about','contact')
  AND s."created_by" IS NULL
  AND s."updated_by" IS NULL;

DELETE FROM "saas_template"."platform_docs_articles"
WHERE "created_by" IS NULL AND "updated_by" IS NULL;

DELETE FROM "saas_template"."platform_docs_categories" c
WHERE c."created_by" IS NULL
  AND c."updated_by" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "saas_template"."platform_docs_articles" a WHERE a."category_id" = c."id"
  );
