CREATE TABLE IF NOT EXISTS "saas_template"."ai_solution_templates" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "title" varchar(160) NOT NULL,
  "short_description" text NOT NULL,
  "outcomes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "setup_steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 100 NOT NULL,
  "updated_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_solution_templates_enabled_sort_idx"
  ON "saas_template"."ai_solution_templates" ("enabled","sort_order");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."ai_solution_instances" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "template_key" varchar(80) NOT NULL REFERENCES "saas_template"."ai_solution_templates"("key") ON DELETE restrict,
  "name" varchar(160) NOT NULL,
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "configuration" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_solution_instances_tenant_status_idx"
  ON "saas_template"."ai_solution_instances" ("tenant_id","status","updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_solution_instances_project_idx"
  ON "saas_template"."ai_solution_instances" ("project_id");
--> statement-breakpoint
INSERT INTO "saas_template"."ai_solution_templates"
  ("key","title","short_description","outcomes","setup_steps","enabled","sort_order")
VALUES
  (
    'customer-support',
    'Help customers faster',
    'Give your team an AI assistant that can answer common questions from approved business knowledge and prepare support replies.',
    '["Answer repeat questions consistently","Give staff faster draft replies","Use your approved business information"]'::jsonb,
    '["Choose the customer questions to handle","Add approved business information","Review and test answers","Connect a supported channel when ready"]'::jsonb,
    true,10
  ),
  (
    'lead-follow-up',
    'Follow up leads',
    'Help sales teams qualify enquiries, prepare replies, summarize prospects, and keep follow-up work organized.',
    '["Respond to new enquiries faster","Summarize lead context","Prepare follow-up messages for review"]'::jsonb,
    '["Choose your lead source","Describe your offer and qualification rules","Review sample follow-ups","Connect approved CRM or messaging tools when ready"]'::jsonb,
    true,20
  ),
  (
    'business-knowledge',
    'Ask your business anything',
    'Create a private assistant for policies, procedures, products, files, FAQs, and internal business knowledge.',
    '["Find answers across business information","Reduce repeated internal questions","Keep answers linked to approved sources"]'::jsonb,
    '["Choose who can use the assistant","Add business knowledge","Set answer rules","Test with common team questions"]'::jsonb,
    true,30
  ),
  (
    'operations-booking',
    'Handle bookings and operations',
    'Guide routine requests, collect the right details, summarize work, and connect approved business workflows.',
    '["Collect complete customer information","Reduce repetitive admin work","Route requests to the right process"]'::jsonb,
    '["Choose the process to simplify","Define required information","Set approval rules","Connect calendars, forms, or workflows when supported"]'::jsonb,
    true,40
  ),
  (
    'team-assistant',
    'Give your team an assistant',
    'Help employees draft, summarize, research approved knowledge, and complete repeatable internal work.',
    '["Save time on routine writing and summaries","Standardize common team work","Keep company context private to the workspace"]'::jsonb,
    '["Choose the team","Choose allowed tasks","Add relevant knowledge","Review permissions and launch internally"]'::jsonb,
    true,50
  ),
  (
    'custom-automation',
    'Build a custom AI workflow',
    'Combine agents, knowledge, tools, APIs, approvals, and workflows for advanced business processes.',
    '["Connect AI to your existing systems","Add human approvals to important actions","Use developer APIs and custom integrations"]'::jsonb,
    '["Define the business outcome","Choose data and systems","Set permissions and approvals","Test before production"]'::jsonb,
    true,60
  )
ON CONFLICT ("key") DO NOTHING;
