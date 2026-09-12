# Mkety Auth + ZITADEL Production Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the verified Mkety Auth/ZITADEL branch with current `main`, automate safe ZITADEL project/application configuration, deploy the isolated Cloudflare preview, and prove the external Auth promotion gate without modifying the Trading repository.

**Architecture:** Preserve the provider-neutral Mkety Auth core and keep ZITADEL confined to the OIDC/provider-management boundary. Reuse the existing guarded main→Auth reconciliation workflow, then add an idempotent ZITADEL management client/workflow that configures only Mkety-owned identity resources and records non-secret evidence. The Cloudflare preview remains `mkety-platform-preview`; production domain registration remains separately gated.

**Tech Stack:** Next.js/React/TypeScript, pnpm, Jest, Drizzle/PostgreSQL, GitHub Actions, Cloudflare Workers/vinext, ZITADEL OIDC + Core Resources V2 APIs.

**Spec:** `docs/superpowers/specs/2026-09-12-mkety-production-platform-completion-design.md` on branch `spec/mkety-production-platform-completion`.

## Global Constraints

- `AGENTS.md` is the architectural source of truth.
- Never edit, rebase, merge, deploy, or otherwise modify `MketyDigital/Trading`.
- Trading-related work in this batch is limited to ZITADEL-side resources genuinely required for shared Mkety identity.
- Never print, commit, persist in artifacts, or echo secret values.
- Do not force-update `main` or the Auth branch.
- Do not merge Auth to `main` until the documented external Cloudflare/ZITADEL/authenticated-smoke gate is complete.
- Production callback/logout URIs and production routing are not authorized by this plan.
- ZITADEL project/application changes must be idempotent and non-destructive toward unrelated resources.
- Use ZITADEL Core Resources V2 APIs for project/application operations; legacy v1 is only a fallback if a required operation is unavailable in V2.

---

### Task 1: Reconcile current main into Auth with the existing guarded workflow

**Files:**
- Existing: `.github/workflows/_auth-main-reconcile.yml`
- Existing: `.github/workflows/_auth-main-conflict-probe.yml`
- Existing: `.github/workflows/_auth-main-drizzle-drift-probe.yml`
- Existing verification targets: `.env.example`, `.mega-linter.yml`, `docs/README.md`, `jest.setup.tsx`, `src/app/layout.tsx`, `src/shared/db/migrations/meta/0009_snapshot.json`, `scripts/migrate-mkety-platform-content.ts`, `scripts/deploy-vinext-cloudflare.sh`

**Interfaces:**
- Consumes: exact current `main` SHA `0693b00fba639549d92c4dd82a2fcef618d0bd47`.
- Produces: a verified two-parent merge commit on `feat/mkety-auth-zitadel-vinext` with current public-site main ancestry and preserved Mkety Auth behavior.

- [ ] **Step 1:** Re-read `_auth-main-reconcile.yml` and verify its `EXPECTED_MAIN_SHA` still equals current `main`.
- [ ] **Step 2:** Trigger the guarded reconciliation by a documentation-only workflow-file change; do not weaken any guard.
- [ ] **Step 3:** Inspect the resulting Actions run. Expected: merge conflict set is limited to the five pre-reviewed files; migration prefix collision is repaired; Drizzle forward generation becomes a no-op; Auth.js/Auth0 active config stays absent.
- [ ] **Step 4:** Require all internal gates to pass: frozen install, migration baseline, Drizzle consistency, full tests, type-check, lint, `vinext check`, production build, isolated preview dry-run.
- [ ] **Step 5:** Confirm the workflow pushes only if the remote Auth head has not moved and record the resulting merge SHA.

### Task 2: Add a tested idempotent ZITADEL management domain client

**Files:**
- Create: `scripts/zitadel/manage-mkety-auth.ts`
- Create: `scripts/zitadel/manage-mkety-auth.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes environment: `ZITADEL_ISSUER`, `ZITADEL_MANAGEMENT_TOKEN`, optional `ZITADEL_ORGANIZATION_ID`, `MKETY_ZITADEL_PROJECT_NAME`, `MKETY_ZITADEL_APP_NAME`, `MKETY_PREVIEW_URL`, `MKETY_ZITADEL_APPLY`.
- Produces stdout JSON containing only non-secret fields: `issuer`, `organizationId`, `projectId`, `applicationId`, `clientId`, `redirectUris`, `postLogoutRedirectUris`, `changed`, `mode`.
- Never emits the bearer token or generated client secret.

- [ ] **Step 1: RED — project/app discovery test.** Add a Jest test with a local fake `fetch` proving an existing compatible project and OIDC application are selected by exact Mkety names and no create call is made.
- [ ] **Step 2:** Run `pnpm test scripts/zitadel/manage-mkety-auth.test.ts` and confirm failure because the management module does not exist.
- [ ] **Step 3: GREEN — minimal discovery implementation.** Implement V2 `ListProjects`/`ListApplications` calls with `Authorization: Bearer <token>`, `Connect-Protocol-Version: 1`, JSON request/response validation, and exact-name selection.
- [ ] **Step 4:** Re-run the targeted test and require PASS.
- [ ] **Step 5: RED — create-on-missing test.** Prove a missing Mkety project/app is created only when `apply=true`; dry-run reports intended creation without mutating.
- [ ] **Step 6:** Run the targeted test and confirm the new case fails.
- [ ] **Step 7: GREEN — implement idempotent create.** Use ZITADEL V2 CreateProject/CreateApplication with Authorization Code + PKCE compatible OIDC configuration, preserving unrelated resources.
- [ ] **Step 8:** Re-run targeted tests and require PASS.
- [ ] **Step 9: RED — redirect reconciliation test.** Prove `<preview>/api/auth/callback` and `<preview>/login` are merged into the OIDC configuration without deleting unrelated approved URIs and repeated execution becomes a no-op.
- [ ] **Step 10:** Run and confirm failure.
- [ ] **Step 11: GREEN — implement update.** Use V2 UpdateApplication, changing only the Mkety OIDC application and only when the desired configuration differs.
- [ ] **Step 12:** Re-run targeted tests and full Auth/provider tests.
- [ ] **Step 13:** Add `pnpm zitadel:manage:mkety-auth` script.

### Task 3: Add GitHub Actions ZITADEL management automation without exposing secrets

**Files:**
- Create: `.github/workflows/mkety-zitadel-auth-config.yml`
- Modify: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

**Interfaces:**
- Secret aliases accepted at one binding point only: `ZITADEL_MANAGEMENT_TOKEN`, `ZITADEL_ACCESS_TOKEN`, `ZITADEL_PAT`, `ZITADEL_ACCESS`.
- Issuer aliases accepted at one binding point only: repository/environment variable `MKETY_AUTH_ISSUER` or secret `ZITADEL_ISSUER`/`ZITADEL_ISSUER_URL`.
- Inputs: `preview_url`, `apply` (`false` default), `configure_trading` (`false` default).
- Output evidence: non-secret IDs/URIs only through step summary/artifact-safe JSON.

- [ ] **Step 1:** Add a workflow preflight that resolves supported secret aliases into one internal environment variable and reports only whether configuration is present, never values.
- [ ] **Step 2:** Validate `preview_url` is HTTPS and ends in `.workers.dev` for this promotion batch.
- [ ] **Step 3:** Run the management script first in dry-run mode.
- [ ] **Step 4:** Require explicit `apply=true` before ZITADEL mutation.
- [ ] **Step 5:** Keep Trading configuration disabled by default and make its path require explicit, separately supplied redirect/logout inputs; do not read or modify the Trading repo.
- [ ] **Step 6:** Update the Auth handoff with the workflow contract and evidence rules.

### Task 4: Bind ZITADEL configuration to the real Cloudflare preview lifecycle

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-preview.yml`
- Test/validation: workflow execution + existing Auth tests

**Interfaces:**
- Consumes: deployed `preview_url` from the existing Cloudflare preview workflow.
- Produces: exact callback/post-logout values and an Auth-ready Worker once GitHub env values are available.

- [ ] **Step 1:** Preserve current Cloudflare credential preflight and exact workers.dev URL extraction.
- [ ] **Step 2:** After preview deployment, invoke or duplicate the safe ZITADEL management script in `apply=true` mode using the exact preview URL.
- [ ] **Step 3:** Write resulting non-secret `clientId` to job output/summary; do not attempt to print an OIDC client secret.
- [ ] **Step 4:** Fail closed if an existing compatible confidential OIDC app lacks a usable GitHub `MKETY_AUTH_CLIENT_SECRET`; do not rotate secrets automatically unless the workflow has a dedicated rotation gate.
- [ ] **Step 5:** Bind `MKETY_AUTH_ISSUER`, `MKETY_AUTH_CLIENT_ID`, `MKETY_AUTH_CLIENT_SECRET`, `MKETY_AUTH_SESSION_SECRET`, redirect URI and logout URI to the preview Worker as already designed.
- [ ] **Step 6:** Rebuild/redeploy the exact-origin preview and run public route + unauthenticated session-boundary smoke.

### Task 5: Prove Auth runtime invariants after reconciliation

**Files:**
- Existing tests: `src/shared/lib/auth/__tests__/oidc.test.ts`
- Existing tests: `src/shared/lib/auth/providers/__tests__/zitadel.test.ts`
- Existing tests: `src/shared/lib/auth/__tests__/service.test.ts`
- Existing tests: `src/app/(auth)/select-tenant/page.test.ts`
- Existing tests: `src/app/team/page.test.ts`

**Interfaces:**
- Produces: evidence that state/nonce/issuer/audience/signature validation, Mkety-owned sessions, current membership authorization, and logout behavior remain unchanged after public-site ancestry merge.

- [ ] **Step 1:** Run exact Auth/provider/routing regression suites.
- [ ] **Step 2:** Run full repository test suite.
- [ ] **Step 3:** Run type-check, lint, migration guard, Drizzle check, vinext compatibility, production build, preview dry-run.
- [ ] **Step 4:** Record exact reconciled SHA and workflow run IDs in the handoff.

### Task 6: External authenticated-smoke gate and promotion decision

**Files:**
- Modify only evidence docs if needed: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`, `docs/HANDOFF_MKETY_AUTH_LIVE_2026-09-10.md`

**Interfaces:**
- Required flow: login → ZITADEL authorization → callback → Mkety session → protected route/current tenant authorization → logout → revoked Mkety session → post-logout redirect.

- [ ] **Step 1:** Confirm the ZITADEL authorize endpoint accepts the preview redirect and returns a valid login/authorization response rather than redirect-uri rejection.
- [ ] **Step 2:** Complete a real browser sign-in using an authorized test/member identity; never place credentials in logs or docs.
- [ ] **Step 3:** Verify the Mkety session endpoint is authenticated after callback and protected tenant routing resolves current DB membership rather than stale provider/session roles.
- [ ] **Step 4:** Logout and verify the Mkety session is revoked and the browser returns to `<preview>/login`.
- [ ] **Step 5:** If browser automation is unavailable in the current execution environment, leave Auth in DRAFT and record the exact single remaining manual/UI gate instead of weakening or pretending it passed.
- [ ] **Step 6:** Only after all steps pass, mark PR #16 ready/promotable; do not merge downstream Webhooks before this point.

## Verification Commands

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm type-check
pnpm lint
pnpm db:check:migrations
pnpm exec drizzle-kit check
pnpx vinext check
pnpm build
pnpm run deploy --env preview --dry-run
```

## Completion Evidence

Record at completion:

- reconciled Auth SHA and two parents;
- successful CI/workflow run IDs;
- `mkety-platform-preview` workers.dev URL;
- ZITADEL issuer, project ID, application ID, client ID (non-secret only);
- exact preview callback/logout URIs;
- Auth runtime binding state;
- authenticated smoke outcome;
- confirmation that `MketyDigital/Trading` repository was not modified.
