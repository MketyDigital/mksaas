CREATE TABLE "saas_template"."billing_checkouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"provider" varchar(48) NOT NULL,
	"provider_checkout_id" text,
	"amount_expected_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"status" varchar(24) DEFAULT 'created' NOT NULL,
	"checkout_url" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"billing_period_id" uuid,
	"settlement_id" uuid,
	"entry_type" varchar(32) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reversal_of_entry_id" uuid,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_manual_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid,
	"billing_period_id" uuid,
	"actor_user_id" text NOT NULL,
	"idempotency_key" varchar(128) NOT NULL,
	"adjustment_type" varchar(32) NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"reason" text NOT NULL,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"amount_due_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"collection_status" varchar(24) DEFAULT 'open' NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_plan_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" varchar(3) NOT NULL,
	"billing_interval" varchar(24) NOT NULL,
	"is_public" boolean DEFAULT true NOT NULL,
	"metadata_reference" text,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(96) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"status" varchar(24) DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_renewal_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"billing_period_id" uuid,
	"mode" varchar(32) NOT NULL,
	"provider" varchar(48),
	"status" varchar(24) DEFAULT 'prepared' NOT NULL,
	"outcome_reference" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_settlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"provider" varchar(48) NOT NULL,
	"provider_payment_id" text,
	"provider_event_id" text,
	"settlement_type" varchar(32) DEFAULT 'payment' NOT NULL,
	"amount_expected_minor" bigint NOT NULL,
	"currency_expected" varchar(3) NOT NULL,
	"amount_paid_minor" bigint NOT NULL,
	"currency_paid" varchar(3) NOT NULL,
	"status" varchar(24) DEFAULT 'received' NOT NULL,
	"raw_reference" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"verified_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."billing_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL,
	"renewal_mode" varchar(32) DEFAULT 'manual' NOT NULL,
	"auto_renew" boolean DEFAULT false NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"grace_period_end" timestamp with time zone,
	"gateway_provider" varchar(48),
	"provider_customer_ref" text,
	"provider_subscription_ref" text,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancellation_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts" ADD CONSTRAINT "billing_checkouts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts" ADD CONSTRAINT "billing_checkouts_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "saas_template"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts" ADD CONSTRAINT "billing_checkouts_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "saas_template"."billing_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "saas_template"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "saas_template"."billing_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_ledger_entries" ADD CONSTRAINT "billing_ledger_entries_settlement_id_billing_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "saas_template"."billing_settlements"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_manual_adjustments" ADD CONSTRAINT "billing_manual_adjustments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_manual_adjustments" ADD CONSTRAINT "billing_manual_adjustments_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "saas_template"."billing_subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_manual_adjustments" ADD CONSTRAINT "billing_manual_adjustments_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "saas_template"."billing_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_manual_adjustments" ADD CONSTRAINT "billing_manual_adjustments_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "saas_template"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_periods" ADD CONSTRAINT "billing_periods_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_periods" ADD CONSTRAINT "billing_periods_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "saas_template"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_plan_versions" ADD CONSTRAINT "billing_plan_versions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "saas_template"."billing_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_renewal_attempts" ADD CONSTRAINT "billing_renewal_attempts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_renewal_attempts" ADD CONSTRAINT "billing_renewal_attempts_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "saas_template"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_renewal_attempts" ADD CONSTRAINT "billing_renewal_attempts_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "saas_template"."billing_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_settlements" ADD CONSTRAINT "billing_settlements_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_settlements" ADD CONSTRAINT "billing_settlements_subscription_id_billing_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "saas_template"."billing_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_settlements" ADD CONSTRAINT "billing_settlements_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "saas_template"."billing_periods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."billing_subscriptions" ADD CONSTRAINT "billing_subscriptions_plan_version_id_billing_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "saas_template"."billing_plan_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_checkouts_provider_checkout_idx" ON "saas_template"."billing_checkouts" USING btree ("provider","provider_checkout_id");--> statement-breakpoint
CREATE INDEX "billing_checkouts_tenant_idx" ON "saas_template"."billing_checkouts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_checkouts_period_idx" ON "saas_template"."billing_checkouts" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_ledger_entries_tenant_idx" ON "saas_template"."billing_ledger_entries" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_ledger_entries_subscription_idx" ON "saas_template"."billing_ledger_entries" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "billing_ledger_entries_period_idx" ON "saas_template"."billing_ledger_entries" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_ledger_entries_settlement_idx" ON "saas_template"."billing_ledger_entries" USING btree ("settlement_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_manual_adjustments_idempotency_idx" ON "saas_template"."billing_manual_adjustments" USING btree ("tenant_id","idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_periods_subscription_period_idx" ON "saas_template"."billing_periods" USING btree ("subscription_id","period_start","period_end");--> statement-breakpoint
CREATE INDEX "billing_periods_tenant_idx" ON "saas_template"."billing_periods" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_versions_plan_version_idx" ON "saas_template"."billing_plan_versions" USING btree ("plan_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plans_key_idx" ON "saas_template"."billing_plans" USING btree ("key");--> statement-breakpoint
CREATE INDEX "billing_renewal_attempts_tenant_idx" ON "saas_template"."billing_renewal_attempts" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_renewal_attempts_subscription_idx" ON "saas_template"."billing_renewal_attempts" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_settlements_provider_event_idx" ON "saas_template"."billing_settlements" USING btree ("provider","provider_event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_settlements_provider_payment_type_idx" ON "saas_template"."billing_settlements" USING btree ("provider","provider_payment_id","settlement_type");--> statement-breakpoint
CREATE INDEX "billing_settlements_tenant_idx" ON "saas_template"."billing_settlements" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_settlements_period_idx" ON "saas_template"."billing_settlements" USING btree ("billing_period_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_tenant_idx" ON "saas_template"."billing_subscriptions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "billing_subscriptions_plan_version_idx" ON "saas_template"."billing_subscriptions" USING btree ("plan_version_id");