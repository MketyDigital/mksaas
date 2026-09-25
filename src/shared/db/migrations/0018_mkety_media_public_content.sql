-- Publish the official Mkety Media destination into the existing public docs CMS.
-- This migration is intentionally narrow: one domains article plus one domain-map sentence.

INSERT INTO "saas_template"."platform_docs_articles" (
  "category_id",
  "slug",
  "title",
  "excerpt",
  "body_markdown",
  "sort_order",
  "status",
  "published_at"
)
SELECT
  c."id",
  'mkety-media',
  'Mkety Media',
  'The official Mkety platform for current media products, features, plans, and signup.',
  '# Mkety Media

Mkety Media is an official Mkety product platform available at `https://media.mkety.com`.

Use the Media platform to discover the current Mkety Media product catalogue, review published product features and plan details, and create or join an account.

Because media products, features and commercial terms can evolve independently, `media.mkety.com` is the canonical destination for current availability, plan details and signup.',
  20,
  'published',
  now()
FROM "saas_template"."platform_docs_categories" AS c
WHERE c."key" = 'domains'
  AND c."status" = 'published'
ON CONFLICT ("category_id", "slug") DO UPDATE
SET
  "title" = EXCLUDED."title",
  "excerpt" = EXCLUDED."excerpt",
  "body_markdown" = EXCLUDED."body_markdown",
  "sort_order" = EXCLUDED."sort_order",
  "status" = EXCLUDED."status",
  "published_at" = COALESCE("saas_template"."platform_docs_articles"."published_at", EXCLUDED."published_at"),
  "updated_at" = now();
--> statement-breakpoint
UPDATE "saas_template"."platform_docs_articles" AS a
SET
  "body_markdown" = a."body_markdown" ||
    E'\n\n`media.mkety.com` is the official Mkety Media platform for current media products, published features, plan details, and signup.',
  "updated_at" = now()
FROM "saas_template"."platform_docs_categories" AS c
WHERE a."category_id" = c."id"
  AND c."key" = 'domains'
  AND a."slug" = 'domain-map'
  AND a."status" = 'published'
  AND a."body_markdown" NOT ILIKE '%media.mkety.com%';
