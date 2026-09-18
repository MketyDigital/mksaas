CREATE TABLE "saas_template"."deploy_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"kind" varchar(32) DEFAULT 'web' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."deploy_environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(64) NOT NULL,
	"kind" varchar(32) DEFAULT 'development' NOT NULL,
	"protected" boolean DEFAULT false NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'queued' NOT NULL,
	"release_ref" text,
	"source_ref" text,
	"provider" varchar(48),
	"provider_deployment_ref" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_applications" ADD CONSTRAINT "deploy_applications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_applications" ADD CONSTRAINT "deploy_applications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_applications" ADD CONSTRAINT "deploy_applications_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_environments" ADD CONSTRAINT "deploy_environments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_environments" ADD CONSTRAINT "deploy_environments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_environments" ADD CONSTRAINT "deploy_environments_application_id_deploy_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "saas_template"."deploy_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deploy_environments" ADD CONSTRAINT "deploy_environments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployments" ADD CONSTRAINT "deployments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployments" ADD CONSTRAINT "deployments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployments" ADD CONSTRAINT "deployments_application_id_deploy_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "saas_template"."deploy_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployments" ADD CONSTRAINT "deployments_environment_id_deploy_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "saas_template"."deploy_environments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployments" ADD CONSTRAINT "deployments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "deploy_applications_project_slug_idx" ON "saas_template"."deploy_applications" USING btree ("project_id","slug");
--> statement-breakpoint
CREATE INDEX "deploy_applications_tenant_idx" ON "saas_template"."deploy_applications" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "deploy_applications_project_idx" ON "saas_template"."deploy_applications" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "deploy_environments_application_slug_idx" ON "saas_template"."deploy_environments" USING btree ("application_id","slug");
--> statement-breakpoint
CREATE INDEX "deploy_environments_tenant_idx" ON "saas_template"."deploy_environments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "deploy_environments_project_idx" ON "saas_template"."deploy_environments" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "deploy_environments_application_idx" ON "saas_template"."deploy_environments" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "deployments_tenant_idx" ON "saas_template"."deployments" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "deployments_project_idx" ON "saas_template"."deployments" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "deployments_application_idx" ON "saas_template"."deployments" USING btree ("application_id");
--> statement-breakpoint
CREATE INDEX "deployments_environment_idx" ON "saas_template"."deployments" USING btree ("environment_id");
--> statement-breakpoint
CREATE INDEX "deployments_status_idx" ON "saas_template"."deployments" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "deployments_created_idx" ON "saas_template"."deployments" USING btree ("created_at");
