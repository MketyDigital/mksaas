ALTER TABLE "saas_template"."billing_checkouts"
ADD COLUMN "settlement_amount_expected_minor" bigint;
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts"
ADD COLUMN "settlement_currency" varchar(3);
--> statement-breakpoint
UPDATE "saas_template"."billing_checkouts"
SET
  "settlement_amount_expected_minor" = "amount_expected_minor",
  "settlement_currency" = "currency"
WHERE "settlement_amount_expected_minor" IS NULL
   OR "settlement_currency" IS NULL;
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts"
ALTER COLUMN "settlement_amount_expected_minor" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "saas_template"."billing_checkouts"
ALTER COLUMN "settlement_currency" SET NOT NULL;
