-- Reconcile only the exact previously repaired Mkety Trading workspace handoff.
-- The 0004 migration intentionally routed Trading to /enterprise. The owning
-- Trading product now has its verified production customer domain at
-- https://trade.mkety.com. Only rows that still match that exact prior repair
-- are changed; admin-customized Trading cards are left untouched.

WITH prior_repaired_workspace_sections AS (
  SELECT
    section.id,
    jsonb_set(
      section.content_json,
      '{items}',
      (
        SELECT jsonb_agg(
          CASE
            WHEN item ->> 'key' = 'trading'
              AND item ->> 'title' = 'Trading Workspace'
              AND item ->> 'description' = 'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.'
              AND item ->> 'href' = '/enterprise'
              AND item ->> 'badge' = 'Custom / Enterprise'
            THEN jsonb_set(
              item,
              '{href}',
              to_jsonb('https://trade.mkety.com'::text),
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
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(section.content_json -> 'items') AS workspace(item)
      WHERE item ->> 'key' = 'trading'
        AND item ->> 'title' = 'Trading Workspace'
        AND item ->> 'description' = 'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.'
        AND item ->> 'href' = '/enterprise'
        AND item ->> 'badge' = 'Custom / Enterprise'
    )
)
UPDATE "saas_template"."platform_page_sections" AS section
SET
  content_json = prior_repaired_workspace_sections.reconciled_content,
  updated_at = now()
FROM prior_repaired_workspace_sections
WHERE section.id = prior_repaired_workspace_sections.id
  AND section.content_json IS DISTINCT FROM prior_repaired_workspace_sections.reconciled_content;
