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
- Converted `/docs` landing page to a Mkety documentation hub backed by platform-content defaults.
- Converted `/docs/[...slug]` article rendering to use Mkety platform docs content instead of old template docs content.
- Added `Public Website & Docs` control module route and nested module placeholders for pages, navigation, pricing, docs, and settings.
- Added `docs/MKETY_DOMAIN_ARCHITECTURE.md` to lock the AGENTS.md domain/subdomain boundaries into implementation guidance.
- Added `Domains & Routing` as a Platform Control Center module for mkety.com, app.mkety.com, api.mkety.com, origin.mkety.com, `*.mkety.app`, and custom hostnames.
- Added a Mkety docs category/article for Deployments and Domains so public/internal docs reflect the approved domain map.
- Updated dynamic Platform Control Center module actions to show domain-specific controls and the infrastructure-only boundary for `origin.mkety.com`.
- Added Mkety platform-content authorization guards that wrap the existing `requirePermission` system instead of creating a parallel authorization layer.
- Added server action boundaries for draft save and publish requests with Zod validation, platform-area permission checks, and path revalidation.
- Updated Platform Control Center, module routes, Public Website & Docs route, and nested public-site section routes to use Mkety-specific authorization guards.
- Added reusable `PlatformContentDraftForm` client component for validating CMS payloads through server actions.
- Wired Public Website & Docs section pages to prefill and validate Mkety defaults for pages, navigation, pricing, docs, and settings.
- Wired the App Experience control module to validate dashboard/workspace/control-center defaults through the same server action boundary.
- Added `Mkety Control Center` to the admin sidebar so the platform-control area is reachable from normal admin navigation.

## Boundary rulings

Ruling: Admin-editable scope includes public website/docs content and app dashboard/workspace presentation/configuration only — backend logic, security rules, billing ledger calculations, deployment engines, and tenant isolation remain code-controlled — cost if wrong: future rework to move unsafe settings out of admin-editable content.

Ruling: App dashboard/workspace admin management is a related but separate layer from public site/docs CMS — use platform app experience schema and defaults instead of mixing it into `platform_pages` — cost if wrong: extra migration/refactor to merge models later.

Ruling: Central Platform Control Center should be a navigable command dashboard of safe modules, not a single unrestricted editor — cost if wrong: admin UX may need refactor to split dangerous controls back into separate protected modules.

Ruling: Mkety Auth Gateway fits AGENTS.md as the reusable identity/access contract between ZITADEL and products, but this branch should document and expose it as a guarded control-center module first rather than implementing production signing/JWKS logic inside the public CMS batch — cost if wrong: gateway implementation may need a separate feature branch and security review before product integration.

Ruling: Keep ZITADEL as identity provider while Mkety owns product access assertions; products must verify Mkety assertions and still enforce product-local authorization — cost if wrong: future products could become tightly coupled to raw ZITADEL claims and need migration later.

Ruling: Domain routing must follow the approved Mkety map: `mkety.com` for public site/docs entry, `app.mkety.com` for the authenticated platform, `api.mkety.com` for API surface, `origin.mkety.com` for infrastructure-only routing, and `*.mkety.app` for customer deployments — cost if wrong: future routing and deployment work may mix product surfaces and need migration.

Ruling: Platform admin routes should use Mkety-specific guard functions layered on the existing PBAC `requirePermission` system — cost if wrong: replacing PBAC would duplicate authorization logic and make revocation/audit behavior harder to reason about.

Ruling: Draft/publish server actions are currently validated/authorized boundaries with revalidation but no DB mutation until migrations are reconciled and type-checked — cost if wrong: premature DB writes could lock in incorrect migration shape or unsafe revision behavior.

Ruling: Larger batches are acceptable when they move the product forward, but they still must preserve safe boundaries and avoid pretending unverified code has passed tests — cost if wrong: hidden type/import issues may need local correction later.

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
- Replace validated draft/publish action stubs with transactional DB writes that create revision snapshots and audit events.
