CREATE TABLE "saas_template"."mail_enterprise_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE CASCADE,
  "name" varchar(180) NOT NULL,
  "description" text,
  "amount_minor" bigint NOT NULL,
  "currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "term_days" integer,
  "limits" jsonb NOT NULL,
  "status" varchar(32) DEFAULT 'draft' NOT NULL,
  "order_id" text,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE SET NULL,
  "paid_at" timestamp with time zone,
  "starts_at" timestamp with time zone,
  "ends_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "mail_enterprise_offers_order_uidx" ON "saas_template"."mail_enterprise_offers" USING btree ("order_id");
CREATE INDEX "mail_enterprise_offers_tenant_status_idx" ON "saas_template"."mail_enterprise_offers" USING btree ("tenant_id", "status");
CREATE UNIQUE INDEX "mail_enterprise_offers_tenant_open_uidx" ON "saas_template"."mail_enterprise_offers" USING btree ("tenant_id") WHERE "status" IN ('draft', 'awaiting_payment', 'active');
