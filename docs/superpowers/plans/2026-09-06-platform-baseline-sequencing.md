# Mkety Platform Baseline Sequencing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one clean Mkety baseline by finishing Auth, enabling continuous Cloudflare frontend preview, reconciling runtime/migrations, securing Webhooks, cleansing stale architecture, and only then resuming major Platform expansion.

**Architecture:** Treat Auth, preview deployment, migrations/runtime, Webhooks, and cleanup as sequential gates rather than parallel feature tracks. Main becomes the single clean baseline; feature work branches only after each gate is verified and promoted. Provider-specific auth and transitional deployment adapters remain isolated behind Mkety-owned interfaces.

**Tech Stack:** Next.js/React/TypeScript, pnpm, Drizzle/PostgreSQL, Cloudflare Workers, OpenNext transitional tooling where still required, vinext target validation, ZITADEL OIDC, Vitest, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-platform-baseline-sequencing-design.md`

## Global Constraints

- No new major Platform feature branches until the baseline is complete.
- Mkety owns the auth/session/authorization boundary; ZITADEL remains replaceable.
- Preview is non-production and must not silently promote production.
- No duplicate migration sequence numbers or competing migration truths.
- Security tests may not be weakened to make CI green.
- Legacy template/auth/runtime documentation that conflicts with current architecture must be removed, migrated, or explicitly archived.
- Main must be green before new major Platform expansion resumes.

---

### Task 1: Publish the sequencing rule as repository guidance

**Files:**

- Modify: `AGENTS.md`
- Reference: `docs/superpowers/specs/2026-09-06-platform-baseline-sequencing-design.md`

**Interfaces:**

- Consumes: existing `AGENTS.md` architectural authority.
- Produces: a short `Current Execution Gate` section that future agents cannot miss.

- [ ] **Step 1: Add a concise current execution gate to `AGENTS.md`**

Add wording that preserves the master blueprint but states the temporary sequencing rule: freeze major new feature work; finish Auth; establish preview + migration/runtime baseline; rebase/secure Webhooks; cleanse stale work; then resume Platform expansion.

- [ ] **Step 2: Link the approved design**

Reference `docs/superpowers/specs/2026-09-06-platform-baseline-sequencing-design.md` rather than duplicating all detail.

- [ ] **Step 3: Review for contradiction**

Verify the added section does not redefine Mkety Platform, Academy, Trading, mklms, or the protected legacy `mkety` repository rules.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md docs/superpowers/specs/2026-09-06-platform-baseline-sequencing-design.md docs/superpowers/plans/2026-09-06-platform-baseline-sequencing.md
git commit -m "docs: establish platform baseline execution gate"
```

### Task 2: Finish and verify Mkety Auth PR #16

**Files:**

- Modify as required in: `src/shared/lib/auth*`, auth route handlers, auth repository/service/provider modules, `src/shared/db/schema/mkety-auth.ts`, `src/shared/db/migrations/0009_mkety_auth.sql`, auth tests, `.env.example`
- Remove/replace: active Auth.js/NextAuth/Auth0 application paths
- Update: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

**Interfaces:**

- Consumes: Mkety users, external identities, memberships, roles/permissions, OIDC provider adapter.
- Produces: provider-neutral Mkety session and authorization API for all Platform routes.

- [ ] **Step 1: Inventory legacy auth references on the branch**

Run repository searches for `next-auth`, `NextAuth`, `AUTH0`, `Auth0`, `NEXTAUTH`, and direct ZITADEL imports outside the provider boundary.

Expected: only deliberate historical docs/adapter references remain; application code consumes Mkety Auth.

- [ ] **Step 2: Add/confirm RBAC regression tests**

Write tests proving a session with stale role information cannot override the current `tenant_memberships` record and that removed membership fails closed.

- [ ] **Step 3: Run those tests red before implementation changes**

```bash
pnpm test -- --runInBand <auth-rbac-test-path>
```

Expected: any missing invariant fails before repair.

- [ ] **Step 4: Implement the minimum membership-authority repair**

Ensure role/permission checks read authoritative membership data rather than trusting serialized session role claims.

- [ ] **Step 5: Verify OIDC/session security tests**

Cover PKCE/state, issuer, audience, signature validation, opaque session hashing, logout revocation, cookie clearing, and secret-safe logging behavior.

- [ ] **Step 6: Run full Auth branch checks**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Expected: all green.

- [ ] **Step 7: Run vinext compatibility check**

Run the repository's pinned/approved `vinext check` command and record findings in the handoff. Any accepted incompatibility must be explicit; silent failures are not acceptable.

- [ ] **Step 8: Clean temporary Auth artifacts**

Remove temporary lockfile workflow/log artifacts once no longer needed, including `_auth-lockfile-artifact.yml` and `lockfile-refresh.log` if they have served their purpose.

- [ ] **Step 9: Update PR #16 handoff/body**

Replace the stale RED-phase wording with the actual implementation state, exact remaining blockers, final SHA, CI evidence, and preview-smoke checklist.

- [ ] **Step 10: Commit Auth completion changes**

```bash
git add -A
git commit -m "feat: complete Mkety auth baseline"
```

### Task 3: Make the frontend continuously deployable to Cloudflare preview

**Files:**

- Modify/create as required: `wrangler.toml`/`wrangler.jsonc`, OpenNext/vinext config, package scripts, GitHub Actions preview workflow, deployment docs
- Update: `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`

**Interfaces:**

- Consumes: green application build and Mkety Auth configuration.
- Produces: repeatable non-production Worker preview URL for public and authenticated frontend testing.

- [ ] **Step 1: Define the preview contract in tests/config validation**

Require a non-production Worker name/hostname, explicit environment separation, and build-before-deploy behavior.

- [ ] **Step 2: Run build/package validation before changing deploy config**

```bash
pnpm type-check
pnpm build
```

- [ ] **Step 3: Establish one preview command**

Expose one documented package script/workflow entry that builds the Cloudflare artifact and deploys only to the preview Worker/environment.

- [ ] **Step 4: Add CI deployment gate**

Preview deployment must depend on tests, type-check, lint, build, and Auth readiness checks. Production deployment must remain separate/manual or separately protected.

- [ ] **Step 5: Smoke the public frontend**

Verify homepage, docs, sign-in entry, and representative public CMS-driven pages render on preview.

- [ ] **Step 6: Smoke authenticated frontend**

Verify login, callback, session, protected route, tenant authorization, and logout on the exact preview hostname registered in ZITADEL.

- [ ] **Step 7: Record preview evidence**

Update the handoff with Worker name, preview URL, commit SHA, redirect URIs, and smoke results.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "ci: establish Cloudflare frontend preview baseline"
```

### Task 4: Establish one migration and runtime baseline

**Files:**

- Inspect/modify: `src/shared/db/migrations/*`, root `migrations/*`, Drizzle config, migration scripts, Cloudflare runtime configs, deployment docs
- Create: migration-order regression/check script if none exists

**Interfaces:**

- Consumes: merged Auth migration and existing CMS/content migration mechanisms.
- Produces: unique deterministic migration history and explicit current-vs-target runtime contract.

- [ ] **Step 1: Enumerate every migration in execution order**

Produce a single ordered list covering Drizzle migrations and root Mkety content bootstrap SQL, with the exact commands that apply each set.

- [ ] **Step 2: Add a failing duplicate-sequence check**

Create a test/script that exits non-zero when two active migrations share the same numeric prefix.

- [ ] **Step 3: Run it against the pre-reconciled state**

Expected: fail while Auth/Webhook both claim `0009` in active integration branches.

- [ ] **Step 4: Reconcile numbering**

Keep the merged Auth migration at its settled sequence and assign Webhooks the next valid number during its rebase.

- [ ] **Step 5: Reconcile CMS bootstrap instructions**

Make documentation/scripts unambiguous about `pnpm db:migrate`, `pnpm db:migrate:mkety-content`, generation/reconciliation, seed, and smoke responsibilities.

- [ ] **Step 6: Document runtime ownership**

State exactly whether OpenNext is transitional and vinext target, including the condition for removing OpenNext. Do not describe both as equal permanent paths.

- [ ] **Step 7: Add migration/runtime checks to CI**

Ensure duplicate sequencing or missing required migration bootstrap validation fails CI.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: establish migration and runtime baseline"
```

### Task 5: Rebase and secure Automation Webhooks PR #15

**Files:**

- Rebase/modify: webhook branch
- Renumber: `src/shared/db/migrations/0009_automation_webhook_trigger.sql` to the next valid migration sequence
- Modify/test: `webhook-secret-crypto.ts`, `webhook-secret-crypto.test.ts`, webhook ingress/security/execution modules as needed

**Interfaces:**

- Consumes: clean post-Auth migration/runtime baseline and shared workflow execution service.
- Produces: secure webhook ingress with persisted endpoints/deliveries and shared execution semantics.

- [ ] **Step 1: Rebase PR #15 onto the clean baseline**

Resolve conflicts by preserving current Auth/runtime/migration source of truth rather than reviving stale branch behavior.

- [ ] **Step 2: Renumber webhook migration**

Use the next valid unique sequence and update any journal/snapshot references required by the repository's migration system.

- [ ] **Step 3: Reproduce the ciphertext tamper failure**

```bash
pnpm test -- src/features/projects/workspaces/automation/webhook-secret-crypto.test.ts
```

Expected before fix: tampered ciphertext is accepted or fails to throw the required decryption error.

- [ ] **Step 4: Fix tamper detection cryptographically**

Use authenticated encryption/integrity verification already intended by the module design. Do not change the test merely to accept corrupted ciphertext.

- [ ] **Step 5: Add negative cases**

Cover ciphertext mutation, IV/nonce mutation, authentication-tag mutation where applicable, malformed payload encoding, and wrong key material.

- [ ] **Step 6: Verify webhook ingress invariants**

Test endpoint-ID/secret separation, HMAC-SHA256 request auth, duplicate delivery/idempotency behavior, trigger truth enforcement, and shared execution-service use.

- [ ] **Step 7: Run full branch checks**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

Expected: all green, including Platform workspace smoke.

- [ ] **Step 8: Update PR #15 body**

Document rebase SHA, migration number, security fix, test counts, and any preview UI verification.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: secure automation webhook baseline"
```

### Task 6: Deep repository cleansing

**Files:**

- Search/modify/remove across docs, workflows, package configuration, auth/setup guides, and stale template surfaces
- Update authoritative docs as necessary

**Interfaces:**

- Consumes: clean Auth/Webhook/runtime baseline.
- Produces: repository where current documentation and code do not point future engineers/agents toward obsolete architecture.

- [ ] **Step 1: Run legacy-term inventory**

Search for: `Next.js SaaS AI Template`, `Auth0`, `NEXTAUTH`, `NextAuth`, obsolete deployment instructions, obsolete migration commands, and template brand names.

- [ ] **Step 2: Classify each hit**

For every hit choose one: current/valid, migrate, delete, or explicitly historical/archive. Do not leave ambiguous setup instructions.

- [ ] **Step 3: Remove temporary workflows/artifacts**

Delete diagnostics and one-off bootstrap files that are no longer part of the supported developer path.

- [ ] **Step 4: Preserve useful stale-PR architecture before closure**

Carry PR #3's managed-hosting billing decision into an authoritative billing architecture note; confirm PR #4's DB-backed membership invariant is in Auth tests; confirm PR #1 has no unique behavior worth preserving.

- [ ] **Step 5: Close superseded PRs**

Close PR #1, #4, and #3 with concise comments/body state explaining where their valid intent now lives.

- [ ] **Step 6: Run full repository checks**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
pnpm db:smoke:mkety-content
```

Run any additional Platform workspace smoke workflows required by current CI.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: cleanse legacy platform architecture"
```

### Task 7: Baseline verification and handoff

**Files:**

- Update: approved handoff/status docs
- No product feature additions

**Interfaces:**

- Consumes: Tasks 1-6.
- Produces: one promotion-ready baseline and explicit next Platform milestone.

- [ ] **Step 1: Verify main/target branch health**

Record final SHAs and all required GitHub Actions run results.

- [ ] **Step 2: Verify deployed preview**

Record the exact Cloudflare preview URL and verify representative public + authenticated frontend paths.

- [ ] **Step 3: Verify migration reproducibility**

Run the documented migration/bootstrap path against a clean test database/environment and record results.

- [ ] **Step 4: Verify repository cleansing**

Repeat legacy-term searches and ensure any remaining matches are deliberately historical or provider-adapter-local.

- [ ] **Step 5: Publish next-action handoff**

Declare the baseline complete only if all gates are satisfied, then identify Billing → Entitlements → Usage/Credits as the recommended next shared Platform expansion milestone.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: hand off clean Mkety platform baseline"
```
