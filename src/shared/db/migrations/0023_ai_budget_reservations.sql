ALTER TABLE "saas_template"."ai_budgets"
  ADD COLUMN IF NOT EXISTS "reserved_credits" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "saas_template"."ai_budgets"
  ADD COLUMN IF NOT EXISTS "reserved_requests" bigint DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "saas_template"."ai_budget_reservations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "saas_template"."tenants"("id") ON DELETE cascade,
  "budget_id" uuid NOT NULL REFERENCES "saas_template"."ai_budgets"("id") ON DELETE cascade,
  "request_id" uuid REFERENCES "saas_template"."ai_requests"("id") ON DELETE set null,
  "credit_reservation_id" uuid REFERENCES "saas_template"."ai_credit_reservations"("id") ON DELETE set null,
  "idempotency_key" varchar(160) NOT NULL,
  "fingerprint" varchar(64) NOT NULL,
  "status" varchar(24) DEFAULT 'held' NOT NULL,
  "reserved_credits" bigint NOT NULL,
  "reserved_requests" bigint DEFAULT 1 NOT NULL,
  "settled_credits" bigint,
  "settled_requests" bigint,
  "expires_at" timestamp with time zone NOT NULL,
  "settled_at" timestamp with time zone,
  "released_at" timestamp with time zone,
  "release_reason" varchar(80),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "ai_budget_reservations_budget_idempotency_uidx"
  ON "saas_template"."ai_budget_reservations" ("budget_id","idempotency_key");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_budget_reservations_tenant_status_expiry_idx"
  ON "saas_template"."ai_budget_reservations" ("tenant_id","status","expires_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_budget_reservations_request_idx"
  ON "saas_template"."ai_budget_reservations" ("request_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_budget_reservations_credit_reservation_idx"
  ON "saas_template"."ai_budget_reservations" ("credit_reservation_id");
