-- Restore the intended public sales flow for Trading: Enterprise first.
-- Only the exact 0005-produced public Trading card is changed back to
-- /enterprise. Entitled product access remains separate from public sales.

WITH production_handoff_sections AS (
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
              AND item ->> 'href' = 'https://trade.mkety.com'
              AND item ->> 'badge' = 'Custom / Enterprise'
            THEN jsonb_set(item, '{href}', to_jsonb('/enterprise'::text), true)
            ELSE item
          END
          ORDER BY ordinality
        )
        FROM jsonb_array_elements(section.content_json -> 'items') WITH ORDINALITY AS workspace(item, ordinality)
      ),
      true
    ) AS reconciled_content
  FROM "saas_template"."platform_page_sections" AS section
  INNER JOIN "saas_template"."platform_pages" AS page ON page.id = section.page_id
  WHERE page.slug = 'home'
    AND section.status = 'published'
    AND section.section_key IN ('workspaces', 'home.workspaces')
    AND EXISTS (
      SELECT 1
      FROM jsonb_array_elements(section.content_json -> 'items') AS workspace(item)
      WHERE item ->> 'key' = 'trading'
        AND item ->> 'title' = 'Trading Workspace'
        AND item ->> 'description' = 'Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.'
        AND item ->> 'href' = 'https://trade.mkety.com'
        AND item ->> 'badge' = 'Custom / Enterprise'
    )
)
UPDATE "saas_template"."platform_page_sections" AS section
SET content_json = production_handoff_sections.reconciled_content, updated_at = now()
FROM production_handoff_sections
WHERE section.id = production_handoff_sections.id
  AND section.content_json IS DISTINCT FROM production_handoff_sections.reconciled_content;
