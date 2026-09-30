CREATE TABLE IF NOT EXISTS "saas_template"."platform_editorial_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "area" varchar(40) NOT NULL,
  "entity_type" varchar(40) NOT NULL,
  "entity_key" varchar(180) NOT NULL,
  "payload_json" jsonb NOT NULL,
  "updated_by" text REFERENCES "saas_template"."users"("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_editorial_drafts_key_idx"
  ON "saas_template"."platform_editorial_drafts" ("area", "entity_type", "entity_key");
