CREATE TYPE "saas_template"."credit_ledger_entry_type" AS ENUM('period_grant', 'usage', 'manual_grant', 'manual_debit', 'adjustment');--> statement-breakpoint
CREATE TABLE "saas_template"."billing_plan_version_credit_allowances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"credit_amount" bigint NOT NULL,
	"grant_interval" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."credit_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"delta" bigint NOT NULL,
	"entry_type" "saas_template"."credit_ledger_entry_type" NOT NULL,
	"source" varchar(80) NOT NULL,
	"billing_period_id" uuid,
	"usage_event_id" uuid,
	"idempotency_key" varchar(160) NOT NULL,
	"reason" text,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."tenant_credit_accounts" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"available_credits" bigint DEFAULT 0 NOT NULL,
	"lifetime_granted" bigint DEFAULT 0 NOT NULL,
	"lifetime_consumed" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"meter_key" varchar(120) NOT NULL,
	"quantity" bigint NOT NULL,
	"credits_charged" bigint NOT NULL,
	"idempotency_key" varchar(160) NOT NULL,
	"project_id" uuid,
	"workspace_key" varchar(120),
	"source" varchar(80) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_plan_version_credit_allowances" ADD CONSTRAINT "billing_plan_version_credit_allowances_plan_version_id_billing_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "saas_template"."billing_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "saas_template"."billing_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_usage_event_id_usage_events_id_fk" FOREIGN KEY ("usage_event_id") REFERENCES "saas_template"."usage_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."credit_ledger_entries" ADD CONSTRAINT "credit_ledger_entries_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."tenant_credit_accounts" ADD CONSTRAINT "tenant_credit_accounts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."usage_events" ADD CONSTRAINT "usage_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."usage_events" ADD CONSTRAINT "usage_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "saas_template"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_version_credit_allowances_plan_version_interval_idx" ON "saas_template"."billing_plan_version_credit_allowances" USING btree ("plan_version_id","grant_interval");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_ledger_entries_tenant_idempotency_idx" ON "saas_template"."credit_ledger_entries" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_tenant_created_idx" ON "saas_template"."credit_ledger_entries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_billing_period_idx" ON "saas_template"."credit_ledger_entries" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "credit_ledger_entries_usage_event_idx" ON "saas_template"."credit_ledger_entries" USING btree ("usage_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_tenant_idempotency_idx" ON "saas_template"."usage_events" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "usage_events_tenant_meter_occurred_idx" ON "saas_template"."usage_events" USING btree ("tenant_id","meter_key","occurred_at");