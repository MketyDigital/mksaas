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
  ('starter', 'Starter', '$5.99', '/ month', 'A simple entry plan for individuals getting started with Mkety projects and core platform access.', false, 'Choose Starter', '/create-workspace', 10, 'published', now()),
  ('ai-workspace', 'AI Workspace', '$16.99', '/ month', 'For building, testing, publishing, and operating AI agents and AI-powered applications.', false, 'Choose AI Workspace', '/create-workspace', 20, 'published', now()),
  ('automation-workspace', 'Automation Workspace', '$16.99', '/ month', 'For building repeatable workflows, integrations, triggers, actions, and business automations.', false, 'Choose Automation Workspace', '/create-workspace', 30, 'published', now()),
  ('deploy-workspace', 'Deploy Workspace', '$9.99', '/ month', 'For publishing websites, lightweight applications, APIs, portals, and serverless workloads.', false, 'Choose Deploy Workspace', '/create-workspace', 40, 'published', now()),
  ('mkety-one', 'Mkety One', '$49', '/ month', 'The complete self-service Mkety bundle: Starter plus AI, Automation, and Deploy Workspaces.', true, 'Choose Mkety One', '/create-workspace', 50, 'published', now()),
  ('enterprise', 'Enterprise', 'Custom', NULL, 'For custom systems, specialized implementations, trading infrastructure, enterprise support, and managed delivery.', false, 'Start Enterprise Project', '/enterprise/checkout', 60, 'published', now())
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
  "updated_at" = now();

DELETE FROM "saas_template"."platform_pricing_features"
WHERE "plan_id" IN (
  SELECT "id" FROM "saas_template"."platform_pricing_plans"
  WHERE "key" IN ('starter','ai-workspace','automation-workspace','deploy-workspace','mkety-one','enterprise')
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
  ('deploy-workspace', 'Website and app deploys', 0),
  ('deploy-workspace', 'API and portal deploys', 10),
  ('deploy-workspace', 'Preview and production environments', 20),
  ('deploy-workspace', 'Domains', 30),
  ('deploy-workspace', 'Deployment history', 40),
  ('mkety-one', 'Starter included', 0),
  ('mkety-one', 'AI Workspace included', 10),
  ('mkety-one', 'Automation Workspace included', 20),
  ('mkety-one', 'Deploy Workspace included', 30),
  ('mkety-one', 'Unified Mkety workspace access', 40),
  ('enterprise', 'Custom implementation', 0),
  ('enterprise', 'Enterprise support', 10),
  ('enterprise', 'Trading infrastructure options', 20),
  ('enterprise', 'Managed integrations and delivery', 30)
) AS f("key", "label", "sort_order") ON p."key" = f."key";

-- Repair the known legacy homepage workspace section. This updates only the public
-- product presentation and keeps Trading on its canonical product domain.
UPDATE "saas_template"."platform_page_sections" s
SET "content_json" = jsonb_build_object(
      'eyebrow', 'Workspaces',
      'title', 'One platform, multiple operating spaces',
      'description', 'Choose the workspace that fits what you want to build, or use Mkety One for the complete self-service workspace bundle.',
      'items', jsonb_build_array(
        jsonb_build_object('key','ai','title','AI Workspace','description','Build agents, connect knowledge, choose models, test, version, publish, and monitor AI applications.','href','/app/ai'),
        jsonb_build_object('key','automation','title','Automation Workspace','description','Create workflows from triggers, actions, conditions, webhooks, transformations, and agent steps.','href','/app/automation'),
        jsonb_build_object('key','deploy','title','Deploy Workspace','description','Publish websites, lightweight applications, APIs, portals, and serverless workloads with domains and deployment history.','href','/app/deploy'),
        jsonb_build_object('key','trading','title','Trading Workspace','description','Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.','href','https://trade.mkety.com','badge','Custom / Enterprise')
      )
    ),
    "status" = 'published',
    "updated_at" = now()
FROM "saas_template"."platform_pages" p
WHERE s."page_id" = p."id"
  AND p."slug" = 'home'
  AND s."section_key" IN ('workspaces','home.workspaces')
  AND s."status" = 'published';
