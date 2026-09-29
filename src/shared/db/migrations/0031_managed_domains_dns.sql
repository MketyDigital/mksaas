DO $$ BEGIN
  CREATE TYPE "saas_template"."managed_domain_status" AS ENUM('pending', 'active', 'expired', 'suspended');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."managed_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "domain" varchar(255) NOT NULL,
  "status" "saas_template"."managed_domain_status" DEFAULT 'pending' NOT NULL,
  "provider_domain_ref" text,
  "registration_order_id" varchar(160),
  "expires_at" timestamp with time zone,
  "auto_renew" boolean DEFAULT false NOT NULL,
  "dns_zone_id" text,
  "dns_status" varchar(40) DEFAULT 'pending' NOT NULL,
  "name_servers" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "managed_domains_tenant_id_tenants_id_fk"
    FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "managed_domains_domain_uidx"
  ON "saas_template"."managed_domains" USING btree ("domain");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "managed_domains_tenant_order_uidx"
  ON "saas_template"."managed_domains" USING btree ("tenant_id","registration_order_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "managed_domains_tenant_status_idx"
  ON "saas_template"."managed_domains" USING btree ("tenant_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "managed_domains_expiry_idx"
  ON "saas_template"."managed_domains" USING btree ("expires_at");
