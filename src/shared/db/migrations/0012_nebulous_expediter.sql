CREATE TYPE "saas_template"."tenant_entitlement_override_effect" AS ENUM('grant', 'deny');--> statement-breakpoint
CREATE TABLE "saas_template"."billing_plan_version_entitlements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_version_id" uuid NOT NULL,
	"entitlement_key" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saas_template"."tenant_entitlement_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"entitlement_key" varchar(120) NOT NULL,
	"effect" "saas_template"."tenant_entitlement_override_effect" NOT NULL,
	"reason" text NOT NULL,
	"source" varchar(80) NOT NULL,
	"expires_at" timestamp with time zone,
	"actor_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_plan_version_entitlements" ADD CONSTRAINT "billing_plan_version_entitlements_plan_version_id_billing_plan_versions_id_fk" FOREIGN KEY ("plan_version_id") REFERENCES "saas_template"."billing_plan_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."tenant_entitlement_overrides" ADD CONSTRAINT "tenant_entitlement_overrides_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_template"."tenant_entitlement_overrides" ADD CONSTRAINT "tenant_entitlement_overrides_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_plan_version_entitlements_version_key_idx" ON "saas_template"."billing_plan_version_entitlements" USING btree ("plan_version_id","entitlement_key");--> statement-breakpoint
CREATE INDEX "tenant_entitlement_overrides_tenant_key_idx" ON "saas_template"."tenant_entitlement_overrides" USING btree ("tenant_id","entitlement_key");--> statement-breakpoint
CREATE INDEX "tenant_entitlement_overrides_expiry_idx" ON "saas_template"."tenant_entitlement_overrides" USING btree ("expires_at");