CREATE TABLE IF NOT EXISTS "saas_template"."ai_api_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "environment" varchar(16) DEFAULT 'live' NOT NULL,
  "name" varchar(128) NOT NULL,
  "key_prefix" varchar(40) NOT NULL,
  "key_hash" varchar(128) NOT NULL,
  "scopes" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "last_used_at" timestamp with time zone,
  "expires_at" timestamp with time zone,
  "revoked_at" timestamp with time zone,
  "created_by_user_id" text REFERENCES "saas_template"."users"("id") ON DELETE set null,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_api_keys_hash_uidx" ON "saas_template"."ai_api_keys" ("key_hash");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_api_keys_tenant_idx" ON "saas_template"."ai_api_keys" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_api_keys_project_idx" ON "saas_template"."ai_api_keys" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."ai_models" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "provider_key" varchar(64) NOT NULL,
  "native_model" varchar(200) NOT NULL,
  "display_name" varchar(160) NOT NULL,
  "status" varchar(32) DEFAULT 'candidate' NOT NULL,
  "managed" boolean DEFAULT true NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "capabilities" jsonb NOT NULL,
  "limits" jsonb NOT NULL,
  "provider_cost_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_models_provider_native_uidx" ON "saas_template"."ai_models" ("provider_key","native_model");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_models_enabled_idx" ON "saas_template"."ai_models" ("enabled","status");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."ai_model_aliases" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "alias" varchar(128) NOT NULL,
  "model_id" uuid NOT NULL REFERENCES "saas_template"."ai_models"("id") ON DELETE cascade,
  "stable" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_model_aliases_alias_uidx" ON "saas_template"."ai_model_aliases" ("alias");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_model_aliases_model_idx" ON "saas_template"."ai_model_aliases" ("model_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."ai_provider_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "provider_key" varchar(64) NOT NULL,
  "mode" varchar(24) NOT NULL,
  "secret_ref" text,
  "endpoint_url" text,
  "status" varchar(32) DEFAULT 'disabled' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_provider_connections_tenant_idx" ON "saas_template"."ai_provider_connections" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_provider_connections_project_idx" ON "saas_template"."ai_provider_connections" ("project_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."ai_routes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "model_alias" varchar(128) NOT NULL,
  "provider_connection_id" uuid REFERENCES "saas_template"."ai_provider_connections"("id") ON DELETE set null,
  "priority" integer DEFAULT 100 NOT NULL,
  "enabled" boolean DEFAULT false NOT NULL,
  "policy" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_routes_scope_alias_idx" ON "saas_template"."ai_routes" ("tenant_id","project_id","model_alias","priority");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."ai_budgets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE cascade,
  "api_key_id" uuid REFERENCES "saas_template"."ai_api_keys"("id") ON DELETE cascade,
  "period" varchar(24) DEFAULT 'monthly' NOT NULL,
  "max_credits" bigint,
  "max_requests" bigint,
  "used_credits" bigint DEFAULT 0 NOT NULL,
  "used_requests" bigint DEFAULT 0 NOT NULL,
  "hard_stop" boolean DEFAULT true NOT NULL,
  "starts_at" timestamp with time zone NOT NULL,
  "ends_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_budgets_scope_period_idx" ON "saas_template"."ai_budgets" ("tenant_id","project_id","starts_at","ends_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_budgets_api_key_idx" ON "saas_template"."ai_budgets" ("api_key_id");
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "saas_template"."ai_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE set null,
  "api_key_id" uuid REFERENCES "saas_template"."ai_api_keys"("id") ON DELETE set null,
  "idempotency_key" varchar(180) NOT NULL,
  "model_alias" varchar(128) NOT NULL,
  "provider_key" varchar(64),
  "native_model" varchar(200),
  "status" varchar(32) DEFAULT 'authorized' NOT NULL,
  "input_tokens" bigint DEFAULT 0 NOT NULL,
  "cached_input_tokens" bigint DEFAULT 0 NOT NULL,
  "output_tokens" bigint DEFAULT 0 NOT NULL,
  "provider_cost_metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "error_code" varchar(80),
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_requests_tenant_idempotency_uidx" ON "saas_template"."ai_requests" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_requests_tenant_started_idx" ON "saas_template"."ai_requests" ("tenant_id","started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_requests_project_started_idx" ON "saas_template"."ai_requests" ("project_id","started_at");
