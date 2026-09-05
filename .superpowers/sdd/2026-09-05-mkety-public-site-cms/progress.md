# SDD ledger — plan: docs/superpowers/plans/2026-09-05-mkety-public-site-cms.md

## Current status

Implementation has moved in thin slices on branch `spec/mkety-public-site-cms`.

## Progress

- Added public website/docs CMS foundation schema and tests.
- Added platform app experience schema and tests for `app.mkety.com` dashboard/workspace/control-center presentation.
- Added Mkety public content Zod schemas and defaults.
- Added Mkety app experience Zod schemas and defaults.
- Added migration drafts for both platform content and app experience foundations.

## Boundary rulings

Ruling: Admin-editable scope includes public website/docs content and app dashboard/workspace presentation/configuration only — backend logic, security rules, billing ledger calculations, deployment engines, and tenant isolation remain code-controlled — cost if wrong: future rework to move unsafe settings out of admin-editable content.

Ruling: App dashboard/workspace admin management is a related but separate layer from public site/docs CMS — use platform app experience schema and defaults instead of mixing it into `platform_pages` — cost if wrong: extra migration/refactor to merge models later.

Ruling: Central Platform Control Center should be a navigable command dashboard of safe modules, not a single unrestricted editor — cost if wrong: admin UX may need refactor to split dangerous controls back into separate protected modules.

## Verification status

Not verified in this connector session. Before merge, run:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## Required cleanup before merge

- Restore the complete full design spec text if a later doc edit has compressed it.
- Reconcile manual migration SQL with Drizzle-generated migration output.
- Verify foreign key names and migration ordering against the repo's migration journal conventions.
