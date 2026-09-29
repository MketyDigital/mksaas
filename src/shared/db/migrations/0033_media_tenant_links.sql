CREATE TABLE IF NOT EXISTS "saas_template"."media_tenant_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "external_workspace_ref" varchar(255) NOT NULL,
  "status" varchar(32) DEFAULT 'linked' NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "linked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "disconnected_at" timestamp with time zone,
  "created_by_user_id" text,
  "updated_by_user_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "media_tenant_links_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  CONSTRAINT "media_tenant_links_created_by_user_id_users_id_fk"
    FOREIGN KEY ("created_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null,
  CONSTRAINT "media_tenant_links_updated_by_user_id_users_id_fk"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "saas_template"."users"("id") ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_tenant_links_tenant_uidx"
  ON "saas_template"."media_tenant_links" ("tenant_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_tenant_links_status_idx"
  ON "saas_template"."media_tenant_links" ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_tenant_links_external_ref_idx"
  ON "saas_template"."media_tenant_links" ("external_workspace_ref");
