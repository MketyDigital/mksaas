# Mkety.app Customer Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make `mkety.app` the Mkety-controlled base hostname for customer applications and previews, with safe single-label deployment URLs under `*.mkety.app`.

**Architecture:** Keep the authenticated Platform Worker separate from customer code. Use a dedicated Cloudflare Workers for Platforms dispatch namespace plus a hostname-aware dispatch Worker, backed by tenant-owned deployment hostname records. The apex serves the Mkety Apps service response; wildcard hostnames dispatch only to their verified deployment.

**Tech Stack:** Cloudflare Workers for Platforms, Workers/Worker Routes, PostgreSQL + Drizzle, GitHub Actions, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md`

## Global Constraints

- `app.mkety.com` remains the authenticated Platform and is never the customer-code runtime.
- `mkety.app` is the platform base endpoint; customer previews/deployments use collision-safe single-label `*.mkety.app` hostnames.
- Unknown, suspended, expired, or cross-tenant host mappings fail closed and never fall back to another customer.
- Customer Workers stay isolated in a Workers for Platforms dispatch namespace.
- Production DNS, wildcard routing, and TLS are attached only after isolated validation and rollback preparation.
- No generic public-site cutover workflow is used for customer host setup.

## Review Focus

- Unknown host or DNS wildcard collision — return the branded apex or a safe not-found response.
- Stale deployment mapping — serve no old customer code after suspension/deletion.
- Cross-tenant hostname collision — database uniqueness and ownership tests reject it.
- Unsafe Worker dispatch identifier — allow only identifiers created by Mkety, never a request-controlled script name.
- Missing Workers for Platforms access/namespace — deployment authorization fails closed without changing DNS.

---

### Task 1: Define and test the hostname contract

**Files:**
- Create: `src/features/deploy/hostnames.ts`
- Create: `src/features/deploy/hostnames.test.ts`

**Interfaces:**
- Produces: `normalizeMketyAppHostname(hostname: string): string | null`, `createMketyAppHostname(projectSlug: string, stableId: string): string`, and `resolveMketyAppHostname(input, repository): Promise<ResolvedDeployment | null>`.

- [ ] **Step 1: Test** normalization, lowercase/IDNA rejection or normalization, single-label requirement, reserved labels, collision suffix, and rejection of `mkety.app` as a customer allocation.
- [ ] **Step 2: Run** `pnpm exec jest src/features/deploy/hostnames.test.ts --runInBand`; confirm the missing contract fails.
- [ ] **Step 3: Implement** a collision-safe hostname format `<project-slug>-<stable-short-id>.mkety.app` and enforce the reserved-label list from the spec.

### Task 2: Persist deployment hostname ownership

**Files:**
- Create: `src/shared/db/schema/deployment-hostnames.ts`
- Modify: `src/shared/db/schema/index.ts`
- Create: `src/shared/db/migrations/0044_deployment_hostnames.sql`
- Create: `src/shared/db/migrations/meta/0044_snapshot.json`
- Modify: `src/shared/db/schema/deployments.test.ts`

**Interfaces:**
- Produces: tenant/project/application/environment/deployment-bound hostname rows with `pending`, `active`, `suspended`, and `expired` lifecycle.

- [ ] **Step 1: Write schema/migration tests** for unique hostname, deployment ownership, allowed lifecycle, and exact tenant/application/environment consistency.
- [ ] **Step 2: Add the additive migration and Drizzle table**; do not rewrite existing domain records or customer data.
- [ ] **Step 3: Run** `pnpm exec jest src/shared/db/schema/deployments.test.ts --runInBand` and `pnpm db:check:migrations`.

### Task 3: Build the isolated customer dispatch Worker

**Files:**
- Create: `workers/mkety-app-router/src/index.ts`
- Create: `workers/mkety-app-router/src/index.test.ts`
- Create: `workers/mkety-app-router/wrangler.jsonc`
- Modify: `src/features/deploy/server/providers/cloudflare-candidate.ts` only if the existing candidate boundary needs a shared safe dispatch-name validator.

**Interfaces:**
- Consumes: hostname resolution contract from Task 1 and records from Task 2.
- Produces: `fetch(request, env)` that serves apex service content or dispatches an active hostname to an allow-listed deployment in the Mkety namespace.

- [ ] **Step 1: Test** apex response, active deployment dispatch, unknown/suspended host rejection, path/query preservation, wrong Host header, and no request-selected namespace/script id.
- [ ] **Step 2: Implement** a dedicated dynamic-dispatch Worker and a namespaced deployment lookup; never route customer traffic through `mkety-app-host`.
- [ ] **Step 3: Run** focused Worker tests and Wrangler dry-run.

### Task 4: Connect Deploy requests to previews and promotion

**Files:**
- Modify: `src/features/deploy/actions.ts`
- Modify: `src/features/deploy/request-actions.ts`
- Modify: `src/features/deploy/server/execution/service.ts`
- Modify: `src/features/deploy/server/providers/customer-candidate-artifact.ts`
- Modify: `src/features/deploy/components/DeployFoundationPanel.tsx`
- Modify: `src/features/deploy/components/DeploymentApprovalQueue.tsx`
- Create: `src/features/deploy/server/hostnames.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a customer-visible preview URL only after a successful isolated deployment; a stable production alias changes only through the existing approved deployment flow.

- [ ] **Step 1: Trace and test the current candidate-only flow**; do not label the existing proof Worker as a customer application.
- [ ] **Step 2: Implement the customer artifact source** using an explicit immutable build-artifact contract. Reject arbitrary URLs, unbounded bundles, invalid modules, and missing application identity.
- [ ] **Step 3: Bind preview hostname to the completed immutable deployment** and show the URL in Deploy UI only after the host record is active.
- [ ] **Step 4: Implement production alias promotion** as a tenant-authorized, audited state transition; old versions remain available for rollback.
- [ ] **Step 5: Test** cross-tenant isolation, build failure cleanup, stale mapping revocation, preview immutability, and rollback target restoration.

### Task 5: Provision and verify the domain endpoint

**Files:**
- Create: `docs/MKETY_APP_DOMAIN_RUNBOOK.md`
- Modify: `docs/MKETY_DOMAIN_ARCHITECTURE.md`
- Create: `.github/workflows/mkety-app-domain-readiness.yml` only if a read-only diagnostic workflow is needed.

- [ ] **Step 1: Verify read-only** that `mkety.app` zone, Workers for Platforms access, dispatch namespace, apex routing, wildcard DNS, certificates, and existing Worker Routes are understood.
- [ ] **Step 2: Configure isolated staging hostnames** and run an external smoke for apex, wildcard dispatch, invalid host, HTTPS, and customer isolation.
- [ ] **Step 3: Prepare exact rollback evidence** for the apex custom domain and wildcard DNS/Worker Route before production attachment.
- [ ] **Step 4: Attach apex and wildcard routing** to the new customer dispatch Worker, preserve unrelated routing/DNS, and verify the before/after set.
- [ ] **Step 5: Mark `mkety.app` customer hosting operational only after real customer build, preview, promotion, TLS, isolation, and rollback checks pass.**
