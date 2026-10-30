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
- Produces: `HostnameKind = 'preview' | 'production'`; `ResolvedDeployment = { deploymentId: string; tenantId: string; providerDeploymentRef: string; kind: HostnameKind; status: 'active' }`; `DeploymentHostnameRepository.findActiveByHostname(hostname: string): Promise<ResolvedDeployment | null>`; and `normalizeMketyAppHostname(hostname: string): string | null`, `createMketyAppHostname(projectSlug: string, stableId: string): string`, `resolveMketyAppHostname(hostname: string, repository: DeploymentHostnameRepository): Promise<ResolvedDeployment | null>`.

- [x] **Step 1: Test** normalization, lowercase/IDNA rejection or normalization, single-label requirement, reserved labels, collision suffix, and rejection of `mkety.app` as a customer allocation.
- [x] **Step 2: Run** `pnpm exec jest src/features/deploy/hostnames.test.ts --runInBand`; confirm the missing contract fails.
- [x] **Step 3: Implement** a collision-safe hostname format `<project-slug>-<stable-short-id>.mkety.app` and enforce the reserved-label list from the spec.

### Task 2: Persist deployment hostname ownership

**Files:**
- Create: `src/shared/db/schema/deployment-hostnames.ts`
- Modify: `src/shared/db/schema/index.ts`
- Create: `src/shared/db/migrations/0045_deployment_hostnames.sql`
- Modify: `src/shared/db/migrations/meta/_journal.json`
- Create: `src/shared/db/migrations/meta/0045_snapshot.json`
- Modify: `src/shared/db/schema/deployments.test.ts`

**Interfaces:**
- Produces: tenant/project/application/environment/deployment-bound hostname rows with `pending`, `active`, `suspended`, and `expired` lifecycle.

- [x] **Step 1: Write schema/migration tests** for unique hostname, deployment ownership, allowed lifecycle, and exact tenant/application/environment consistency.
- [x] **Step 2: Add the additive migration and Drizzle table**; do not rewrite existing domain records or customer data.
- [x] **Step 3: Run** `pnpm exec jest src/shared/db/migrations/0045_deployment_hostnames.test.ts --runInBand` and `node --import tsx scripts/check-migration-baseline.ts`.

### Task 3: Build the isolated customer dispatch Worker

**Files:**
- Create: `workers/mkety-app-router/src/index.ts`
- Create: `workers/mkety-app-router/src/index.test.ts`
- Create: `workers/mkety-app-router/wrangler.jsonc`
- Create: `src/features/deploy/server/providers/cloudflare-dispatch.ts`
- Create: `src/features/deploy/server/providers/cloudflare-dispatch.test.ts`
- Create: `src/features/deploy/server/providers/customer-deployment-runtime.ts`
- Create: `src/features/deploy/server/providers/customer-deployment-artifact.ts`
- Create: `src/features/deploy/server/providers/customer-deployment-artifact.test.ts`
- Create: `src/features/deploy/server/providers/customer-deployment-artifacts-store.ts`
- Create: `src/features/deploy/server/providers/cloudflare-dispatch.ts`
- Create: `src/features/deploy/server/providers/cloudflare-dispatch-api.ts`

**Interfaces:**
- Consumes: hostname resolution contract from Task 1 and records from Task 2.
- Produces: `fetch(request, env)` that serves apex service content or dispatches an active hostname to an allow-listed deployment in the Mkety Workers for Platforms namespace. `CloudflareDispatchAdapter implements DeploymentProviderAdapter`; `CustomerDeploymentArtifactSource.load(context): Promise<CloudflareCandidateArtifact>` loads only an immutable tenant-owned bundle from the authorized artifact store. The namespace name is server-only configuration.

- [x] **Step 1: Test** bounded artifact size/module/path validation and dispatch namespace/API behavior; router tests cover apex response, active dispatch, unknown/suspended rejection, request preservation, and safe script-name handling.
- [x] **Step 2: Implement** bounded JSON module-manifest intake into the tenant/project/request-scoped artifact store with persisted SHA-256 integrity evidence, plus a separate Workers for Platforms adapter. The original proof-only candidate adapter remains unchanged.
- [x] **Step 3: Validate** namespace/account/script identifiers and verify the configured dispatch namespace exists before customer Worker upload. Missing configuration or namespace fails closed.
- [x] **Step 4: Run** focused Worker/provider tests and Wrangler dry-run against the current branch state. Six suites / 27 tests pass; Wrangler accepts `workers/mkety-app-router/wrangler.jsonc` with the `mkety-customer-apps` dispatch binding in `--dry-run` mode. No live Worker, route, or DNS was changed.

### Task 4: Connect Deploy requests to previews and promotion

**Files:**
- Modify: `src/features/deploy/actions.ts`
- Modify: `src/features/deploy/request-actions.ts`
- Modify: `src/features/deploy/server/execution/service.ts`
- Modify: `src/features/deploy/components/DeployFoundationPanel.tsx`
- Modify: `src/features/deploy/components/DeploymentApprovalQueue.tsx`
- Modify: `src/features/deploy/server/execution/service.test.ts`
- Modify: `src/features/deploy/server/providers/customer-candidate-runtime.ts` only to keep candidate execution isolated; do not route production through it.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: a customer-visible preview URL only after a successful isolated deployment; a stable production alias changes only through the existing approved deployment flow.

- [x] **Step 1: Trace and test the current candidate-only flow**; customer artifact execution and proof-worker execution remain separate, and direct protected execution stays blocked.
- [x] **Step 2: Implement the customer artifact source** as a bounded authenticated Deploy upload stored under tenant/project/request scope, with validated modules and a SHA-256 check at deployment time.
- [x] **Step 3: Add a distinct provider path** for non-production customer previews; proof Workers remain a separate workflow. Production changes use only the approved alias transition.
- [x] **Step 4: Bind preview hostname to the completed immutable deployment** and show the URL only after the host row is active.
- [x] **Step 5: Implement production alias promotion** as a manager-requested, Platform Control-approved and audited state transition; old completed versions and preview hosts remain available for rollback. Local tests cover tenant/app/environment ownership, active preview, stale/inactive alias rejection, and rollback targets.
- [ ] **Step 6: Test** cross-tenant isolation, build failure cleanup, stale mapping revocation, preview immutability, and rollback target restoration.

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
