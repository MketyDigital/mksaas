ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN "sales_email" varchar(255);
--> statement-breakpoint
ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN "telegram_href" text;
--> statement-breakpoint
ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN "public_ai_prompt" text;
--> statement-breakpoint
ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN "public_ai_fallback_message" text;
--> statement-breakpoint
ALTER TABLE "saas_template"."platform_site_settings"
  ADD COLUMN "public_ai_lead_capture_enabled" boolean DEFAULT true NOT NULL;
