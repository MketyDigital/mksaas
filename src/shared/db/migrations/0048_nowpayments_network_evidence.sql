ALTER TABLE "saas_template"."billing_checkouts"
  ADD COLUMN "provider_pay_currency" varchar(24);

ALTER TABLE "saas_template"."billing_settlements"
  ADD COLUMN "provider_pay_currency" varchar(24);
