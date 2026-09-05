CREATE TYPE "saas_template"."platform_app_experience_status" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "saas_template"."platform_app_experience_entity" AS ENUM ('dashboard_settings', 'workspace_card', 'control_center_module');

CREATE TABLE "saas_template"."platform_app_dashboard_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "environment" varchar(40) DEFAULT 'production' NOT NULL,
  "tenant_id" uuid,
  "status" "saas_template"."platform_app_experience_status" DEFAULT 'draft' NOT NULL,
  "headline" varchar(180) DEFAULT 'Welcome to Mkety' NOT NULL,
  "description" text,
  "primary_cta_label" varchar(120) DEFAULT 'Create Project' NOT NULL,
  "primary_cta_href" text DEFAULT '/create-workspace' NOT NULL,
  "secondary_cta_label" varchar(120) DEFAULT 'Explore SolutionHub',
  "secondary_cta_href" text DEFAULT '/app/solutions',
  "support_label" varchar(120) DEFAULT 'Need help?',
  "support_href" text DEFAULT '/docs',
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "saas_template"."platform_workspace_cards" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "workspace_key" varchar(80) NOT NULL,
  "label" varchar(120) NOT NULL,
  "description" text NOT NULL,
  "href" text NOT NULL,
  "icon_key" varchar(80),
  "badge_label" varchar(80),
  "enabled" boolean DEFAULT true NOT NULL,
  "requires_entitlement" varchar(120),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "saas_template"."platform_app_experience_status" DEFAULT 'draft' NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "saas_template"."platform_app_control_center_modules" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "module_key" varchar(100) NOT NULL,
  "label" varchar(140) NOT NULL,
  "description" text NOT NULL,
  "href" text NOT NULL,
  "icon_key" varchar(80),
  "level" integer NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "required_permission" varchar(160) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "saas_template"."platform_app_experience_status" DEFAULT 'draft' NOT NULL,
  "metadata_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "saas_template"."platform_app_experience_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" "saas_template"."platform_app_experience_entity" NOT NULL,
  "entity_id" uuid NOT NULL,
  "before_json" jsonb,
  "after_json" jsonb,
  "actor_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE "saas_template"."platform_app_dashboard_settings" ADD CONSTRAINT "platform_app_dashboard_settings_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade;
ALTER TABLE "saas_template"."platform_app_dashboard_settings" ADD CONSTRAINT "platform_app_dashboard_settings_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "saas_template"."user"("id") ON DELETE set null;
ALTER TABLE "saas_template"."platform_app_dashboard_settings" ADD CONSTRAINT "platform_app_dashboard_settings_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "saas_template"."user"("id") ON DELETE set null;
ALTER TABLE "saas_template"."platform_workspace_cards" ADD CONSTRAINT "platform_workspace_cards_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "saas_template"."tenants"("id") ON DELETE cascade;
ALTER TABLE "saas_template"."platform_workspace_cards" ADD CONSTRAINT "platform_workspace_cards_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "saas_template"."user"("id") ON DELETE set null;
ALTER TABLE "saas_template"."platform_workspace_cards" ADD CONSTRAINT "platform_workspace_cards_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "saas_template"."user"("id") ON DELETE set null;
ALTER TABLE "saas_template"."platform_app_control_center_modules" ADD CONSTRAINT "platform_app_control_center_modules_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "saas_template"."user"("id") ON DELETE set null;
ALTER TABLE "saas_template"."platform_app_control_center_modules" ADD CONSTRAINT "platform_app_control_center_modules_updated_by_user_id_fk" FOREIGN KEY ("updated_by") REFERENCES "saas_template"."user"("id") ON DELETE set null;
ALTER TABLE "saas_template"."platform_app_experience_revisions" ADD CONSTRAINT "platform_app_experience_revisions_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "saas_template"."user"("id") ON DELETE set null;

CREATE UNIQUE INDEX "platform_app_dashboard_settings_scope_idx" ON "saas_template"."platform_app_dashboard_settings" USING btree ("environment", "tenant_id");
CREATE INDEX "platform_app_dashboard_settings_status_idx" ON "saas_template"."platform_app_dashboard_settings" USING btree ("status");
CREATE INDEX "platform_app_dashboard_settings_tenant_idx" ON "saas_template"."platform_app_dashboard_settings" USING btree ("tenant_id");
CREATE UNIQUE INDEX "platform_workspace_cards_scope_key_idx" ON "saas_template"."platform_workspace_cards" USING btree ("tenant_id", "workspace_key");
CREATE INDEX "platform_workspace_cards_tenant_sort_idx" ON "saas_template"."platform_workspace_cards" USING btree ("tenant_id", "sort_order");
CREATE INDEX "platform_workspace_cards_status_idx" ON "saas_template"."platform_workspace_cards" USING btree ("status");
CREATE UNIQUE INDEX "platform_app_control_center_modules_key_idx" ON "saas_template"."platform_app_control_center_modules" USING btree ("module_key");
CREATE INDEX "platform_app_control_center_modules_level_sort_idx" ON "saas_template"."platform_app_control_center_modules" USING btree ("level", "sort_order");
CREATE INDEX "platform_app_control_center_modules_status_idx" ON "saas_template"."platform_app_control_center_modules" USING btree ("status");
CREATE INDEX "platform_app_experience_revisions_entity_idx" ON "saas_template"."platform_app_experience_revisions" USING btree ("entity_type", "entity_id");
CREATE INDEX "platform_app_experience_revisions_actor_idx" ON "saas_template"."platform_app_experience_revisions" USING btree ("actor_id");
