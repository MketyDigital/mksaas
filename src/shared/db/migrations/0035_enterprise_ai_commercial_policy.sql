ALTER TABLE "saas_template"."billing_checkouts"
  ADD COLUMN IF NOT EXISTS "purpose" varchar(48) DEFAULT 'subscription' NOT NULL;

CREATE TABLE IF NOT EXISTS "saas_template"."ai_enterprise_commercial_policies" (
  "plan_version_id" uuid PRIMARY KEY NOT NULL,
  "minimum_funding_minor" bigint NOT NULL,
  "managed_cost_share_bps" integer DEFAULT 1500 NOT NULL,
  "setup_fee_minor" bigint DEFAULT 0 NOT NULL,
  "funding_mode" varchar(32) DEFAULT 'full_period' NOT NULL,
  "credit_rollover" boolean DEFAULT true NOT NULL,
  "hard_stop" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_enterprise_commercial_policy_funding_check" CHECK ("minimum_funding_minor" > 0 AND "setup_fee_minor" >= 0),
  CONSTRAINT "ai_enterprise_commercial_policy_share_check" CHECK ("managed_cost_share_bps" BETWEEN 1 AND 10000),
  CONSTRAINT "ai_enterprise_commercial_policy_mode_check" CHECK ("funding_mode" IN ('full_period','prepaid_partial'))
);

DO $$ BEGIN
 ALTER TABLE "saas_template"."ai_enterprise_commercial_policies"
 ADD CONSTRAINT "ai_enterprise_commercial_policies_plan_version_id_billing_plan_versions_id_fk"
 FOREIGN KEY ("plan_version_id") REFERENCES "saas_template"."billing_plan_versions"("id")
 ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
