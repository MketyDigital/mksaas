# Mkety Entitlements Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend-authoritative, versioned entitlement system layered above Billing with tenant overrides and deny-by-default resolution.

**Architecture:** Entitlements attach to immutable Billing plan versions, while exceptional tenant grants/denies live in a separate override table. A focused server resolver calculates effective access and exposes `hasEntitlement` / `requireEntitlement`; Usage/Credits remains a separate subsystem.

**Tech Stack:** TypeScript 5.9, Drizzle ORM/PostgreSQL, Jest, Next.js/vinext, Cloudflare.

**Spec:** `docs/superpowers/specs/2026-09-07-mkety-entitlements-core-design.md`

## Global Constraints

- Preserve verified Billing application behavior; branch is stacked on Billing head `4525104661208d669719e00766b15bc7b187f1d7`.
- Backend authorization is authoritative; frontend plan checks are never security controls.
- Entitlements use stable capability keys, never commercial plan names/slugs.
- Entitlements attach to `billing_plan_versions`.
- Tenant override precedence is active deny -> active grant -> enabled plan-version grant -> deny.
- Expired overrides do not participate.
- Unknown capabilities fail closed.
- Cross-tenant leakage is forbidden.
- Usage/Credits, Wallet and quota accounting are out of scope.
- Selar/NOWPayments behavior is out of scope.
- Keep Auth -> Webhooks -> Billing promotion order unchanged.

---

### Task 1: Persist entitlement assignments and tenant overrides

**Files:**
- Create: `src/shared/db/schema/billing-plan-version-entitlements.ts`
- Create: `src/shared/db/schema/tenant-entitlement-overrides.ts`
- Modify: the existing schema export/barrel file that exports Billing schemas
- Create: the next deterministic Drizzle SQL migration and matching migration metadata
- Test: add/extend schema tests if repository conventions include them

**Interfaces:**
- Produces `billingPlanVersionEntitlements` keyed by `(planVersionId, entitlementKey)` with `enabled`.
- Produces `tenantEntitlementOverrides` with `tenantId`, `entitlementKey`, `effect`, `reason`, `source`, `expiresAt`, `createdBy`, timestamps.

- [ ] **Step 1: Write schema-focused failing tests/checks**

Assert the two tables export expected columns, plan-version key uniqueness is defined, override effect is constrained to grant/deny, and tenant/entitlement lookup indexes exist.

- [ ] **Step 2: Run the targeted test/check and verify failure**

Run the narrow Jest/schema target used by current Billing schema tests; expected failure is missing exports/tables.

- [ ] **Step 3: Implement minimal Drizzle schema**

Use existing `appSchema`, UUID foreign keys, timestamps, `billingPlanVersions`, `tenants`, and existing user/actor reference conventions where appropriate. Keep entitlement keys as bounded strings; do not introduce a mutable plan-name dependency.

- [ ] **Step 4: Generate/write deterministic migration**

Create only the two new tables, indexes/constraints and foreign keys required by this task. Do not alter existing Billing tables.

- [ ] **Step 5: Run targeted tests plus migration baseline check**

Run the targeted schema tests and `pnpm db:check:migrations`; expected PASS.

- [ ] **Step 6: Commit**

Commit message: `feat: add entitlement persistence model`

---

### Task 2: Add stable entitlement vocabulary and resolver domain types

**Files:**
- Create: `src/features/entitlements/entitlement-keys.ts`
- Create: `src/features/entitlements/types.ts`
- Test: `src/features/entitlements/entitlement-keys.test.ts`

**Interfaces:**
- Produces `ENTITLEMENT_KEYS` and `EntitlementKey`.
- Produces input/result/error types consumed by resolver helpers.

- [ ] **Step 1: Write failing vocabulary tests**

Verify known keys include the current workspace seam `workspace.trading.enterprise`, duplicates are impossible in exported canonical values, and unrecognized runtime strings are not treated as registered keys.

- [ ] **Step 2: Run test and verify failure**

Run `pnpm test -- src/features/entitlements/entitlement-keys.test.ts`; expected FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal vocabulary/types**

Define canonical stable keys without embedding Billing plan names. Keep runtime validation focused and dependency-light.

- [ ] **Step 4: Run targeted test**

Expected PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: define stable entitlement keys`

---

### Task 3: Implement deterministic effective entitlement resolution

**Files:**
- Create: `src/features/entitlements/server/resolver.ts`
- Create: `src/features/entitlements/server/resolver.test.ts`
- Modify only existing Billing query exports if a read-only subscription lookup cannot otherwise be reused cleanly

**Interfaces:**
- Produces `getTenantEntitlements(tenantId, options?)`.
- Produces `hasEntitlement({ tenantId, entitlement, now? })`.
- Reads current tenant subscription `planVersionId`, plan-version entitlement rows and tenant overrides.

- [ ] **Step 1: Write failing resolver tests**

Cover exactly: plan grant allow; missing grant deny; tenant grant allow; tenant deny beats plan; expired override ignored; tenant A rows never affect tenant B; unknown key deny; no qualifying subscription deny unless active grant; different plan versions resolve independently.

- [ ] **Step 2: Run targeted resolver test and verify failure**

Run `pnpm test -- src/features/entitlements/server/resolver.test.ts`; expected FAIL because resolver is missing.

- [ ] **Step 3: Implement minimal resolver**

Perform tenant-scoped reads only. Apply precedence `deny > grant > plan > deny`. Treat missing/invalid/unknown capabilities as denied. Do not mutate Billing data.

- [ ] **Step 4: Run targeted resolver tests**

Expected PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: resolve effective tenant entitlements`

---

### Task 4: Add authoritative enforcement helper

**Files:**
- Create: `src/features/entitlements/server/authorization.ts`
- Create: `src/features/entitlements/server/authorization.test.ts`
- Export through the feature's server/public barrel according to repository conventions

**Interfaces:**
- Produces `requireEntitlement({ tenantId, entitlement, now? })`.
- Reuses `hasEntitlement` and throws/returns the repository-standard authorization failure without leaking internal details.

- [ ] **Step 1: Write failing enforcement tests**

Verify entitled tenant succeeds; denied tenant receives the repository-standard forbidden error; unknown key is forbidden; tenant id is always explicit/server-derived.

- [ ] **Step 2: Run targeted test and verify failure**

Expected FAIL because helper is missing.

- [ ] **Step 3: Implement minimal helper**

Call the resolver, fail closed, and follow existing server authorization error conventions.

- [ ] **Step 4: Run targeted tests**

Expected PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: enforce server entitlements`

---

### Task 5: Integrate the existing workspace entitlement seam without making UI authoritative

**Files:**
- Modify the narrow Platform workspace server/query path that currently returns `requiresEntitlement`.
- Add/modify focused tests beside that path.

**Interfaces:**
- Consumes `hasEntitlement` or a pre-resolved effective set for the authenticated tenant.
- Produces entitlement-aware workspace availability/metadata while backend operation enforcement remains separate.

- [ ] **Step 1: Write failing integration test**

Use `workspace.trading.enterprise`: entitled tenant sees/receives the allowed workspace state; denied tenant receives the locked/unavailable representation chosen by current UX conventions. Assert no client-supplied tenant id controls the decision.

- [ ] **Step 2: Run the exact integration test and verify failure**

Expected FAIL before integration.

- [ ] **Step 3: Implement smallest integration**

Resolve from authenticated tenant context. Do not add `plan ===` checks or move authorization into React/client code.

- [ ] **Step 4: Run exact integration test**

Expected PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: integrate workspace entitlements`

---

### Task 6: Verification, progress documentation and PR handoff

**Files:**
- Create/update: `docs/HANDOFF_MKETY_ENTITLEMENTS_2026-09-07.md`
- Update this plan's checkboxes as tasks complete.

**Interfaces:**
- Produces immutable verification SHA and evidence for the Entitlements PR.

- [ ] **Step 1: Run targeted Entitlements tests**

All entitlement vocabulary, resolver, authorization and workspace integration tests must pass.

- [ ] **Step 2: Run full repository verification**

Run `pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm db:check:migrations`, the repository's Drizzle forward/no-op verification, `pnpm build`, and the existing Cloudflare dry-run/vinext checks used by Billing verification.

- [ ] **Step 3: Verify diff is scope-clean**

Compare against Billing head. Confirm no Auth/Webhooks/Billing provider behavior changed and Usage/Credits is absent.

- [ ] **Step 4: Document exact verification evidence**

Record commands, results, immutable code SHA, branch head, remaining external preview blockers and next step `Usage/Credits architecture` only after Entitlements is clean.

- [ ] **Step 5: Open a draft PR stacked on Billing #21**

Base branch: `feat/mkety-billing-core-foundation`. Keep it draft until required checks and stack gates are satisfied.

- [ ] **Step 6: Final verification commit**

Commit message: `docs: hand off entitlements core`
