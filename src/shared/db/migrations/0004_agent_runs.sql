CREATE TABLE IF NOT EXISTS "saas_template"."agent_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "status" varchar(30) DEFAULT 'running' NOT NULL,
  "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "output" text,
  "error" text,
  "input_tokens" integer,
  "output_tokens" integer,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_tenant_idx" ON "saas_template"."agent_runs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_project_idx" ON "saas_template"."agent_runs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_agent_idx" ON "saas_template"."agent_runs" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_started_idx" ON "saas_template"."agent_runs" USING btree ("started_at");--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_tenant_id_tenants_id_fk' AND conrelid = 'saas_template.agent_runs'::regclass) THEN
    ALTER TABLE "saas_template"."agent_runs" ADD CONSTRAINT "agent_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_project_id_projects_id_fk' AND conrelid = 'saas_template.agent_runs'::regclass) THEN
    ALTER TABLE "saas_template"."agent_runs" ADD CONSTRAINT "agent_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_runs_agent_id_agents_id_fk' AND conrelid = 'saas_template.agent_runs'::regclass) THEN
    ALTER TABLE "saas_template"."agent_runs" ADD CONSTRAINT "agent_runs_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "saas_template"."agents"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
