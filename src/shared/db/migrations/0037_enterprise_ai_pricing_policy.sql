ALTER TABLE "saas_template"."ai_enterprise_commercial_policies"
  ADD COLUMN IF NOT EXISTS "operations_reserve_bps" integer DEFAULT 1000 NOT NULL,
  ADD COLUMN IF NOT EXISTS "customer_rate_multiplier_bps" integer DEFAULT 20000 NOT NULL,
  ADD COLUMN IF NOT EXISTS "credit_usd_micros" bigint DEFAULT 1000 NOT NULL;

DO $$ BEGIN
  ALTER TABLE "saas_template"."ai_enterprise_commercial_policies"
    ADD CONSTRAINT "ai_enterprise_commercial_policy_reserve_check"
    CHECK ("operations_reserve_bps" BETWEEN 0 AND 9999);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "saas_template"."ai_enterprise_commercial_policies"
    ADD CONSTRAINT "ai_enterprise_commercial_policy_multiplier_check"
    CHECK ("customer_rate_multiplier_bps" BETWEEN 10000 AND 100000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "saas_template"."ai_enterprise_commercial_policies"
    ADD CONSTRAINT "ai_enterprise_commercial_policy_credit_unit_check"
    CHECK ("credit_usd_micros" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
