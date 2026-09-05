# SDD ledger — plan: docs/superpowers/plans/2026-09-05-mkety-public-site-cms.md

## Current status

Implementation is moving forward on branch `spec/mkety-public-site-cms` as the active Mkety build branch. The goal is not scattered notes; every checkpoint should make the repo more Mkety and reduce the old generic template surface.

## Progress

- Added public website/docs CMS foundation schema and tests.
- Added platform app experience schema and tests for `app.mkety.com` dashboard/workspace/control-center presentation.
- Added Mkety public content Zod schemas and defaults.
- Added Mkety app experience Zod schemas and defaults.
- Added migration drafts for both platform content and app experience foundations.
- Added fallback loaders for public platform content and app experience defaults.
- Converted `src/app/page.tsx` to render a Mkety homepage through `MketyHomePage` and platform content loaders.
- Added `Platform Control Center` under tenant admin with module cards and dynamic module pages.
- Updated docs metadata from generic template language to Mkety documentation language.
- Added `docs/MKETY_AUTH_GATEWAY_ARCHITECTURE.md` to adapt the central Mkety Auth Gateway recommendation into the active mksaas architecture.
- Added Auth Gateway as a Level 4 Security/Identity module in the Platform Control Center defaults.

## Boundary rulings

Ruling: Admin-editable scope includes public website/docs content and app dashboard/workspace presentation/configuration only — backend logic, security rules, billing ledger calculations, deployment engines, and tenant isolation remain code-controlled — cost if wrong: future rework to move unsafe settings out of admin-editable content.

Ruling: App dashboard/workspace admin management is a related but separate layer from public site/docs CMS — use platform app experience schema and defaults instead of mixing it into `platform_pages` — cost if wrong: extra migration/refactor to merge models later.

Ruling: Central Platform Control Center should be a navigable command dashboard of safe modules, not a single unrestricted editor — cost if wrong: admin UX may need refactor to split dangerous controls back into separate protected modules.

Ruling: Mkety Auth Gateway fits AGENTS.md as the reusable identity/access contract between ZITADEL and products, but this branch should document and expose it as a guarded control-center module first rather than implementing production signing/JWKS logic inside the public CMS batch — cost if wrong: gateway implementation may need a separate feature branch and security review before product integration.

Ruling: Keep ZITADEL as identity provider while Mkety owns product access assertions; products must verify Mkety assertions and still enforce product-local authorization — cost if wrong: future products could become tightly coupled to raw ZITADEL claims and need migration later.

## Verification status

Not verified in this connector session. Before merge, run:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## Required cleanup before merge

- Restore/confirm the complete full design spec text if any earlier doc edit compressed it.
- Reconcile manual migration SQL with Drizzle-generated migration output.
- Verify foreign key names and migration ordering against the repo's migration journal conventions.
- Verify new route imports and UI component props with `pnpm type-check`.
- Replace fallback-only loaders with database-backed reads once migration verification is complete.
