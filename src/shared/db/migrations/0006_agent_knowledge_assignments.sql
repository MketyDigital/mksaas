CREATE TABLE IF NOT EXISTS "saas_template"."agent_knowledge" (
  "tenant_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "document_id" uuid NOT NULL,
  CONSTRAINT "agent_knowledge_pkey" PRIMARY KEY ("agent_id", "document_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_knowledge_tenant_idx" ON "saas_template"."agent_knowledge" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_knowledge_project_idx" ON "saas_template"."agent_knowledge" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_knowledge_agent_idx" ON "saas_template"."agent_knowledge" USING btree ("agent_id");--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_knowledge_tenant_id_tenants_id_fk') THEN
  ALTER TABLE "saas_template"."agent_knowledge" ADD CONSTRAINT "agent_knowledge_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_knowledge_project_id_projects_id_fk') THEN
  ALTER TABLE "saas_template"."agent_knowledge" ADD CONSTRAINT "agent_knowledge_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_knowledge_agent_id_agents_id_fk') THEN
  ALTER TABLE "saas_template"."agent_knowledge" ADD CONSTRAINT "agent_knowledge_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "saas_template"."agents"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agent_knowledge_document_id_knowledge_documents_id_fk') THEN
  ALTER TABLE "saas_template"."agent_knowledge" ADD CONSTRAINT "agent_knowledge_document_id_knowledge_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "saas_template"."knowledge_documents"("id") ON DELETE cascade ON UPDATE no action;
 END IF;
END $$;
