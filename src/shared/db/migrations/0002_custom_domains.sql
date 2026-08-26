CREATE TYPE "public"."custom_domain_status" AS ENUM('pending', 'verified', 'disabled');--> statement-breakpoint
CREATE TABLE "custom_domains" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "hostname" varchar(255) NOT NULL,
  "status" "custom_domain_status" DEFAULT 'pending' NOT NULL,
  "provider" varchar(50) DEFAULT 'vercel' NOT NULL,
  "provider_verified" text,
  "verification" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "custom_domains_hostname_unique" UNIQUE("hostname")
);--> statement-breakpoint
CREATE INDEX "custom_domains_tenant_idx" ON "custom_domains" USING btree ("tenant_id");--> statement-breakpoint
ALTER TABLE "custom_domains" ADD CONSTRAINT "custom_domains_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
