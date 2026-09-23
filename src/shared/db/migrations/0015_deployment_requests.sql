CREATE TABLE "saas_template"."deployment_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"environment_id" uuid NOT NULL,
	"requested_by_user_id" text,
	"reviewed_by_user_id" text,
	"execution_deployment_id" uuid,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"release_ref" text NOT NULL,
	"source_ref" text,
	"review_note" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_application_id_deploy_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "saas_template"."deploy_applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_environment_id_deploy_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "saas_template"."deploy_environments"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "saas_template"."deployment_requests" ADD CONSTRAINT "deployment_requests_execution_deployment_id_deployments_id_fk" FOREIGN KEY ("execution_deployment_id") REFERENCES "saas_template"."deployments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "deployment_requests_tenant_idx" ON "saas_template"."deployment_requests" USING btree ("tenant_id");
--> statement-breakpoint
CREATE INDEX "deployment_requests_project_idx" ON "saas_template"."deployment_requests" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX "deployment_requests_environment_idx" ON "saas_template"."deployment_requests" USING btree ("environment_id");
--> statement-breakpoint
CREATE INDEX "deployment_requests_status_idx" ON "saas_template"."deployment_requests" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "deployment_requests_requested_idx" ON "saas_template"."deployment_requests" USING btree ("requested_at");
