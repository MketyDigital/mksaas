CREATE TABLE IF NOT EXISTS "saas_template"."workflows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "name" varchar(160) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "description" text,
  "status" varchar(30) NOT NULL DEFAULT 'draft',
  "trigger_type" varchar(40) NOT NULL DEFAULT 'manual',
  "webhook_secret" varchar(255),
  "definition" jsonb NOT NULL DEFAULT '{"nodes":[]}'::jsonb,
  "version" varchar(30) NOT NULL DEFAULT '1',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflows_project_slug_idx" ON "saas_template"."workflows" ("project_id", "slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflows_tenant_idx" ON "saas_template"."workflows" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflows_project_idx" ON "saas_template"."workflows" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflows_status_idx" ON "saas_template"."workflows" ("status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."workflow_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "workflow_id" uuid NOT NULL REFERENCES "saas_template"."workflows"("id") ON DELETE cascade,
  "status" varchar(30) NOT NULL DEFAULT 'running',
  "trigger_type" varchar(40) NOT NULL DEFAULT 'manual',
  "input" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "output" jsonb,
  "error" text,
  "started_at" timestamptz NOT NULL DEFAULT now(),
  "completed_at" timestamptz
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_tenant_idx" ON "saas_template"."workflow_runs" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_project_idx" ON "saas_template"."workflow_runs" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_workflow_idx" ON "saas_template"."workflow_runs" ("workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "saas_template"."workflow_runs" ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_runs_started_idx" ON "saas_template"."workflow_runs" ("started_at");
