# Mkety Public CMS Draft/Publish Flow

## Status

Foundation implemented on branch `spec/mkety-public-site-cms`.

This document records the current admin content flow for `mkety.com`, `/docs`, public pricing/navigation/settings, and the `app.mkety.com` app-experience layer.

## Flow

```text
Admin opens Platform Control Center
  ↓
Admin opens Public Website & Docs or App Experience
  ↓
Admin edits JSON payload in the CMS form
  ↓
Save draft
  ↓
Server validates payload shape and permission
  ↓
Database draft rows are created/updated
  ↓
Revision rows are recorded
  ↓
Publish draft
  ↓
Draft rows are promoted to published
  ↓
Public/app routes are revalidated
```

## Supported draft persistence in this foundation

The current action layer supports database draft writes for:

- `site_settings`
- `page_section` for `home.hero`
- `navigation_item` collections
- `pricing_plan` collections with feature bullets
- `docs_article` collections with docs categories
- `app_experience` dashboard, workspace cards, and control-center modules

Unsupported entity types intentionally throw an error until their schema/UI/storage path is defined.

## Permission boundary

The action layer does not trust the browser.

Each request is checked server-side:

- public-site, docs, pricing, navigation, settings → `platform:content`
- app-experience → `platform:app-experience`

The normal tenant admin permission remains separate from platform content authority.

## Revision boundary

Public content changes write to:

```text
platform_content_revisions
```

App experience changes write to:

```text
platform_app_experience_revisions
```

These revisions record before/after snapshots where available.

## Route revalidation

After save or publish, the system revalidates:

```text
/
/docs
/t/[tenant]/admin/platform-control
/t/[tenant]/admin/platform-control/public-site
```

Future work can add narrower revalidation when page-level and article-level editing is more granular.

## Safety boundary

The CMS must never write directly to:

- billing ledger balances
- payment provider state
- private keys
- Auth Gateway signing keys
- deployment execution engines
- tenant isolation rules
- security policy logic
- raw entitlement enforcement logic

Those remain protected platform logic.

## Follow-up implementation

Before production use:

1. Run `pnpm type-check`, `pnpm test`, `pnpm lint`, and `pnpm build`.
2. Reconcile manual SQL migrations with Drizzle-generated output.
3. Confirm revision writes match the final schema.
4. Add granular editors instead of raw JSON once the foundation is stable.
5. Add audit events for each publish action using the existing Mkety audit table.
