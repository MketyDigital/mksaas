# Mkety Production DB Runtime Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a production-safe Cloudflare Worker-to-private-PostgreSQL runtime path using Hyperdrive over Cloudflare Tunnel + Access, while preserving the frozen release SHA and fail-closed cutover controls.

**Architecture:** The Worker continues to consume a single `MKETY_DB` Hyperdrive binding. Hyperdrive connects to a dedicated database hostname protected by Cloudflare Access Service Auth; that hostname routes through a dedicated outbound-only Cloudflare Tunnel into the Coolify private network and then to TLS-enabled PostgreSQL. Release migrations remain in the existing ephemeral Coolify private-network executor.

**Tech Stack:** GitHub Actions, Cloudflare Hyperdrive, Cloudflare Tunnel, Cloudflare Access, Cloudflare DNS/API, Coolify API, PostgreSQL, Postgres.js, Wrangler, Redis/R2 backup controls.

**Spec:** `docs/superpowers/specs/2026-09-13-mkety-production-db-runtime-bridge-design.md`

## Global Constraints

- Keep production PostgreSQL private; never expose port 5432 publicly.
- Keep production Redis private; never expose ports 6379/6380 publicly.
- Keep PostgreSQL TLS enabled.
- Preserve the frozen release SHA `06bc9d5526e4157f54ab17eedd5873dcabc5e497` until a deliberate recertification decision is made.
- Do not reuse or alter unrelated MKLMS Cloudflare resources.
- Do not print or commit database credentials, Cloudflare tokens, Coolify tokens, Tunnel tokens, Access client secrets, or raw secret-bearing API responses.
- Use supported Coolify and Cloudflare APIs only.
- Preserve exact-SHA/manual cutover governance and rollback.
- Production route mutation must remain blocked until private DB migration and runtime DB connectivity both pass.
- Do not use Workers VPC with certificate verification disabled as the production workaround.

---

### Task 1: Preserve application-side Hyperdrive contract

**Files:**
- Verify: `src/shared/db/runtime-connection.ts`
- Verify: `src/shared/db/runtime-connection.cloudflare.ts`
- Verify: `src/shared/db/connection-string.ts`
- Verify: `scripts/deploy-vinext-cloudflare.sh`
- Verify: `vite.config.ts`
- Verify: existing Hyperdrive/runtime tests

**Interfaces:**
- Consumes: Cloudflare Worker binding `MKETY_DB` exposing `connectionString`.
- Produces: unchanged runtime database contract for the frozen release SHA.

- [ ] **Step 1: Re-read the existing resolver and Worker binding code**

Confirm the runtime contract is still exactly `env.MKETY_DB.connectionString` with `DATABASE_URL` retained only for non-Worker execution.

- [ ] **Step 2: Re-run focused Hyperdrive tests on the frozen release SHA**

Use the existing repository test commands that exercise `production-cutover-hyperdrive.test.ts` and `production-cutover-private-db.test.ts`.

Expected: PASS with no application code changes.

- [ ] **Step 3: Reject any application-code change unless infrastructure validation proves it is necessary**

The approved architecture intentionally keeps the release SHA frozen.

### Task 2: Reconcile dedicated Cloudflare Tunnel state

**Files:**
- Create/Modify: `.github/workflows/mkety-cloudflare-tunnel-access-provision.yml`
- Reuse diagnostics only from: `.github/workflows/mkety-cloudflare-private-runtime-inventory.yml`

**Interfaces:**
- Consumes: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `COOLIFY_TOKEN`; known Mkety project/environment/server/database UUIDs.
- Produces: exactly one dedicated Mkety database Tunnel ID and a running `cloudflared` connector inside the Coolify private network.

- [ ] **Step 1: Add a discovery-only test stage**

The workflow must list Cloudflare tunnels and fail if more than one exact Mkety tunnel name matches. It must not select any resource with an MKLMS name.

- [ ] **Step 2: Verify the existing Mkety tunnel identity before reuse**

If exactly one dedicated Mkety tunnel exists and has no unrelated public-hostname route, reuse it. Otherwise fail closed instead of guessing.

- [ ] **Step 3: Create or reconcile the private Coolify `cloudflared` executor**

Run `cloudflared tunnel run --token <masked token>` in an application/service attached to the private Docker network. The connector must be persistent and outbound-only.

- [ ] **Step 4: Verify tunnel health**

Call Cloudflare's tunnel API and require a healthy/connected connector before proceeding.

### Task 3: Create the dedicated database hostname and Access protection

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-tunnel-access-provision.yml`

**Interfaces:**
- Consumes: verified dedicated Tunnel ID and the Mkety Cloudflare zone.
- Produces: one dedicated database hostname routed to the tunnel, one Access service token, one self-hosted Access application, and one Service Auth policy.

- [ ] **Step 1: Resolve the Mkety zone by exact zone name**

Use the Cloudflare API with the account ID and require exactly one matching active zone for `mkety.com`.

- [ ] **Step 2: Configure one tunnel public-hostname route for PostgreSQL**

Use a dedicated hostname such as `db-runtime.mkety.com` and route `tcp://<private-postgres-host>:5432`. Do not expose or proxy any unrelated service through this hostname.

- [ ] **Step 3: Create a dedicated Access service token**

Use a stable Mkety-only token name. Capture the client ID and one-time client secret only in process memory/files masked by GitHub Actions; never echo either value.

- [ ] **Step 4: Create a self-hosted Access application for the database hostname**

Disable interactive identity providers and configure immediate/no-session semantics appropriate for service authentication.

- [ ] **Step 5: Create a Service Auth policy**

The policy must include only the dedicated service token and protect only the database hostname.

- [ ] **Step 6: Verify unauthenticated access is denied**

A plain external connection attempt to the protected hostname must not produce an unauthenticated database session.

### Task 4: Create Mkety-only Hyperdrive through Tunnel + Access

**Files:**
- Modify: `.github/workflows/mkety-cloudflare-tunnel-access-provision.yml`
- Verify: `scripts/deploy-vinext-cloudflare.sh`

**Interfaces:**
- Consumes: dedicated database hostname, database credentials, Access client ID/secret.
- Produces: exactly one Hyperdrive configuration named `mkety-production-db`.

- [ ] **Step 1: Discover exact-name Hyperdrive state**

List Hyperdrive configurations and require zero or one exact match for `mkety-production-db`. Never select `mklms-*` configurations.

- [ ] **Step 2: Create the Hyperdrive configuration when absent**

Create a PostgreSQL origin with the dedicated tunnel hostname, database name, database user/password, `access_client_id`, and `access_client_secret`. Omit the origin port as required for Cloudflare Tunnel + Access private database routing.

- [ ] **Step 3: Verify the created configuration**

Require one exact-name result and validate that the origin is Access-protected and points to the dedicated database hostname.

- [ ] **Step 4: Record only the Hyperdrive ID as non-secret workflow evidence**

Do not print returned credentials or write-only secrets.

### Task 5: Prove database connectivity from an isolated Worker candidate

**Files:**
- Modify only diagnostics/cutover workflow code if required; do not change frozen application source.

**Interfaces:**
- Consumes: frozen release SHA and Mkety Hyperdrive ID.
- Produces: successful DB-backed Worker preview evidence before any apex/www route mutation.

- [ ] **Step 1: Build the Worker from exact SHA `06bc9d5526e4157f54ab17eedd5873dcabc5e497`**

Use the existing exact-SHA candidate build path.

- [ ] **Step 2: Deploy without custom production routes**

Bind `MKETY_DB` to the new Hyperdrive configuration. Do not bind `mkety.com/*` or `www.mkety.com/*` yet.

- [ ] **Step 3: Execute the existing DB-backed candidate smoke**

Require a real database-backed endpoint response rather than a static health response.

Expected: PASS through Worker -> Hyperdrive -> Access -> Tunnel -> private PostgreSQL.

- [ ] **Step 4: Fail closed on any database/runtime error**

Do not proceed to production routing on DNS, Access, Tunnel, TLS, authentication, SQL, or binding failure.

### Task 6: Close Redis backup launch gate

**Files:**
- Verify/Modify: `.github/workflows/mkety-redis-backup-proof-v2.yml`
- Verify: `ops/redis-backup/Dockerfile`
- Verify: `ops/redis-backup/run.sh`

**Interfaces:**
- Consumes: private Redis URL and existing R2 credentials/bucket.
- Produces: fresh independently verified `redis/mkety-redis/...rdb` object evidence.

- [ ] **Step 1: Inspect the current Redis backup proof V2 run**

If it failed, use only the sanitized `MKETY_REDIS_*` diagnostics to identify the actual cause.

- [ ] **Step 2: Fix only the demonstrated failure**

Do not expose Redis publicly and do not weaken authentication.

- [ ] **Step 3: Re-run the proof**

Require markers:

```text
MKETY_REDIS_BACKUP_STAGE_OK=snapshot
MKETY_REDIS_BACKUP_STAGE_OK=upload
MKETY_REDIS_BACKUP_STAGE_OK=verify
MKETY_REDIS_BACKUP_OK=true
```

- [ ] **Step 4: Independently verify the new R2 object**

Require non-zero size and launch-acceptable freshness under the dedicated Redis prefix.

### Task 7: Revalidate production prerequisites

**Files:**
- Verify existing production protection/preflight workflows.

**Interfaces:**
- Consumes: production PostgreSQL/Coolify/R2/Cloudflare state.
- Produces: current go/no-go evidence for cutover.

- [ ] **Step 1: Verify PostgreSQL remains `running:healthy`, private, and TLS-enabled**

- [ ] **Step 2: Verify the latest scheduled PostgreSQL backup succeeded and was uploaded off-host**

- [ ] **Step 3: Independently verify R2 backup freshness without logging credentials**

Normalize `R2_S3_API` to the URL origin before passing the bucket separately.

- [ ] **Step 4: Verify dedicated Tunnel, Access application/policy, and Hyperdrive state**

Require one Mkety-only resource chain with no MKLMS mutation.

### Task 8: Guarded exact-SHA production cutover

**Files:**
- Use: `.github/workflows/mkety-public-production-cutover.yml`

**Interfaces:**
- Consumes: certified frozen SHA, successful private migration executor, successful isolated Worker DB smoke, Redis backup evidence.
- Produces: production apex/www routing only after all gates pass.

- [ ] **Step 1: Reverify all ten exact-SHA certification workflows**

Require successful evidence for the frozen SHA.

- [ ] **Step 2: Run the existing private production DB migration/seed/smoke executor**

Require all stage markers before continuing.

- [ ] **Step 3: Run the cutover workflow with exact confirmation**

Inputs:

```text
verified_sha=06bc9d5526e4157f54ab17eedd5873dcabc5e497
confirmation=CUTOVER MKETY PUBLIC
```

- [ ] **Step 4: Require routing snapshot and rollback evidence before mutation**

- [ ] **Step 5: Bind only `mkety.com/*` and `www.mkety.com/*` after the DB-backed candidate smoke is green**

- [ ] **Step 6: Independently verify both apex and www after cutover**

Do not declare production live until both succeed independently.

### Task 9: Verification and cleanup

**Files:**
- Diagnostics branch only for temporary proof workflows.
- Release branch remains frozen unless a later deliberate recertification change is approved.

**Interfaces:**
- Produces: auditable final evidence and removal/retention decision for temporary diagnostics.

- [ ] **Step 1: Verify no production database or Redis public port exists**

- [ ] **Step 2: Verify no secret was committed or printed in stored workflow output**

- [ ] **Step 3: Verify unrelated MKLMS Cloudflare resources are byte-for-byte/configuration-equivalent to their pre-change inventory where observable**

- [ ] **Step 4: Retain only durable operational controls; remove throwaway diagnostic workflows in a separate cleanup change after launch**

- [ ] **Step 5: Record final run IDs and exact production SHA in release evidence**
