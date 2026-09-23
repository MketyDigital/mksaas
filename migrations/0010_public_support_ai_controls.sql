ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN IF NOT EXISTS "sales_email" varchar(255),
  ADD COLUMN IF NOT EXISTS "telegram_url" text,
  ADD COLUMN IF NOT EXISTS "public_assistant_fallback_message" text,
  ADD COLUMN IF NOT EXISTS "public_assistant_prompt_extension" text,
  ADD COLUMN IF NOT EXISTS "public_assistant_lead_capture_enabled" boolean DEFAULT true NOT NULL;

UPDATE "saas_template"."platform_site_settings"
SET
  "contact_email" = COALESCE("contact_email", 'support@mkety.com'),
  "contact_href" = CASE
    WHEN "contact_href" IS NULL OR "contact_href" = '/contact' THEN '/contact?ask=support'
    ELSE "contact_href"
  END,
  "sales_email" = COALESCE("sales_email", 'hello@mkety.com'),
  "telegram_url" = COALESCE("telegram_url", 'https://t.me/mketyadmin'),
  "public_assistant_fallback_message" = COALESCE(
    "public_assistant_fallback_message",
    'Mkety AI could not complete that request just now. You can leave your contact details here, message Mkety on Telegram, or email our support team.'
  ),
  "public_assistant_lead_capture_enabled" = COALESCE("public_assistant_lead_capture_enabled", true)
WHERE "environment" = 'production';

CREATE TABLE IF NOT EXISTS "saas_template"."public_support_leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "conversation_id" uuid,
  "intent" varchar(32) DEFAULT 'general' NOT NULL,
  "name" varchar(160) NOT NULL,
  "email" varchar(255) NOT NULL,
  "phone" varchar(80),
  "message" text NOT NULL,
  "source_path" text,
  "status" varchar(32) DEFAULT 'new' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "public_support_leads_conversation_id_public_ai_conversations_id_fk"
    FOREIGN KEY ("conversation_id")
    REFERENCES "saas_template"."public_ai_conversations"("id")
    ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "public_support_leads_status_idx"
  ON "saas_template"."public_support_leads" ("status");
CREATE INDEX IF NOT EXISTS "public_support_leads_created_idx"
  ON "saas_template"."public_support_leads" ("created_at");
CREATE INDEX IF NOT EXISTS "public_support_leads_email_idx"
  ON "saas_template"."public_support_leads" ("email");


UPDATE "saas_template"."platform_pricing_plans"
SET "cta_href" = '/contact?ask=sales', "updated_at" = now()
WHERE "key" = 'enterprise' AND "cta_href" = '/contact';
