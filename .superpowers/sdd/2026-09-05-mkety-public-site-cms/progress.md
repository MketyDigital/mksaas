# SDD ledger — plan: docs/superpowers/plans/2026-09-05-mkety-public-site-cms.md

## Current status

Branch `spec/mkety-public-site-cms` is the active Mkety public-site/CMS build branch for PR #5.

The branch now has CI verification on GitHub Actions run `33969822840` for commit `449aee67665b22acbd36f2e6c850197b5ce1bdb7`:

```text
Test:       passed
Type-check: passed
Lint:       passed
Build:      passed
```

The build verification required making CMS-backed public routes render dynamically instead of being statically prerendered during CI. The dynamic routes are intentional because the homepage and docs read through database-backed/fallback content loaders.

## Blueprint checkpoint

Before the verification and build-fix batch, `AGENTS.md` was rechecked. The active architecture remains:

- `mksaas` is the authoritative Mkety Platform and public website repository.
- Mkety is not AI-only; AI is one major capability inside a broader technology platform.
- Primary products remain Mkety Platform and Mkety Academy.
- Enterprise/customer solutions such as Trading and `mklms` remain separate from the core Platform product boundary.
- Trading stays visible in the frontend but remains Custom/Enterprise.
- Approved domains remain `mkety.com`, `app.mkety.com`, `api.mkety.com`, `origin.mkety.com`, and `*.mkety.app`.
- Admin-editable surfaces must not directly control backend logic, security rules, tenant isolation, billing ledger calculations, deployment engines, private keys, or Auth Gateway signing keys.

## Implemented progress

- Added platform public-content schema for `mkety.com` site settings, pages, page sections, navigation, pricing, docs, revisions, and publishing state.
- Added platform app-experience schema for `app.mkety.com` dashboard, workspace cards, control-center modules, and revisions.
- Added Mkety public content defaults and Zod schemas.
- Added Mkety app-experience defaults and Zod schemas.
- Added DB-backed content loaders with safe fallbacks to code-owned Mkety defaults.
- Added idempotent seed modules for public Mkety content and app-experience defaults.
- Converted the public homepage to render through `MketyHomePage` and platform content loaders.
- Converted `/docs` and `/docs/[...slug]` to render from Mkety docs content instead of old template docs content.
- Marked CMS-backed public homepage/docs routes as dynamic so production build does not hang during static page generation.
- Added Platform Control Center under tenant admin.
- Added Public Website & Docs module and nested public-site admin sections for pages, navigation, pricing, docs, and settings.
- Added App Experience module surface for dashboard/workspace/control-center content.
- Added central Platform Control Center registry for module labels, permissions, safety level, domain ownership, editable scope, protected scope, status, and implementation notes.
- Added Domains & Routing module and documentation for `mkety.com`, `app.mkety.com`, `api.mkety.com`, `origin.mkety.com`, `*.mkety.app`, and custom hostnames.
- Added Mkety Auth Gateway architecture documentation aligned to the ZITADEL identity boundary.
- Added Mkety-specific platform-content authorization guards layered on the existing PBAC permission system.
- Added draft-save and publish server actions for supported CMS entities.
- Added revision writes for public content and app-experience mutations.
- Added high-level CMS audit event attempts and admin UI feedback for audit status.
- Added `PlatformContentDraftForm` with Save draft and Publish draft controls.
- Restored the full original public CMS specification and appended later app-experience/domain/auth addenda.
- Removed stale spec-restore marker after restoration.
- Added migration reconciliation documentation.
- Replaced public-content and app-experience migration drafts with more complete idempotent SQL aligned to the Drizzle schema.
- Corrected app-experience migration references from `saas_template.user` to `saas_template.users`.
- Completed missing user foreign keys in public-content migration SQL.
- Added missing `route` icon mapping for Domains & Routing.
- Removed stale schema barrel exports and aligned the barrel with real schema files.
- Updated LoginForm tests for explicit provider flags and no-provider fallback behavior.
- Updated stale permission tests to match DB-backed authorization as source of truth.
- Split CI into independent Test, Type-check, Lint, and Build jobs.
- Fixed workflow API typing by validating workflow definitions as `WorkflowDefinition`.
- Fixed import ordering and linter issues surfaced by CI.
- Fixed CI build environment by setting `SKIP_ENV_VALIDATION=true` only for the CI Build job.

## Boundary rulings

Ruling: Admin-editable scope includes public website/docs content and app dashboard/workspace presentation/configuration only — backend logic, security rules, billing ledger calculations, deployment engines, private keys, and tenant isolation remain code-controlled.

Ruling: App dashboard/workspace admin management is related to but separate from public site/docs CMS; use platform app-experience schema/defaults instead of mixing it into `platform_pages`.

Ruling: Central Platform Control Center is a navigable command dashboard of safe modules, not a single unrestricted editor.

Ruling: Mkety Auth Gateway fits AGENTS.md as the reusable identity/access contract between ZITADEL and products, but production signing/JWKS/token issuance is intentionally not implemented in this public CMS batch.

Ruling: Keep ZITADEL as identity provider while Mkety owns product access assertions; products must verify Mkety assertions and still enforce product-local authorization.

Ruling: Domain routing must follow the approved Mkety domain map and must not turn `origin.mkety.com` into a public or marketing surface.

Ruling: Platform admin routes should use Mkety-specific guard functions layered on the existing PBAC `requirePermission` system.

Ruling: Platform Control Center modules have a single registry source. Future modules should update the registry instead of scattering module labels, permissions, and protected/editable scope across pages.

Ruling: Public and app-experience loaders may attempt database reads only with safe fallbacks to code-owned Mkety defaults until migration/database verification is complete.

Ruling: Seed modules must be idempotent and must not overwrite existing admin-managed records.

Ruling: CMS actions record revision snapshots transactionally and attempt high-level audit events after mutations. Audit events store auth user identity in metadata until the auth-user/person mapping is verified.

Ruling: Audit event failure currently does not roll back content mutation; the UI reports `auditRecorded: false`. Production hardening should decide whether publish must fail closed on audit failure.

Ruling: Public homepage rendering must accept both seeded section keys and admin form section keys until the final editor model standardizes section IDs.

Ruling: App-experience loaders must read only published global records unless explicitly building tenant-specific app customization.

Ruling: Platform content JSON columns and revision snapshots must allow validated JSON arrays as well as objects because homepage sections like FAQ/footer can be stored as ordered arrays.

Ruling: Revision snapshots should be JSON-serialized before insert so database row objects and Date values do not leak into JSONB writes as unverified runtime objects.

Ruling: Larger batches are acceptable when they move the product forward, but they must preserve safe boundaries and avoid pretending unverified code has passed tests.

Ruling: Every development batch must re-check the full Mkety blueprint/AGENTS direction before changing code, especially when moving quickly.

## Verification status

Verified in GitHub Actions on run `33969822840`, commit `449aee67665b22acbd36f2e6c850197b5ce1bdb7`:

```bash
pnpm test       # passed
pnpm type-check # passed
pnpm lint       # passed
pnpm build      # passed
```

## Required cleanup before merge / production rollout

- Reconcile manual migration SQL with Drizzle-generated migration output.
- Verify foreign key names and migration ordering against the repo's migration journal conventions.
- Run database smoke tests against a real PostgreSQL instance with the migrations applied.
- Smoke test seed idempotency for public content and app experience.
- Smoke test draft save, publish, revision rows, audit event attempt, and route revalidation against a migrated database.
- Decide whether production publish should fail closed if `audit_events` insert fails.
- Consider moving PR #5 out of draft only after migration/database smoke testing is complete.
