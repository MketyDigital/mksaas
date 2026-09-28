CREATE TABLE IF NOT EXISTS "saas_template"."ai_rate_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "model_id" uuid NOT NULL REFERENCES "saas_template"."ai_models"("id") ON DELETE cascade,
  "version" integer NOT NULL,
  "status" varchar(24) DEFAULT 'draft' NOT NULL,
  "input_credits_per_million" bigint NOT NULL,
  "cached_input_credits_per_million" bigint,
  "output_credits_per_million" bigint NOT NULL,
  "minimum_credits_per_request" bigint DEFAULT 1 NOT NULL,
  "effective_from" timestamp with time zone NOT NULL,
  "effective_to" timestamp with time zone,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_rate_cards_positive_rates_check"
    CHECK ("input_credits_per_million" > 0 AND "output_credits_per_million" > 0 AND "minimum_credits_per_request" > 0),
  CONSTRAINT "ai_rate_cards_cached_rate_check"
    CHECK ("cached_input_credits_per_million" IS NULL OR "cached_input_credits_per_million" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_rate_cards_model_version_uidx"
  ON "saas_template"."ai_rate_cards" ("model_id","version");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_rate_cards_model_status_effective_idx"
  ON "saas_template"."ai_rate_cards" ("model_id","status","effective_from");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."ai_runtime_policies" (
  "key" varchar(80) PRIMARY KEY NOT NULL,
  "max_request_bytes" integer DEFAULT 1000000 NOT NULL,
  "max_messages" integer DEFAULT 128 NOT NULL,
  "max_tools" integer DEFAULT 64 NOT NULL,
  "max_output_tokens" integer DEFAULT 32768 NOT NULL,
  "reservation_ttl_seconds" integer DEFAULT 120 NOT NULL,
  "prepaid_only" boolean DEFAULT true NOT NULL,
  "customer_inference_enabled" boolean DEFAULT false NOT NULL,
  "updated_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "ai_runtime_policies_limits_check"
    CHECK (
      "max_request_bytes" BETWEEN 1024 AND 5000000
      AND "max_messages" BETWEEN 1 AND 512
      AND "max_tools" BETWEEN 0 AND 256
      AND "max_output_tokens" BETWEEN 1 AND 131072
      AND "reservation_ttl_seconds" BETWEEN 30 AND 600
    ),
  CONSTRAINT "ai_runtime_policies_prepaid_only_check"
    CHECK ("prepaid_only" = true)
);
--> statement-breakpoint
INSERT INTO "saas_template"."ai_runtime_policies" (
  "key",
  "max_request_bytes",
  "max_messages",
  "max_tools",
  "max_output_tokens",
  "reservation_ttl_seconds",
  "prepaid_only",
  "customer_inference_enabled"
) VALUES (
  'enterprise-default',
  1000000,
  128,
  64,
  32768,
  120,
  true,
  false
) ON CONFLICT ("key") DO NOTHING;
