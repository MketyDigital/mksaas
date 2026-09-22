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
  ('starter', 'Starter', '$5.99', '/ month', 'A Pages-first website and publishing plan for landing pages, portfolios, simple business sites, and other lightweight web publishing.', false, 'Get Started', '/signup?plan=starter', 10, 'published', now()),
  ('ai-workspace', 'AI Workspace', '$16.99', '/ month', 'Build and operate AI agents with knowledge, tools, model choice, publishing, supported channels, API access, and usage visibility.', false, 'Get Started', '/signup?plan=ai-workspace', 20, 'published', now()),
  ('automation-workspace', 'Automation Workspace', '$16.99', '/ month', 'Build and operate visual workflows with triggers, actions, integrations, execution history, and usage visibility.', false, 'Get Started', '/signup?plan=automation-workspace', 30, 'published', now()),
  ('deploy-workspace', 'Deploy Workspace', '$9.99', '/ month', 'For lightweight web apps, APIs, portals, and serverless application deployment through a managed edge runtime.', false, 'Get Started', '/signup?plan=deploy-workspace', 40, 'published', now()),
  ('mkety-one', 'Mkety One', '$49', '/ month', 'The complete self-service Mkety bundle: Starter plus AI, Automation, and Deploy Workspaces.', true, 'Get Started', '/signup?plan=mkety-one', 50, 'published', now()),
  ('enterprise', 'Enterprise', 'Custom', NULL, 'For requirements beyond the standard shared platform envelope, including dedicated infrastructure, specialized integrations, private runtimes, persistent services, and Trading.', false, 'Talk to Mkety Enterprise', '/contact', 60, 'published', now())
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
  ('starter', 'Published websites and pages', 0),
  ('starter', 'Landing pages, portfolios, simple business sites, and supported blogs/docs', 10),
  ('starter', 'Custom domains, SSL, and edge delivery where supported', 20),
  ('starter', 'Forms and integrations where supported', 30),
  ('starter', 'Basic analytics and project management', 40),
  ('starter', 'Asset/storage and Mkety usage/credits visibility', 50),
  ('ai-workspace', 'AI Agent Builder with agents and published agents', 0),
  ('ai-workspace', 'Drafts, version history, model choice, and test playground', 10),
  ('ai-workspace', 'Knowledge sources, storage, and retrieval', 20),
  ('ai-workspace', 'Tools, actions, and API access', 30),
  ('ai-workspace', 'Website AI, Telegram, and supported messaging integrations', 40),
  ('ai-workspace', 'Conversation/run history, usage, and team access', 50),
  ('automation-workspace', 'Visual workflow builder and workflow management', 0),
  ('automation-workspace', 'Webhook and scheduled triggers', 10),
  ('automation-workspace', 'API actions, conditions, notifications, and integrations', 20),
  ('automation-workspace', 'Secrets and protected integration configuration', 30),
  ('automation-workspace', 'Run history, execution logs, and retries', 40),
  ('automation-workspace', 'Execution/usage visibility and team access', 50),
  ('deploy-workspace', 'Managed serverless application runtime and edge deployment', 0),
  ('deploy-workspace', 'Lightweight web app, API, and portal deployment', 10),
  ('deploy-workspace', 'Custom domains and SSL where supported', 20),
  ('deploy-workspace', 'Environment variables and secrets', 30),
  ('deploy-workspace', 'Deployment history, logs, and status where available', 40),
  ('deploy-workspace', 'Project, application, and usage visibility', 50),
  ('mkety-one', 'Starter website and publishing capabilities', 0),
  ('mkety-one', 'AI Workspace, Automation Workspace, and Deploy Workspace included', 10),
  ('mkety-one', 'Unified projects and workspace management', 20),
  ('mkety-one', 'Domains, usage, credits, and activity visibility', 30),
  ('mkety-one', 'Team access and shared operational controls', 40),
  ('mkety-one', 'Support and history/analytics experience across the bundle', 50),
  ('enterprise', 'Custom implementation and managed delivery', 0),
  ('enterprise', 'Dedicated or private infrastructure when required', 10),
  ('enterprise', 'Container, persistent-service, networking, and high-throughput requirements', 20),
  ('enterprise', 'Specialized integrations and Trading infrastructure', 30),
  ('enterprise', 'Enterprise support and commercial terms', 40)
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
