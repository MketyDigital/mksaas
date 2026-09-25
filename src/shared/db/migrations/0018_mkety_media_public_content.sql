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

Mkety Media is a standalone Mkety product for managed media storage and delivery at `https://media.mkety.com`.

Upload images, videos and general files, organize them into buckets, and use permanent cached Mkety delivery URLs across websites, landing pages, applications, campaigns, training content and other systems.

Core capabilities include secure direct and multipart uploads, bucket-based organization, storage/delivery/request usage monitoring, prepaid hard limits, team access within plan seat limits, self-service upgrades, extra prepaid capacity, and complete library export through JSON/CSV manifests and generated download-all scripts.

Public plans are Starter, Growth and Business. Billing supports monthly, 3-month, 6-month and 12-month terms. Current prices, discounts and exact quotas are managed on the Media platform and should be checked there before purchase. Public plans are prepaid and hard-capped rather than creating unlimited post-paid overage.

Enterprise is request-based and can use exact private pricing and quotas, extra team seats, branded media domains, assisted migration, retention/deletion-protection requirements, data-residency options, regional or dedicated infrastructure, private/signed delivery requirements, and contractual SLA terms where agreed.

Customers retain ownership of uploaded content. Standard delivery URLs are public to anyone who has the URL; private or signed delivery is an Enterprise/custom requirement. Mkety Media also provides full-library portability so customers can export their inventory and move their files.

Use `media.mkety.com` as the canonical source for current plan details, signup and product availability.',
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
