-- Retired Mkety public plan identities must not remain visible after the
-- documented Starter / Workspaces / Mkety One / Enterprise commercial model.
-- This targets only the explicitly retired legacy identities and leaves the
-- current six plans and unrelated data untouched.

UPDATE "saas_template"."platform_pricing_plans"
SET
  status = 'archived',
  updated_at = now()
WHERE lower(key) IN ('growth', 'pro', 'business')
  AND status = 'published';
