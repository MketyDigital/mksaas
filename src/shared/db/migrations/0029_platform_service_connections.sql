CREATE TABLE IF NOT EXISTS "saas_template"."platform_service_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "service_key" varchar(80) NOT NULL,
  "provider_key" varchar(80) NOT NULL,
  "mode" varchar(32) DEFAULT 'production' NOT NULL,
  "secret_ref" text,
  "endpoint_url" text,
  "status" varchar(32) DEFAULT 'disabled' NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_service_connections_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null,
  CONSTRAINT "platform_service_connections_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "platform_service_connections_service_provider_mode_uidx"
  ON "saas_template"."platform_service_connections" USING btree ("service_key","provider_key","mode");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "platform_service_connections_service_status_idx"
  ON "saas_template"."platform_service_connections" USING btree ("service_key","status");
