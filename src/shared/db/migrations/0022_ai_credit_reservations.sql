ALTER TYPE "saas_template"."credit_ledger_entry_type" ADD VALUE IF NOT EXISTS 'reservation_hold';
--> statement-breakpoint
ALTER TYPE "saas_template"."credit_ledger_entry_type" ADD VALUE IF NOT EXISTS 'reservation_release';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."ai_credit_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "project_id" uuid REFERENCES "saas_template"."projects"("id") ON DELETE set null,
  "api_key_id" uuid REFERENCES "saas_template"."ai_api_keys"("id") ON DELETE set null,
  "request_id" uuid REFERENCES "saas_template"."ai_requests"("id") ON DELETE set null,
  "idempotency_key" varchar(160) NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "status" varchar(24) DEFAULT 'held' NOT NULL,
  "reserved_credits" bigint NOT NULL,
  "settled_credits" bigint,
  "hold_ledger_entry_id" uuid REFERENCES "saas_template"."credit_ledger_entries"("id") ON DELETE set null,
  "release_ledger_entry_id" uuid REFERENCES "saas_template"."credit_ledger_entries"("id") ON DELETE set null,
  "usage_event_id" uuid REFERENCES "saas_template"."usage_events"("id") ON DELETE set null,
  "expires_at" timestamp with time zone NOT NULL,
  "settled_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "release_reason" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_credit_reservations_tenant_idempotency_uidx"
  ON "saas_template"."ai_credit_reservations" ("tenant_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_credit_reservations_tenant_status_expiry_idx"
  ON "saas_template"."ai_credit_reservations" ("tenant_id","status","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_credit_reservations_request_idx"
  ON "saas_template"."ai_credit_reservations" ("request_id");
