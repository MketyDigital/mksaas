CREATE TABLE IF NOT EXISTS "saas_template"."platform_payment_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "environment" varchar(40) DEFAULT 'production' NOT NULL,
  "base_currency" varchar(3) DEFAULT 'USD' NOT NULL,
  "flutterwave_enabled_currencies_json" jsonb DEFAULT '["USD","NGN","GHS","KES","GBP","EUR","ZAR","XAF","XOF","UGX","RWF","TZS","EGP","MWK"]'::jsonb NOT NULL,
  "flutterwave_fx_rates_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "flutterwave_fx_markup_bps" integer DEFAULT 0 NOT NULL,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_payment_settings_updated_by_users_id_fk"
    FOREIGN KEY ("updated_by") REFERENCES "saas_template"."users"("id") ON DELETE set null ON UPDATE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_payment_settings_environment_idx"
  ON "saas_template"."platform_payment_settings" USING btree ("environment");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."payment_checkout_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider" varchar(40) NOT NULL,
  "source" varchar(40) NOT NULL,
  "reference" varchar(80) NOT NULL,
  "canonical_amount_minor" text NOT NULL,
  "canonical_currency" varchar(3) NOT NULL,
  "collection_amount_minor" text NOT NULL,
  "collection_currency" varchar(3) NOT NULL,
  "customer_email" varchar(254) NOT NULL,
  "customer_name" varchar(180),
  "redirect_url" text NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "payload_hash" varchar(64) NOT NULL,
  "status" varchar(24) DEFAULT 'created' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "payment_checkout_sessions_provider_reference_idx"
  ON "saas_template"."payment_checkout_sessions" USING btree ("provider","reference");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_checkout_sessions_expires_idx"
  ON "saas_template"."payment_checkout_sessions" USING btree ("expires_at");
--> statement-breakpoint
INSERT INTO "saas_template"."platform_payment_settings"
  ("environment","base_currency","flutterwave_enabled_currencies_json","flutterwave_fx_rates_json","flutterwave_fx_markup_bps")
VALUES
  ('production','USD','["USD","NGN","GHS","KES","GBP","EUR","ZAR","XAF","XOF","UGX","RWF","TZS","EGP","MWK"]'::jsonb,'{}'::jsonb,0)
ON CONFLICT ("environment") DO NOTHING;
