# Mkety Public Release Gate Finish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish PR #24 with exact-SHA public-site release evidence, preserve safe production cutover authorization, and hand the repository back to the ordered Platform stack without stale documentation.

**Architecture:** Treat CI, candidate deployment, database security, documentation, and production cutover as separate gates. Repair root causes without weakening broad checks, require fresh evidence after every head-changing commit, and do not promote downstream Platform branches until their prerequisite ancestry and external integration gates are satisfied.

**Tech Stack:** Next.js 16, TypeScript, pnpm, Jest, ESLint/MegaLinter, Drizzle/PostgreSQL, Supabase-hosted development PostgreSQL, vinext, Cloudflare Workers, GitHub Actions.

**Spec:** `docs/superpowers/plans/2026-09-08-mkety-public-site-production.md`, `docs/MKETY_DEVELOPMENT_CONTINUATION.md`, and `docs/MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`.

## Global Constraints

- `AGENTS.md` is the highest-priority architecture authority.
- `mkety.com` public-site acceptance precedes `app.mkety.com` Platform promotion.
- Preserve Platform promotion order: Auth #16 → Webhooks #15 → Billing #21 → Entitlements #22 → Usage/Credits #23.
- Never print or commit secrets.
- Never treat generic implementation approval as the literal production cutover confirmation phrase.
- Never silence a security/quality check broadly when a narrow root-cause repair is available.

---

### Task 1: Repair public release CI blockers

**Files:**

- Modify: `.github/workflows/mkety-public-candidate-route-diagnostic.yml`
- Modify: `.mega-linter.yml`
- Modify: `cspell.json`

**Interfaces:**

- Consumes: PR #24 release workflows and candidate HTML.
- Produces: valid workflow syntax and narrowly scoped static-analysis behavior.

- [x] Reproduce and inspect actionlint, Checkov, cspell, and Lychee failures from the MegaLinter artifact.
- [x] Fix invalid candidate diagnostic YAML without disabling actionlint.
- [x] Keep Checkov enabled and exclude only `CKV_GHA_7` for the deliberate typed cutover inputs.
- [x] Add legitimate Mkety/tool/British-English vocabulary to cspell.
- [x] Exclude only runtime/API command URLs from Lychee and remove the self-referential exclusion that Lychee parsed as a link.
- [ ] Verify fresh MegaLinter success on the exact final PR head.

### Task 2: Make database smoke failures diagnosable and preserve the contract

**Files:**

- Modify: `.github/workflows/mkety-content-db-smoke.yml`

**Interfaces:**

- Consumes: staging `DATABASE_URL` through `STAGING_DATABASE_URL`.
- Produces: blocking migration/seed/smoke status plus an always-uploaded diagnostic log.

- [x] Preserve smoke stdout/stderr with `tee` while retaining failure propagation through `pipefail`.
- [x] Upload the smoke diagnostic artifact on success or failure.
- [x] Re-run migrations, seed, and smoke on the connected staging database and confirm the previously observed failure does not reproduce on the repaired head.
- [ ] Verify fresh content DB smoke success on the exact final PR head.

### Task 3: Harden the connected PostgreSQL security boundary

**Files:**

- Create: `migrations/0008_harden_rls_auto_enable.sql`
- Modify: `scripts/migrate-mkety-platform-content.ts`

**Interfaces:**

- Consumes: existing `public.rls_auto_enable()` event-trigger helper.
- Produces: internal-only EXECUTE permissions while preserving automatic RLS enablement on DDL.

- [x] Inspect the Supabase security advisor and function ACL/definition.
- [x] Confirm the `SECURITY DEFINER` event-trigger function does not require client EXECUTE privileges.
- [x] Revoke EXECUTE from `PUBLIC`, `anon`, and `authenticated` in an idempotent repository migration.
- [x] Add migration `0008` to the Mkety content migration runner.
- [x] Apply the same migration to the connected Mkety development database.
- [x] Re-run the security advisor and confirm the exposed SECURITY DEFINER finding clears.
- [ ] Verify repository DB smoke remains green with migration `0008` included on the exact final head.

### Task 4: Reconcile active documentation

**Files:**

- Modify: `docs/README.md`
- Create: `docs/MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`
- Create: `docs/superpowers/plans/2026-09-10-mkety-release-gate-finish.md`

**Interfaces:**

- Consumes: `AGENTS.md`, continuation roadmap, active PRs, and fresh release evidence.
- Produces: an unambiguous current source-of-truth index and dated operational handoff.

- [x] Replace template-centric docs index language with Mkety source-of-truth ordering.
- [x] Record September 10 CI/database security repairs and remaining advisor notes.
- [x] Record production cutover authorization boundary.
- [x] Record exact Platform promotion order and Auth external gate.
- [ ] Update PR #24 readiness metadata only after final evidence is green.

### Task 5: Verify and promote the public-site branch

**Files:**

- Verify only unless a fresh failure identifies a root-cause file.

**Interfaces:**

- Consumes: exact final PR #24 head SHA.
- Produces: merge eligibility based on immutable evidence.

- [ ] Confirm tests, type-check, lint, build, CI/PR validation, vinext smoke, content DB smoke, Public AI runtime diagnostic, routing preflight, candidate route diagnostic, MegaLinter, and isolated candidate deployment all succeed for the exact same SHA.
- [ ] Inspect candidate evidence for route, payment safety, and Public AI privacy/runtime smoke.
- [ ] Merge PR #24 only after the full blocking gate is green.
- [ ] Do not run production route cutover unless the explicit workflow confirmation phrase is separately authorized.

### Task 6: Resume the ordered Platform stack

**Files:**

- Branch/PR-specific; do not flatten the stack.

**Interfaces:**

- Consumes: promoted public-site/main ancestry and verified prerequisite PR head.
- Produces: revalidated Auth → Webhooks → Billing → Entitlements → Usage/Credits ancestry.

- [ ] Reconcile Auth #16 with current main and rerun its internal verification.
- [ ] Complete Auth external Cloudflare/ZITADEL/browser gate before promotion.
- [ ] Promote/reverify Webhooks #15 only on the exact promoted Auth ancestry.
- [ ] Promote/reverify Billing #21 only on promoted Webhooks ancestry.
- [ ] Promote/reverify Entitlements #22 only on promoted Billing ancestry.
- [ ] Promote/reverify Usage/Credits #23 only on promoted Entitlements ancestry.
- [ ] Record any external secret/provider action that cannot be completed through repository automation as an explicit blocker rather than bypassing it.
