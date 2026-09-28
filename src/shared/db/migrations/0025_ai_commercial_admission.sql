ALTER TABLE "saas_template"."ai_requests"
  ADD COLUMN IF NOT EXISTS "rate_card_id" uuid REFERENCES "saas_template"."ai_rate_cards"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "saas_template"."ai_requests"
  ADD COLUMN IF NOT EXISTS "rate_card_version" integer;
--> statement-breakpoint
ALTER TABLE "saas_template"."ai_requests"
  ADD COLUMN IF NOT EXISTS "reserved_credits" bigint;
--> statement-breakpoint
ALTER TABLE "saas_template"."ai_requests"
  ADD COLUMN IF NOT EXISTS "settled_credits" bigint;
