ALTER TABLE "saas_template"."platform_site_settings" ADD COLUMN "support_config_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "saas_template"."platform_site_settings" ADD COLUMN "assistant_config_json" jsonb DEFAULT '{}'::jsonb NOT NULL;
