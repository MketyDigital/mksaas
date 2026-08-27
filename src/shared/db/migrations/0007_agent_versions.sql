CREATE TABLE IF NOT EXISTS "saas_template"."agent_versions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "agent_id" uuid NOT NULL REFERENCES "saas_template"."agents"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'draft',
  "name" varchar(160) NOT NULL,
  "instructions" text,
  "provider" varchar(40) NOT NULL,
  "model" varchar(160),
  "config" text,
  "knowledge_document_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "published_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_versions_tenant_idx" ON "saas_template"."agent_versions" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_versions_project_idx" ON "saas_template"."agent_versions" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_versions_agent_idx" ON "saas_template"."agent_versions" ("agent_id");
