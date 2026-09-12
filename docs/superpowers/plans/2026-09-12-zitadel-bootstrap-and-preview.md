# ZITADEL Bootstrap and Preview Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provision Mkety's first ZITADEL OIDC application from the credentials already stored in GitHub, wire its generated client credentials into the isolated Cloudflare preview, and verify the full Mkety Auth preview path without touching the Trading repository.

**Architecture:** Extend the existing provider-neutral Mkety Auth and ZITADEL management client instead of introducing a second auth path. The preview workflow will discover the configured ZITADEL URL/PAT/project ID aliases from the GitHub Actions `secrets` and `vars` contexts without printing values, then idempotently find-or-create a named Mkety Platform OIDC application, persist the generated non-secret IDs/secret into the running preview job, deploy the Auth-ready Worker, and smoke the resulting boundary. ZITADEL remains an external identity provider; Mkety continues to own sessions, users, memberships, roles, permissions, and tenant authorization.

**Tech Stack:** TypeScript, Vitest, GitHub Actions, ZITADEL Application API v2, Cloudflare Workers/Wrangler, Vinext, pnpm.

**Spec:** `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md` plus repository architecture rules in `AGENTS.md`.

## Global Constraints

- Work only in `MketyDigital/mksaas`; do not modify the Trading repository.
- Trading may only share ZITADEL-side identity resources later; no Trading code or deployment changes are part of this plan.
- Keep Mkety Auth provider-neutral; ZITADEL remains an adapter.
- Do not print or commit PATs, client secrets, database URLs, or Cloudflare credentials.
- Do not rotate an existing client secret merely to reconcile redirects.
- Use the isolated `mkety-platform-preview` Cloudflare Worker for verification.
- Do not perform the production `mkety.com` cutover; that remains a separately gated release action.

---

### Task 1: Extend ZITADEL management to find or create the Mkety OIDC application

**Files:**
- Modify: `src/shared/lib/auth/providers/zitadel-management.ts`
- Modify: `src/shared/lib/auth/providers/__tests__/zitadel-management.test.ts`

**Interfaces:**
- Consumes: issuer URL, management PAT/token, project ID, required callback URI, required post-logout URI, application name.
- Produces: `ensureZitadelOidcApplication(...)` returning `applicationId`, `projectId`, `clientId`, optional newly-created `clientSecret`, merged redirect URIs, and `created/changed` flags.

- [ ] **Step 1: Write failing tests** covering: existing matching OIDC app is reused; missing app is created; created app contains exact callback/logout URIs; existing redirects are preserved; cross-project application responses are rejected; client secret is returned only from a create response.
- [ ] **Step 2: Run the focused Vitest file** with `pnpm vitest run src/shared/lib/auth/providers/__tests__/zitadel-management.test.ts` and confirm the new tests fail before implementation.
- [ ] **Step 3: Implement the minimal ZITADEL v2 management calls** needed to search/list project applications, create the Mkety OIDC application when absent, and reconcile redirect/logout URIs without destructive replacement.
- [ ] **Step 4: Re-run the focused test** and confirm all management tests pass.
- [ ] **Step 5: Commit** with `feat: bootstrap Mkety ZITADEL OIDC application`.

### Task 2: Make the provisioning command create-or-reuse the Mkety application

**Files:**
- Modify: `scripts/provision-zitadel-redirects.ts`

**Interfaces:**
- Consumes: normalized runtime variables `MKETY_AUTH_ISSUER`, `ZITADEL_MANAGEMENT_TOKEN`, `ZITADEL_PROJECT_ID`, `MKETY_AUTH_REDIRECT_URI`, and `MKETY_AUTH_POST_LOGOUT_REDIRECT_URI`; optional `ZITADEL_APPLICATION_ID`.
- Produces: JSON containing only non-sensitive status plus `clientSecret` only when the caller explicitly captures it in-process for GitHub output masking; the script itself must never print the secret.

- [ ] **Step 1: Change the command** to call the create-or-reuse helper with application name `Mkety Platform` and allow a missing application ID.
- [ ] **Step 2: Ensure stdout contains only non-secret fields** (`applicationId`, `projectId`, `clientId`, `created`, `changed`, redirect counts).
- [ ] **Step 3: Add a GitHub-output mode** that masks and writes a newly-created client secret to `$GITHUB_OUTPUT` without echoing it.
- [ ] **Step 4: Run the focused tests and `pnpm type-check`**.
- [ ] **Step 5: Commit** with `feat: make ZITADEL provisioning create-or-reuse`.

### Task 3: Discover configured GitHub credential aliases safely in the preview job

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-preview.yml`

**Interfaces:**
- Consumes: GitHub Actions `secrets` and `vars` contexts for the `preview` environment/repository.
- Produces normalized job environment values for ZITADEL issuer, management token, project ID, and existing application ID when one exists.

- [ ] **Step 1: Add a normalization step** that parses `toJSON(secrets)` and `toJSON(vars)` inside the runner, selects only approved aliases (`ZITADEL_MANAGEMENT_TOKEN`, `ZITADEL_PAT`, `ZITADEL_TOKEN`; `ZITADEL_PROJECT_ID`; `MKETY_AUTH_ISSUER`, `ZITADEL_ISSUER`, `ZITADEL_URL`), and writes normalized values to `$GITHUB_ENV` without printing values.
- [ ] **Step 2: Print only which key names were selected** and fail with a concise missing-key error when issuer/token/project ID cannot be resolved.
- [ ] **Step 3: Remove the requirement that `ZITADEL_APPLICATION_ID` pre-exist**; let provisioning create the application when absent.
- [ ] **Step 4: Run GitHub workflow syntax validation through a branch push and verify jobs are created normally.
- [ ] **Step 5: Commit** with `ci: discover ZITADEL bootstrap credentials safely`.

### Task 4: Bind the newly created OIDC client to the Cloudflare preview

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-preview.yml`

**Interfaces:**
- Consumes: provisioning outputs `applicationId`, `clientId`, and newly-created client secret plus the existing session secret/database URL.
- Produces: Auth-ready `mkety-platform-preview` Worker secrets and exact redirect/logout configuration.

- [ ] **Step 1: Mask all generated secrets immediately** with GitHub's `::add-mask::` command before any later step can reference them.
- [ ] **Step 2: Prefer an existing `MKETY_AUTH_CLIENT_SECRET` when already configured; otherwise use the secret returned by first-time application creation.
- [ ] **Step 3: Set `MKETY_AUTH_CLIENT_ID` from the ZITADEL application result when the repository variable is absent, and use the result for this run's build/deploy.
- [ ] **Step 4: Bulk-bind `DATABASE_URL`, provider, issuer, client ID, client secret, exact redirect URI, exact post-logout URI, and session secret to the preview Worker.
- [ ] **Step 5: Rebuild and redeploy with the exact workers.dev origin, then smoke `/`, `/login`, and `/api/auth/session`.
- [ ] **Step 6: Commit** with `ci: bind bootstrapped ZITADEL client to preview`.

### Task 5: Verify the complete Auth promotion gate and record durable handoff

**Files:**
- Modify: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`
- Modify: `docs/MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md` only if the verified preview evidence changes its stated blocker.

**Interfaces:**
- Consumes: successful CI/deploy evidence from the exact branch SHA.
- Produces: durable record of created ZITADEL application identifiers, exact preview URL, callback/logout URIs, CI run IDs, and remaining browser-only verification if any.

- [ ] **Step 1: Confirm the latest branch SHA passes tests, type-check, lint, Vinext compatibility, build, packaging, and Cloudflare deployment.
- [ ] **Step 2: Confirm the workflow created or reused `Mkety Platform` in the configured ZITADEL project and registered the exact workers.dev callback/logout URLs.
- [ ] **Step 3: Confirm unauthenticated session boundary is non-5xx and the `/login` route reaches the configured ZITADEL authorization path.
- [ ] **Step 4: Record only non-secret identifiers and run evidence in the handoff docs.
- [ ] **Step 5: Commit** with `docs: record verified ZITADEL preview bootstrap`.
