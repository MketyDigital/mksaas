CREATE TABLE IF NOT EXISTS "saas_template"."platform_enterprise_orders" (
  "id" text PRIMARY KEY NOT NULL,
  "customer_name" text NOT NULL,
  "company_name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "country" text,
  "scope_id" text,
  "project_name" text NOT NULL,
  "project_description" text,
  "amount_minor" bigint NOT NULL,
  "currency" text DEFAULT 'USD' NOT NULL,
  "payment_provider" text NOT NULL,
  "checkout_status" text DEFAULT 'created' NOT NULL,
  "payment_status" text DEFAULT 'pending' NOT NULL,
  "provider_checkout_reference" text,
  "provider_payment_reference" text,
  "idempotency_key" text NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "confirmed_at" timestamp with time zone
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_enterprise_orders_idempotency_idx"
  ON "saas_template"."platform_enterprise_orders" ("idempotency_key");
CREATE INDEX IF NOT EXISTS "platform_enterprise_orders_email_idx"
  ON "saas_template"."platform_enterprise_orders" ("email");
CREATE INDEX IF NOT EXISTS "platform_enterprise_orders_payment_status_idx"
  ON "saas_template"."platform_enterprise_orders" ("payment_status");
CREATE INDEX IF NOT EXISTS "platform_enterprise_orders_provider_idx"
  ON "saas_template"."platform_enterprise_orders" ("payment_provider");
CREATE INDEX IF NOT EXISTS "platform_enterprise_orders_created_idx"
  ON "saas_template"."platform_enterprise_orders" ("created_at");
