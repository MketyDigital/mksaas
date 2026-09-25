ALTER TABLE "saas_template"."billing_checkouts"
  ADD COLUMN IF NOT EXISTS "provider_amount_expected_minor" bigint;
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts"
  ADD COLUMN IF NOT EXISTS "provider_currency" varchar(3);
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_settlements"
  ADD COLUMN IF NOT EXISTS "provider_amount_paid_minor" bigint;
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_settlements"
  ADD COLUMN IF NOT EXISTS "provider_currency_paid" varchar(3);
