CREATE TABLE "saas_template"."projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "description" text,
  "type" varchar(40) DEFAULT 'app' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "projects_tenant_slug_unique" UNIQUE("tenant_id", "slug")
);--> statement-breakpoint
CREATE INDEX "projects_tenant_idx" ON "saas_template"."projects" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "saas_template"."projects" ADD CONSTRAINT "projects_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE "saas_template"."agents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "project_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "instructions" text,
  "provider" varchar(40) DEFAULT 'platform' NOT NULL,
  "model" varchar(160),
  "status" varchar(30) DEFAULT 'draft' NOT NULL,
  "config" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "agents_project_slug_unique" UNIQUE("project_id", "slug")
);--> statement-breakpoint
CREATE INDEX "agents_tenant_idx" ON "saas_template"."agents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "agents_project_idx" ON "saas_template"."agents" USING btree ("project_id");--> statement-breakpoint
ALTER TABLE "saas_template"."agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
