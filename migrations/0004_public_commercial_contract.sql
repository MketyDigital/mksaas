-- Reconcile only the exact legacy Mkety homepage Workspaces payload.
-- This is intentionally NOT a general CMS overwrite: admin-customized content
-- that no longer matches the recognized legacy defaults is left untouched.

WITH legacy_workspace_sections AS (
  SELECT
    section.id,
    jsonb_set(
      section.content_json,
      '{items}',
      (
        SELECT jsonb_agg(
          CASE item ->> 'key'
            WHEN 'deploy' THEN jsonb_set(
              item,
              '{description}',
              to_jsonb('Publish websites, lightweight applications, APIs, portals, and serverless workloads with domains and deployment history.'::text),
              true
            )
            WHEN 'trading' THEN jsonb_set(
              jsonb_set(
                item,
                '{description}',
                to_jsonb('Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.'::text),
                true
              ),
              '{href}',
              to_jsonb('/enterprise'::text),
              true
            )
            ELSE item
          END
          ORDER BY ordinality
        )
        FROM jsonb_array_elements(section.content_json -> 'items') WITH ORDINALITY AS workspace(item, ordinality)
      ),
      true
    ) AS reconciled_content
  FROM "saas_template"."platform_page_sections" AS section
  INNER JOIN "saas_template"."platform_pages" AS page
    ON page.id = section.page_id
  WHERE page.slug = 'home'
    AND section.status = 'published'
    AND section.section_key IN ('workspaces', 'home.workspaces')
    AND jsonb_array_length(COALESCE(section.content_json -> 'items', '[]'::jsonb)) = 4
    AND section.content_json @> jsonb_build_object(
      'items',
      jsonb_build_array(
        jsonb_build_object(
          'key', 'deploy',
          'description', 'Publish websites, lightweight applications, APIs, portals, and services with domains and environments.',
          'href', '/app/deploy'
        ),
        jsonb_build_object(
          'key', 'trading',
          'description', 'Custom and enterprise trading infrastructure presented as a specialized solution, not a self-service plan.',
          'href', '#enterprise',
          'badge', 'Custom / Enterprise'
        )
      )
    )
)
UPDATE "saas_template"."platform_page_sections" AS section
SET
  content_json = legacy_workspace_sections.reconciled_content,
  updated_at = now()
FROM legacy_workspace_sections
WHERE section.id = legacy_workspace_sections.id;
