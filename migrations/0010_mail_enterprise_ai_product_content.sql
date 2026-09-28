-- Publish Mkety Mail commercial plans and Enterprise AI/Mail product boundaries.
-- This migration is CMS-safe: it only removes untouched seed-generated records so
-- the normal content seeder can recreate them from current defaults.
-- Admin-managed records with actor IDs are preserved.

DELETE FROM "saas_template"."platform_page_sections" s
USING "saas_template"."platform_pages" p
WHERE s."page_id" = p."id"
  AND p."slug" IN ('home','pricing','enterprise')
  AND s."created_by" IS NULL
  AND s."updated_by" IS NULL;

DELETE FROM "saas_template"."platform_docs_articles"
WHERE "created_by" IS NULL
  AND "updated_by" IS NULL;

DELETE FROM "saas_template"."platform_docs_categories" c
WHERE c."created_by" IS NULL
  AND c."updated_by" IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "saas_template"."platform_docs_articles" a
    WHERE a."category_id" = c."id"
  );
