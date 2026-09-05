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
- Added `src/features/platform-app-experience/control-center-registry.ts` as the central registry for module key, label, route, permission, safety level, domain ownership, editable scope, protected scope, status, and implementation notes.
- Updated control-center queries and dynamic module pages to render from the central registry, reducing duplicated module definitions and making future build batches easier to continue.
- Updated public platform-content loaders to attempt published DB reads for site settings, navigation, pricing, docs, docs articles, and homepage sections, while falling back safely to Mkety defaults if data/tables are missing.
- Added `src/features/platform-content/server/seed.ts` to seed Mkety public website/docs defaults into published platform-content database records without overwriting existing admin-managed content.
- Added `docs/MKETY_PUBLIC_CONTENT_SEEDING.md` to document safe content seeding rules and rollout boundaries.
- Added seed contract tests for platform content and platform app experience.
- Added `src/features/platform-app-experience/server/seed.ts` to seed app.mkety.com dashboard, workspace cards, and Platform Control Center modules into published app-experience database records.
- Updated platform app-experience loaders to attempt DB reads for dashboard, workspace cards, and control-center modules while preserving safe fallbacks.
- Updated app-experience schemas so DB-loaded control-center modules preserve domain, status, editable scope, protected scope, and implementation notes.
- Replaced validation-only CMS action stubs with transactional database draft saves and publish promotion for supported entities: site settings, homepage sections, navigation, pricing, docs, and app experience.
- Added revision writes for draft/publish mutations through `platform_content_revisions` and `platform_app_experience_revisions`.
- Updated `PlatformContentDraftForm` with Save draft and Publish draft controls.
- Added `docs/MKETY_PUBLIC_CMS_DRAFT_PUBLISH_FLOW.md` to document the draft/publish lifecycle, supported entities, permission boundary, revision boundary, and safety exclusions.
- Updated action tests to cover the persistence request shapes used by the admin CMS forms.
- Added `src/features/platform-content/server/audit.ts` to write high-level CMS audit events into `audit_events` while preserving the existing `persons.id` actor boundary.
- Wired draft save and publish actions to attempt audit events and return `auditRecorded` status to the admin UI.
- Updated `PlatformContentDraftForm` to show mutation counts and audit status after Save draft or Publish draft.
- Added `docs/MKETY_CMS_AUDIT_EVENTS.md` to document revision snapshots, audit event keys, actor handling, failure behavior, and future hardening.
- Added a CMS audit writer contract test.
- Restored the full original public CMS specification at `docs/superpowers/specs/2026-09-05-mkety-public-site-cms-design.md` from the preserved blob and appended the later app-experience/domain/auth addendum.
- Added `docs/MKETY_CMS_MIGRATION_RECONCILIATION.md` to record the required migration/type/database verification checklist before the PR leaves draft.
- Fixed public homepage loader section-key compatibility so seeded keys (`hero`, `workspaces`, `faq`, `footer`) and admin-saved keys (`home.hero`, `home.workspaces`, `home.faq`, `home.footer`) can both render.
- Tightened app-experience published reads so global dashboard/workspace content is restricted to published rows with `tenantId` null.
- Removed the stale public CMS spec restore-required marker now that the full spec is restored at branch tip.
- Loosened `platform_page_sections.content_json` and revision snapshot JSON types to support validated section payloads that are objects or arrays.
- Hardened CMS actions by serializing revision snapshots into JSON-safe values before inserting into revision tables.
- Normalized homepage section keys in draft and publish actions so `hero` and `home.hero` resolve to the same persisted section.
- Tightened publish operations so site settings, homepage sections, and app-experience global content publish only matching draft rows instead of overly broad records.
- Made the CMS audit insert null-safe by omitting nullable `entityId` instead of explicitly assigning a null UUID field.
- Replaced `migrations/0001_platform_app_experience.sql` with an idempotent migration aligned to the Drizzle schema and corrected the wrong `saas_template.user` references to `saas_template.users`.
- Replaced `migrations/0000_platform_content.sql` with a complete aligned migration including the missing user foreign keys for pages, sections, navigation, pricing, docs, and revisions.
- Added the missing `route` icon mapping for the Domains & Routing Platform Control Center module.
- Rechecked `AGENTS.md` before the CI repair batch to keep the work aligned with the full Mkety blueprint: mksaas remains the Mkety Platform/public-site repo, Mkety is not AI-only, Platform and Academy remain the two primary products, and enterprise/customer solutions stay separate.
- Removed the stale `./assessments` schema barrel export because there is no `src/shared/db/schema/assessments.ts` on the branch.
- Updated `LoginForm` tests to explicitly pass `enableAuth0Login` and `enableDevelopmentLogin` for configured-provider expectations, while preserving a separate no-provider fallback test.
- Split the CI workflow into independent `test`, `type-check`, `lint`, and `build` jobs so one failure no longer hides the remaining verification signals.

## Boundary rulings

Ruling: Admin-editable scope includes public website/docs content and app dashboard/workspace presentation/configuration only — backend logic, security rules, billing ledger calculations, deployment engines, and tenant isolation remain code-controlled — cost if wrong: future rework to move unsafe settings out of admin-editable content.

Ruling: App dashboard/workspace admin management is a related but separate layer from public site/docs CMS — use platform app experience schema and defaults instead of mixing it into `platform_pages` — cost if wrong: extra migration/refactor to merge models later.

Ruling: Central Platform Control Center should be a navigable command dashboard of safe modules, not a single unrestricted editor — cost if wrong: admin UX may need refactor to split dangerous controls back into separate protected modules.

Ruling: Mkety Auth Gateway fits AGENTS.md as the reusable identity/access contract between ZITADEL and products, but this branch should document and expose it as a guarded control-center module first rather than implementing production signing/JWKS logic inside the public CMS batch — cost if wrong: gateway implementation may need a separate feature branch and security review before product integration.

Ruling: Keep ZITADEL as identity provider while Mkety owns product access assertions; products must verify Mkety assertions and still enforce product-local authorization — cost if wrong: future products could become tightly coupled to raw ZITADEL claims and need migration later.

Ruling: Domain routing must follow the approved Mkety map: `mkety.com` for public site/docs entry, `app.mkety.com` for the authenticated platform, `api.mkety.com` for API surface, `origin.mkety.com` for infrastructure-only routing, and `*.mkety.app` for customer deployments — cost if wrong: future routing and deployment work may mix product surfaces and need migration.

Ruling: Platform admin routes should use Mkety-specific guard functions layered on the existing PBAC `requirePermission` system — cost if wrong: replacing PBAC would duplicate authorization logic and make revocation/audit behavior harder to reason about.

Ruling: Platform Control Center modules now have a single registry source. Future modules should update the registry instead of scattering labels, permissions, domain ownership, and protected/editable scope across pages — cost if wrong: duplicated admin-control rules would drift across the UI.

Ruling: Public and app-experience loaders may attempt database reads only with safe fallbacks to code-owned Mkety defaults until migration verification is complete — cost if wrong: public pages could fail if content tables are not yet migrated or seeded.

Ruling: Seed modules must be idempotent and must not overwrite existing admin-managed records — cost if wrong: admin edits could be lost during rollout.

Ruling: Draft/publish actions now perform transactional DB writes for supported CMS entities and record revisions, but must still be verified with type-check/build before merge — cost if wrong: Drizzle type issues or migration mismatches may need correction before production.

Ruling: CMS actions record revision snapshots transactionally and now attempt high-level audit events after mutations. Audit events store auth user identity in metadata until the user/person mapping is verified — cost if wrong: actor IDs could be incorrectly written into a `persons.id` foreign key.

Ruling: Audit event failure currently does not roll back content mutation; the UI reports `auditRecorded: false`. Production hardening should decide whether publish must fail closed on audit failure — cost if wrong: a content change may exist without a high-level audit event, although revision rows still exist.

Ruling: The full original public CMS spec must remain at branch tip, with app-experience/domain/auth additions appended as addenda rather than replacing the original spec — cost if wrong: future agents may lose the original scope and acceptance criteria.

Ruling: Public homepage rendering must accept both seeded section keys and admin form section keys until the final editor model standardizes section IDs — cost if wrong: admins could save/publish a hero section that does not render.

Ruling: App-experience loaders must read only published global records unless explicitly building tenant-specific app customization — cost if wrong: draft or tenant-specific workspace cards could leak into the global `app.mkety.com` experience.

Ruling: Platform content JSON columns and revision snapshots must allow validated JSON arrays as well as objects because homepage sections like FAQ/footer can be stored as ordered arrays — cost if wrong: seeds and draft saves can fail type-checking or runtime insertion.

Ruling: Revision snapshots should be JSON-serialized before insert so database row objects and Date values do not leak into JSONB writes as unverified runtime objects — cost if wrong: revision writes may fail or store inconsistent values.

Ruling: The migration SQL should be idempotent and should reference the actual Auth.js `users` table from `src/shared/db/schema/auth.ts`; earlier `saas_template.user` references are invalid — cost if wrong: migrations can fail before app code loads.

Ruling: Larger batches are acceptable when they move the product forward, but they still must preserve safe boundaries and avoid pretending unverified code has passed tests — cost if wrong: hidden type/import issues may need local correction later.

Ruling: Every new development batch should re-check the full Mkety blueprint/AGENTS direction before changing code, especially when moving quickly — cost if wrong: fast implementation may drift from product boundaries, approved domains, or security/tenant isolation rules.

## Verification status

CI restarted on commit `a799d898525756d9143a63b75bc9da3565d16315` after the CI repair batch. Job results are pending and must be read before claiming verification.

Before merge, the required checks remain:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

## Required cleanup before merge

- Reconcile manual migration SQL with Drizzle-generated migration output.
- Verify foreign key names and migration ordering against the repo's migration journal conventions.
- Verify new route imports and UI component props with `pnpm type-check`.
- Review DB-backed loaders, seed modules, draft/publish persistence, and audit writer after migration generation to catch any Drizzle typing/import issues.
- Decide whether production publish should fail closed if `audit_events` insert fails.
