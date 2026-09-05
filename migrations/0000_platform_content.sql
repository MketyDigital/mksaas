DO $$ BEGIN
  CREATE TYPE "saas_template"."platform_content_status" AS ENUM ('draft', 'published', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "saas_template"."platform_navigation_area" AS ENUM ('header', 'footer');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "saas_template"."platform_content_entity" AS ENUM (
    'site_settings',
    'page',
    'page_section',
    'navigation_item',
    'pricing_plan',
    'pricing_feature',
    'docs_category',
    'docs_article'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "saas_template"."platform_content_action" AS ENUM (
    'create',
    'update',
    'publish',
    'unpublish',
    'archive',
    'delete'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "saas_template"."platform_site_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "environment" varchar(40) DEFAULT 'production' NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "brand_name" varchar(120) DEFAULT 'Mkety' NOT NULL,
  "logo_url" text,
  "favicon_url" text,
  "primary_color" varchar(7) DEFAULT '#6D5DF6' NOT NULL,
  "secondary_color" varchar(7) DEFAULT '#A855F7' NOT NULL,
  "accent_color" varchar(7) DEFAULT '#22D3EE' NOT NULL,
  "default_seo_title" varchar(160) DEFAULT 'Mkety' NOT NULL,
  "default_seo_description" text,
  "social_image_url" text,
  "contact_email" varchar(255),
  "contact_href" text,
  "legal_links_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_site_settings_environment_idx" UNIQUE ("environment")
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "slug" varchar(160) NOT NULL,
  "title" varchar(180) NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "seo_title" varchar(160),
  "seo_description" text,
  "enabled" boolean DEFAULT true NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_pages_slug_idx" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_page_sections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "page_id" uuid NOT NULL,
  "section_key" varchar(120) NOT NULL,
  "section_type" varchar(80) NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "content_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_page_sections_page_key_idx" UNIQUE ("page_id", "section_key")
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_navigation_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "area" "saas_template"."platform_navigation_area" NOT NULL,
  "parent_id" uuid,
  "label" varchar(120) NOT NULL,
  "href" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "external" boolean DEFAULT false NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_pricing_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(80) NOT NULL,
  "name" varchar(120) NOT NULL,
  "price_label" varchar(120) NOT NULL,
  "billing_label" varchar(120),
  "description" text NOT NULL,
  "highlighted" boolean DEFAULT false NOT NULL,
  "cta_label" varchar(120) NOT NULL,
  "cta_href" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_pricing_plans_key_idx" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_pricing_features" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL,
  "label" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_docs_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "key" varchar(100) NOT NULL,
  "title" varchar(180) NOT NULL,
  "description" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_docs_categories_key_idx" UNIQUE ("key")
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_docs_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "category_id" uuid NOT NULL,
  "slug" varchar(180) NOT NULL,
  "title" varchar(220) NOT NULL,
  "excerpt" text,
  "body_markdown" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "status" "saas_template"."platform_content_status" DEFAULT 'draft' NOT NULL,
  "seo_title" varchar(160),
  "seo_description" text,
  "published_at" timestamp with time zone,
  "created_by" text,
  "updated_by" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "platform_docs_articles_category_slug_idx" UNIQUE ("category_id", "slug")
);

CREATE TABLE IF NOT EXISTS "saas_template"."platform_content_revisions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "entity_type" "saas_template"."platform_content_entity" NOT NULL,
  "entity_id" uuid NOT NULL,
  "action" "saas_template"."platform_content_action" NOT NULL,
  "before_json" jsonb,
  "after_json" jsonb,
  "actor_id" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "platform_site_settings_status_idx" ON "saas_template"."platform_site_settings" ("status");
CREATE INDEX IF NOT EXISTS "platform_pages_status_idx" ON "saas_template"."platform_pages" ("status");
CREATE INDEX IF NOT EXISTS "platform_page_sections_page_sort_idx" ON "saas_template"."platform_page_sections" ("page_id", "sort_order");
CREATE INDEX IF NOT EXISTS "platform_page_sections_status_idx" ON "saas_template"."platform_page_sections" ("status");
CREATE INDEX IF NOT EXISTS "platform_navigation_items_area_sort_idx" ON "saas_template"."platform_navigation_items" ("area", "sort_order");
CREATE INDEX IF NOT EXISTS "platform_navigation_items_parent_idx" ON "saas_template"."platform_navigation_items" ("parent_id");
CREATE INDEX IF NOT EXISTS "platform_navigation_items_status_idx" ON "saas_template"."platform_navigation_items" ("status");
CREATE INDEX IF NOT EXISTS "platform_pricing_plans_status_idx" ON "saas_template"."platform_pricing_plans" ("status");
CREATE INDEX IF NOT EXISTS "platform_pricing_features_plan_sort_idx" ON "saas_template"."platform_pricing_features" ("plan_id", "sort_order");
CREATE INDEX IF NOT EXISTS "platform_docs_categories_sort_idx" ON "saas_template"."platform_docs_categories" ("sort_order");
CREATE INDEX IF NOT EXISTS "platform_docs_articles_status_idx" ON "saas_template"."platform_docs_articles" ("status");
CREATE INDEX IF NOT EXISTS "platform_docs_articles_sort_idx" ON "saas_template"."platform_docs_articles" ("category_id", "sort_order");
CREATE INDEX IF NOT EXISTS "platform_content_revisions_entity_idx" ON "saas_template"."platform_content_revisions" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "platform_content_revisions_actor_idx" ON "saas_template"."platform_content_revisions" ("actor_id");

DO $$ BEGIN
  ALTER TABLE "saas_template"."platform_page_sections" ADD CONSTRAINT "platform_page_sections_page_id_platform_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "saas_template"."platform_pages"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "saas_template"."platform_pricing_features" ADD CONSTRAINT "platform_pricing_features_plan_id_platform_pricing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "saas_template"."platform_pricing_plans"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "saas_template"."platform_docs_articles" ADD CONSTRAINT "platform_docs_articles_category_id_platform_docs_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "saas_template"."platform_docs_categories"("id") ON DELETE cascade;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "saas_template"."platform_site_settings" ADD CONSTRAINT "platform_site_settings_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "saas_template"."users"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "saas_template"."platform_site_settings" ADD CONSTRAINT "platform_site_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "saas_template"."users"("id") ON DELETE set null;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
