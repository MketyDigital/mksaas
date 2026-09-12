# Mkety Auth + ZITADEL Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the latest production public-site `main` baseline into Mkety Auth, automate the minimum required ZITADEL management safely, deploy the isolated Cloudflare preview, prove real authentication end to end, and promote Auth without touching the Trading repository.

**Architecture:** Preserve the provider-neutral Mkety Auth core with ZITADEL as the OIDC adapter. Reconcile current `main` into `feat/mkety-auth-zitadel-vinext` using a guarded merge that treats Auth migrations, public-site migrations, content/runtime work, and current authorization invariants as explicit conflict domains. Use GitHub Actions for secret-bearing ZITADEL management and Cloudflare preview operations; only non-secret IDs/URLs may be persisted as evidence.

**Tech Stack:** Next.js/React/TypeScript, pnpm, Drizzle/PostgreSQL, Cloudflare Workers/vinext, ZITADEL OIDC + Management API, GitHub Actions, Jest/Vitest-compatible repository test commands.

**Spec:** `docs/superpowers/specs/2026-09-12-mkety-production-platform-completion-design.md`

## Global Constraints

- `AGENTS.md` remains authoritative.
- Do not edit, rebase, merge, deploy, or otherwise modify `MketyDigital/Trading`.
- Trading may receive only the minimum ZITADEL-side shared-identity resources that are proven necessary; no speculative Trading configuration.
- Never print, commit, upload as artifact, or persist ZITADEL/Cloudflare/database secret plaintext.
- Preserve Mkety-owned sessions, internal users, memberships, RBAC, billing/entitlement boundaries, and fail-closed authorization.
- Do not merge Webhooks #15 or any downstream Platform branch until Auth external verification succeeds.
- Production `mkety.com` / `app.mkety.com` routing remains separately gated; this plan uses the isolated `mkety-platform-preview` worker.
- Existing public-site migration files and Auth migration files must not be silently renumbered or rewritten. Any collision must be explicitly reconciled and then proven by migration guards and forward-generation no-op checks.

---

### Task 1: Establish exact reconciliation baseline and conflict map

**Files:**
- Read: `AGENTS.md`
- Read: `docs/MKETY_DEVELOPMENT_CONTINUATION.md`
- Read: `docs/MKETY_RELEASE_GATE_HANDOFF_2026-09-10.md`
- Read: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md` from Auth branch
- Read: `.github/workflows/mkety-cloudflare-preview.yml` from Auth branch
- Read: `src/shared/db/migrations/**` and root `migrations/**` namespaces as applicable
- No implementation write until conflict map is recorded

**Interfaces:**
- Consumes: current `main` SHA, current Auth branch SHA, PR #25 state
- Produces: a written conflict/risk map covering runtime, migrations, auth routes, environment contract, public-site changes, and workflows

- [ ] **Step 1: Record immutable branch heads and ancestry**

Run repository compare/status operations and record current `main`, `feat/mkety-auth-zitadel-vinext`, PR #16, and PR #25 SHAs. Confirm the common merge base.

- [ ] **Step 2: Enumerate changed-file overlap**

Compare `main...feat/mkety-auth-zitadel-vinext` and identify files modified by both sides, prioritizing `package.json`, environment validation, `wrangler.jsonc`, `src/proxy.ts`, DB schemas/migrations, layout/public routing, and CI workflows.

- [ ] **Step 3: Prove migration namespace expectations**

Confirm Auth's application migration order through `0009_mkety_auth.sql`, current public-site migration namespace/order, Drizzle journal state, and whether any filenames collide after merging current `main`.

- [ ] **Step 4: Write reconciliation notes**

Add a dated section to `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md` on the Auth branch describing exact current main SHA, Auth SHA, expected conflict domains, and invariants. Do not include secrets.

- [ ] **Step 5: Commit documentation-only reconciliation notes**

Commit with a message such as `docs: record current Auth reconciliation baseline`.

---

### Task 2: Guardedly integrate current main into Auth

**Files:**
- Modify only files proven to conflict during merge
- Likely review: `package.json`, `pnpm-lock.yaml`, `src/shared/lib/env.ts`, `src/proxy.ts`, `wrangler.jsonc`, DB migration metadata, public/auth route boundaries
- Test: existing Auth, tenant-routing, migration, public-site, content, and runtime suites

**Interfaces:**
- Consumes: Task 1 conflict map
- Produces: an Auth branch whose first-parent Auth implementation now contains current `main` public-site production baseline without weakening either side

- [ ] **Step 1: Merge exact current main SHA into Auth branch**

Create a merge commit rather than force-moving/rebasing published history. Use exact SHA pinning so later verification can prove ancestry.

- [ ] **Step 2: Resolve conflicts by authority**

For each conflict, preserve current public-site production behavior from `main` unless it contradicts `AGENTS.md` or Auth invariants. Preserve Mkety Auth session/RBAC/provider-neutral behavior from Auth. Do not reintroduce Auth.js/NextAuth or Vercel assumptions.

- [ ] **Step 3: Reconcile migration metadata without rewriting historical SQL**

Keep existing application SQL bodies immutable where possible. Repair journal/snapshot metadata only as required so SQL order and schema snapshots match the merged TypeScript schema.

- [ ] **Step 4: Run targeted RED/GREEN regression checks**

Run exact tests for login/callback/logout/session, stale tenant membership routing, public-site route/content contracts, and migration integrity. Any regression must be fixed at root cause before broad verification.

- [ ] **Step 5: Run full internal verification**

Run frozen install, full tests, type-check, lint, migration guard, `drizzle-kit check`, forward `db:generate` no-op proof, `pnpx vinext check`, production build, and `pnpm run deploy --env preview --dry-run`.

- [ ] **Step 6: Commit verified integration**

Commit only after all internal gates pass. Record exact verified SHA and CI run IDs in the Auth handoff.

---

### Task 3: Add idempotent ZITADEL management automation

**Files:**
- Create: `.github/workflows/mkety-zitadel-preview-config.yml`
- Create: `scripts/zitadel/configure-mkety-auth.mjs`
- Create: `scripts/zitadel/lib/client.mjs`
- Create: `scripts/zitadel/lib/reconcile.mjs`
- Create: `scripts/zitadel/configure-mkety-auth.test.mjs` or repository-standard TypeScript/Jest equivalents if JS tests are not used
- Modify: `.env.example` only for non-secret configuration names if needed
- Modify: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

**Interfaces:**
- Consumes: secret management credential via one canonical GitHub Actions environment binding; non-secret issuer/base URL; preview URL input
- Produces: Mkety ZITADEL project/application identifiers, correct OIDC settings, exact preview redirect/logout URI registration, non-secret evidence summary

- [ ] **Step 1: Write failing reconciliation tests**

Test that the reconciler:
1. reuses an existing uniquely matching Mkety project/app;
2. creates missing resources once;
3. adds missing redirect/logout URIs without deleting unrelated URIs;
4. is idempotent on a second run;
5. refuses ambiguous multiple matches;
6. never includes the management token in returned evidence/log objects;
7. refuses production URI mutation unless an explicit production-authorization input is true.

- [ ] **Step 2: Run targeted tests and confirm failure**

Run the repository-standard test command for the new reconciler and confirm the functions are absent/incomplete.

- [ ] **Step 3: Implement a minimal ZITADEL API client**

Implement authenticated JSON requests with strict status handling, bounded response parsing, redacted error messages, and no request-header/body logging when secrets may be present.

- [ ] **Step 4: Implement idempotent resource discovery/reconciliation**

Use deterministic Mkety naming. Prefer existing compatible resources. Fail closed on ambiguity rather than guessing. Preserve unrelated ZITADEL projects/apps/settings.

- [ ] **Step 5: Implement OIDC application contract**

Ensure Authorization Code + PKCE-compatible application configuration, exact preview callback `<preview-url>/api/auth/callback`, exact post-logout `<preview-url>/login`, and only the scopes/settings Mkety Auth actually requires.

- [ ] **Step 6: Bind repository secret once in workflow**

At workflow top/job env, map the user-provided repository secret to a canonical process variable such as `ZITADEL_MANAGEMENT_TOKEN`. Keep the actual repository secret name isolated to that one binding. Do not expose its value.

- [ ] **Step 7: Add secret-name presence diagnostics without plaintext**

The workflow may report only whether the canonical binding is present. If the exact user-provided secret name is not yet known from repository configuration, use the documented canonical name and fail with the missing variable name only; do not attempt to enumerate or print secrets.

- [ ] **Step 8: Emit non-secret outputs**

Write project ID, application/client ID, issuer, registered redirect/logout URIs, and reconciliation action (`reused`/`created`/`updated`) to `$GITHUB_OUTPUT` / step summary. Never output client secret or management token.

- [ ] **Step 9: Run tests and static verification**

Run targeted tests, full tests, type-check/lint where applicable, and validate workflow YAML/actionlint through repository CI.

- [ ] **Step 10: Commit ZITADEL automation**

Commit with a focused message such as `feat: add idempotent ZITADEL preview reconciliation`.

---

### Task 4: Connect preview deployment to ZITADEL reconciliation

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-preview.yml`
- Modify: `.github/workflows/mkety-zitadel-preview-config.yml`
- Modify: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`
- Test: workflow/static tests and existing Auth runtime tests

**Interfaces:**
- Consumes: exact deployed `preview_url`, current ZITADEL non-secret IDs/issuer, runtime secrets
- Produces: Auth-ready preview whose registered provider URIs and application runtime URIs are exactly identical

- [ ] **Step 1: Add a machine-readable preview evidence artifact or output**

Ensure the Cloudflare preview workflow exposes the exact `preview_url` and commit SHA in a non-secret form that the ZITADEL reconciliation workflow can consume safely.

- [ ] **Step 2: Register exact preview URIs after worker URL exists**

Run ZITADEL reconciliation only after a real workers.dev URL has been captured. Never guess the workers.dev subdomain.

- [ ] **Step 3: Verify runtime/client configuration consistency**

Before Auth-ready deploy, compare the runtime `MKETY_AUTH_REDIRECT_URI` and `MKETY_AUTH_POST_LOGOUT_REDIRECT_URI` to the values reconciled in ZITADEL and fail on mismatch.

- [ ] **Step 4: Preserve current Cloudflare secret handling**

Keep bulk secret binding ephemeral; remove temporary secret JSON immediately; ensure workflow artifacts/logs cannot contain values.

- [ ] **Step 5: Run preview dry-run and workflow validation**

Verify build, vinext, and Wrangler packaging before attempting real deployment.

- [ ] **Step 6: Commit workflow integration**

Record the exact SHA to be used for the first real external run.

---

### Task 5: Perform real Cloudflare + ZITADEL preview deployment

**Files:**
- No application code changes expected unless runtime smoke finds a real defect
- Update: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md` with non-secret evidence after successful run

**Interfaces:**
- Consumes: GitHub preview environment/repository credentials, verified Auth branch SHA
- Produces: live `mkety-platform-preview` workers.dev candidate with exact ZITADEL URI registration

- [ ] **Step 1: Trigger/allow the preview workflow from the verified Auth head**

Use GitHub Actions only. Do not use local plaintext secret extraction.

- [ ] **Step 2: Confirm Cloudflare Worker bootstrap**

Record Worker name, exact workers.dev URL, commit SHA, and workflow run ID.

- [ ] **Step 3: Run ZITADEL reconciliation against that exact URL**

Confirm non-secret project/application/client identifiers and exact redirect/logout URI registration.

- [ ] **Step 4: Bind Auth runtime and redeploy exact-origin artifact**

Ensure database/auth runtime configuration is complete and redeploy with `NEXT_PUBLIC_APP_URL` equal to the exact preview origin.

- [ ] **Step 5: Run unauthenticated smoke**

Verify `/`, `/login`, `/api/auth/session`, callback route behavior without valid callback state, and protected-route redirect/fail-closed behavior.

- [ ] **Step 6: Persist non-secret evidence**

Update the handoff with run IDs and public/non-secret identifiers only.

---

### Task 6: Prove real browser authentication and authorization

**Files:**
- Add/modify browser smoke workflow/test only if repository lacks a safe existing mechanism
- Modify: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

**Interfaces:**
- Consumes: live preview Worker + configured ZITADEL app
- Produces: evidence for login → callback → Mkety session → current membership authorization → logout

- [ ] **Step 1: Verify login authorization request**

Confirm `/api/auth/login` redirects to the expected ZITADEL issuer with Authorization Code + PKCE state/nonce handling and exact redirect URI.

- [ ] **Step 2: Complete a real ZITADEL login**

Use an approved non-production test identity. Do not store user password in repository files or logs.

- [ ] **Step 3: Verify callback/session creation**

Confirm valid state/nonce/signature/issuer/audience checks complete and Mkety creates its own opaque server-side session rather than using provider token as the app session.

- [ ] **Step 4: Verify current tenant authorization**

Visit a protected tenant route and prove access comes from current DB membership/role state. Remove or invalidate test membership in a controlled test path and prove stale serialized session claims do not preserve access.

- [ ] **Step 5: Verify logout**

Confirm Mkety session revocation, cookie removal, provider logout/post-logout redirect behavior, and inability to reuse the revoked session.

- [ ] **Step 6: Record results**

Document exact run/test identity type, route outcomes, SHA, preview URL, and date without recording credentials, tokens, cookies, or private user data.

---

### Task 7: Promote Auth and establish downstream ancestry gate

**Files:**
- Modify: PR #16 metadata/body
- Modify: `docs/MKETY_DEVELOPMENT_CONTINUATION.md` if operational status changes
- Modify: Auth handoff/evidence docs

**Interfaces:**
- Consumes: complete internal + external verification evidence
- Produces: promoted Auth on `main` and an exact Auth SHA that Webhooks #15 must consume

- [ ] **Step 1: Re-run exact-head immutable verification**

Run all blocking tests/checks on the final candidate SHA after evidence-document changes if those changes affect the head.

- [ ] **Step 2: Mark PR #16 ready only if all gates pass**

No draft removal on partial evidence.

- [ ] **Step 3: Merge PR #16 with expected-head protection**

Use the repository-approved merge method and exact expected head SHA.

- [ ] **Step 4: Record promoted main SHA**

Update the continuation/handoff documents with the exact merge SHA and Auth promotion date.

- [ ] **Step 5: Reconfirm migration order on promoted main**

Run strict migration guard and Drizzle consistency once more against promoted ancestry.

- [ ] **Step 6: Gate Webhooks #15 against exact promoted Auth SHA**

Do not merge Webhooks yet. Record that its next action is reconciliation onto the promoted Auth SHA followed by fresh verification.

---

## Plan Self-Review

- Spec coverage: Auth reconciliation, ZITADEL management, isolated Cloudflare preview, Trading non-modification boundary, real browser smoke, and promotion order are all mapped to tasks.
- Placeholder scan: no implementation step relies on TBD/TODO behavior; where the exact repository secret name is unknown, the plan explicitly isolates it to one workflow binding and fails closed rather than guessing plaintext.
- Type/interface consistency: preview URL and ZITADEL non-secret IDs flow from deployment/reconciliation into runtime verification; downstream promotion consumes the exact promoted Auth SHA.
