ALTER TABLE "saas_template"."platform_enterprise_orders"
  ADD COLUMN "checkout_token_hash" varchar(64),
  ADD COLUMN "checkout_token_expires_at" timestamp with time zone,
  ADD COLUMN "provider_pay_currency" varchar(24);

CREATE INDEX "platform_enterprise_orders_checkout_token_hash_idx"
  ON "saas_template"."platform_enterprise_orders" USING btree ("checkout_token_hash");
