ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN IF NOT EXISTS "sales_email" varchar(255),
  ADD COLUMN IF NOT EXISTS "telegram_href" text,
  ADD COLUMN IF NOT EXISTS "public_ai_guidance" text,
  ADD COLUMN IF NOT EXISTS "public_ai_fallback_message" text;
