CREATE TABLE IF NOT EXISTS "saas_template"."workflow_webhook_endpoints" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "workflow_id" uuid NOT NULL REFERENCES "saas_template"."workflows"("id") ON DELETE cascade,
  "endpoint_id" varchar(96) NOT NULL,
  "secret_hash" varchar(128) NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "rotated_at" timestamptz
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_webhook_endpoints_endpoint_id_idx" ON "saas_template"."workflow_webhook_endpoints" ("endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_endpoints_tenant_idx" ON "saas_template"."workflow_webhook_endpoints" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_endpoints_project_idx" ON "saas_template"."workflow_webhook_endpoints" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_endpoints_workflow_idx" ON "saas_template"."workflow_webhook_endpoints" ("workflow_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."workflow_webhook_deliveries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid NOT NULL REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "workflow_id" uuid NOT NULL REFERENCES "saas_template"."workflows"("id") ON DELETE cascade,
  "webhook_endpoint_id" uuid NOT NULL REFERENCES "saas_template"."workflow_webhook_endpoints"("id") ON DELETE cascade,
  "event_id" varchar(256) NOT NULL,
  "event_id_source" varchar(20) NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'received',
  "workflow_run_id" uuid REFERENCES "saas_template"."workflow_runs"("id") ON DELETE set null,
  "error_code" varchar(120),
  "received_at" timestamptz NOT NULL DEFAULT now(),
  "admitted_at" timestamptz
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_webhook_deliveries_event_identity_idx" ON "saas_template"."workflow_webhook_deliveries" ("webhook_endpoint_id", "event_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_deliveries_tenant_idx" ON "saas_template"."workflow_webhook_deliveries" ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_deliveries_project_idx" ON "saas_template"."workflow_webhook_deliveries" ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_deliveries_workflow_idx" ON "saas_template"."workflow_webhook_deliveries" ("workflow_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_deliveries_endpoint_idx" ON "saas_template"."workflow_webhook_deliveries" ("webhook_endpoint_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_deliveries_run_idx" ON "saas_template"."workflow_webhook_deliveries" ("workflow_run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_webhook_deliveries_received_idx" ON "saas_template"."workflow_webhook_deliveries" ("received_at");
