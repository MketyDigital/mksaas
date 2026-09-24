-- One-time reconciliation of the known stale homepage Academy handoff.
-- Preserve all other CMS-managed JSON and change only the obsolete direct Academy destination.

UPDATE "saas_template"."platform_page_sections" AS s
SET
  "content_json" = jsonb_set(
    jsonb_set(s."content_json", '{cta,label}', '"Ask Mkety AI about Academy"'::jsonb, true),
    '{cta,href}',
    '"/academy#mkety-ai"'::jsonb,
    true
  ),
  "updated_at" = now()
FROM "saas_template"."platform_pages" AS p
WHERE s."page_id" = p."id"
  AND p."slug" = 'home'
  AND s."section_key" = 'academy'
  AND s."content_json"::text ILIKE '%academy.mkety.com%';
--> statement-breakpoint
UPDATE "saas_template"."platform_page_sections" AS s
SET
  "content_json" = jsonb_set(
    s."content_json",
    '{2,answer}',
    to_jsonb('Start Academy questions on the public Academy page and with Mkety AI. Mkety AI can explain published programmes, schedules, enrolment steps and capture follow-up details; the Academy access destination is provided separately after Mkety confirms the appropriate enrolment/access. New Trading sales, custom pricing, and access requests start through Mkety Enterprise.'::text),
    true
  ),
  "updated_at" = now()
FROM "saas_template"."platform_pages" AS p
WHERE s."page_id" = p."id"
  AND p."slug" = 'home'
  AND s."section_key" = 'faq'
  AND s."content_json"::text ILIKE '%academy.mkety.com%';
