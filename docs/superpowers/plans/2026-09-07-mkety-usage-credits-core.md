# Mkety Usage/Credits Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tenant-scoped, provider-neutral Usage/Credits core with stable meter keys, immutable usage and credit history, transactional/idempotent grants and consumption, and one server-side integration seam.

**Architecture:** Entitlements remains the capability gate. Usage records immutable product measurements. Credits maintains an append-only non-cash credit ledger plus a concurrency-safe tenant balance projection; recurring allowances come from immutable Billing plan versions/current periods and never from provider-specific webhooks.

**Tech Stack:** TypeScript, Jest, Drizzle ORM, PostgreSQL, pnpm, vinext, Cloudflare preview dry-run.

**Spec:** `docs/superpowers/specs/2026-09-07-mkety-usage-credits-core-design.md`

## Global Constraints

- Unknown meter keys fail closed.
- All credit and usage quantities use integer/bigint semantics; no floating-point balances.
- Every query and mutation is tenant-scoped.
- Credit history is append-only; corrections use compensating entries.
- Billing financial ledger and product credit ledger remain separate.
- Recurring grants derive only from Mkety Billing plan-version/current-period state.
- Retriable mutations require tenant-scoped idempotency.
- Protected metered operations compose `requireEntitlement` before credit consumption where capability access is gated.
- No purchased packs, overage billing, provider-cost accounting, reservations, expiry buckets, tiered metering, or public dashboard in this slice.

---

### Task 1: Stable Usage Meter Vocabulary and Domain Types

**Files:**
- Create: `src/features/usage-credits/meter-keys.test.ts`
- Create: `src/features/usage-credits/meter-keys.ts`
- Create: `src/features/usage-credits/types.ts`

**Interfaces:**
- Produces: `USAGE_METER_KEYS`, `UsageMeterKey`, `isUsageMeterKey(value)`, domain input/result types, and safe domain errors.

- [ ] **Step 1: Write failing vocabulary/domain tests**
  Assert all seven approved keys are recognized, an unknown key is rejected, quantities/credit amounts are bigint-oriented, and domain errors expose stable safe codes.
- [ ] **Step 2: Run targeted test and verify RED**
  Run: `pnpm test -- --runInBand src/features/usage-credits/meter-keys.test.ts`
  Expected: FAIL because the production module does not exist.
- [ ] **Step 3: Implement minimal vocabulary/types**
  Add only the approved keys and explicit domain contracts/errors required by later tasks.
- [ ] **Step 4: Run targeted test and verify GREEN**
- [ ] **Step 5: Commit**
  Commit message: `feat: add usage credit domain vocabulary`

### Task 2: Persistence Schema

**Files:**
- Create: `src/shared/db/schema/billing-plan-version-credit-allowances.ts`
- Create: `src/shared/db/schema/tenant-credit-accounts.ts`
- Create: `src/shared/db/schema/usage-events.ts`
- Create: `src/shared/db/schema/credit-ledger-entries.ts`
- Create: `src/shared/db/schema/usage-credits.test.ts`
- Modify: `src/shared/db/schema/index.ts`

**Interfaces:**
- Produces Drizzle tables for plan-version allowances, tenant balance projection, immutable usage events, and immutable credit ledger.

- [ ] **Step 1: Write failing schema-shape tests**
  Assert table names, required FKs/indexes/unique idempotency constraints, bigint columns, tenant isolation keys, and ledger/usage relations.
- [ ] **Step 2: Run schema test and verify RED**
- [ ] **Step 3: Implement minimal Drizzle schemas and exports**
  Use `billingPlanVersions`, `billingPeriods`, `tenants`, `users`, and `projects` only where the existing schema contract supports those relations. Keep usage `workspaceKey` textual/nullable rather than creating a new workspace FK.
- [ ] **Step 4: Run schema test and verify GREEN**
- [ ] **Step 5: Commit**
  Commit message: `feat: add usage credit persistence schema`

### Task 3: Pure Credit Mutation Engine

**Files:**
- Create: `src/features/usage-credits/server/engine.test.ts`
- Create: `src/features/usage-credits/server/engine.ts`

**Interfaces:**
- Consumes: `UsageMeterKey` and domain types.
- Produces: pure validation/idempotency decision helpers used by the Drizzle repository/service.

- [ ] **Step 1: Write failing tests**
  Cover invalid zero/negative quantities, unknown meter keys, insufficient balance, duplicate idempotency returning the recorded result, and conflicting reuse of an idempotency key failing safely.
- [ ] **Step 2: Run targeted test and verify RED**
- [ ] **Step 3: Implement minimal pure engine**
  Keep DB access out of this file so all decision semantics are directly unit-testable.
- [ ] **Step 4: Run targeted test and verify GREEN**
- [ ] **Step 5: Commit**
  Commit message: `feat: add credit mutation rules`

### Task 4: Transactional Credit Repository and Service

**Files:**
- Create: `src/features/usage-credits/server/source.ts`
- Create: `src/features/usage-credits/server/service.ts`
- Create: `src/features/usage-credits/server/service.test.ts`
- Create: `src/features/usage-credits/server/drizzle-source.ts`

**Interfaces:**
- Produces: `getCreditBalance(tenantId)`, `grantCredits(input)`, `consumeCredits(input)`, `recordUsage(input)`, `getTenantUsage(input)`, `getCreditLedger(input)`.
- `grantCredits` and `consumeCredits` execute through one transaction boundary supplied by the source adapter.

- [ ] **Step 1: Write failing service tests against an in-memory/fake source**
  Cover tenant isolation, grant idempotency, consumption idempotency, duplicate-key conflict, insufficient credits, balance/lifetime projection updates, immutable usage + ledger writes, and two concurrent debits where only one can succeed when funds are insufficient for both.
- [ ] **Step 2: Run targeted tests and verify RED**
- [ ] **Step 3: Implement source contract + minimal service**
  Service validates stable meters before storage access. Mutations are atomic at the source transaction boundary.
- [ ] **Step 4: Implement Drizzle adapter**
  Use a transaction and conditional/locking update so balance cannot go negative. Ensure tenant + idempotency uniqueness is authoritative in storage.
- [ ] **Step 5: Run targeted tests and verify GREEN**
- [ ] **Step 6: Commit**
  Commit message: `feat: add transactional usage credit service`

### Task 5: Billing-Period Recurring Grants

**Files:**
- Create: `src/features/usage-credits/server/period-grants.test.ts`
- Create: `src/features/usage-credits/server/period-grants.ts`
- Modify only if necessary: `src/features/usage-credits/server/drizzle-source.ts`

**Interfaces:**
- Produces: `grantCurrentPeriodAllowance(tenantId, options?)`.

- [ ] **Step 1: Write failing tests**
  Cover qualifying current subscription/period + plan-version allowance, no allowance, no qualifying billing state, duplicate period processing, and tenant isolation.
- [ ] **Step 2: Run targeted tests and verify RED**
- [ ] **Step 3: Implement minimal period-grant resolver**
  Read Mkety Billing state; derive deterministic period idempotency identity; call `grantCredits`; never inspect Selar/NOWPayments events.
- [ ] **Step 4: Run targeted tests and verify GREEN**
- [ ] **Step 5: Commit**
  Commit message: `feat: add recurring credit period grants`

### Task 6: One Existing Expensive Operation Seam

**Files:**
- Inspect and modify exactly one existing server operation under `src/features` that already performs an expensive AI/workflow/automation action.
- Create or modify the nearest existing test for that operation.

**Interfaces:**
- Consumes: existing tenant context, `requireEntitlement` when the operation is gated, and `consumeCredits`.

- [ ] **Step 1: Select the smallest real server-side seam with established tenant context**
  Prefer an AI generation/run seam over UI-only code. Do not spread integration across multiple operations.
- [ ] **Step 2: Write a failing integration test**
  Assert entitlement/credit rejection prevents the expensive operation and successful authorization/consumption allows exactly one execution.
- [ ] **Step 3: Run test and verify RED**
- [ ] **Step 4: Add minimal composition**
  `requireEntitlement` (if applicable) → `consumeCredits` → existing expensive operation.
- [ ] **Step 5: Run integration test and verify GREEN**
- [ ] **Step 6: Commit**
  Commit message: `feat: enforce credits on metered operation`

### Task 7: Real Migration

**Files:**
- Generate: next `src/shared/db/migrations/*.sql`
- Generate: matching `src/shared/db/migrations/meta/*_snapshot.json`
- Modify generated journal as produced by Drizzle.

- [ ] **Step 1: Run `pnpm db:generate` on the branch**
  Never hand-author the snapshot.
- [ ] **Step 2: Inspect generated SQL for exact intended tables/FKs/indexes only**
- [ ] **Step 3: Run migration checks**
  `pnpm db:check:migrations`
  `pnpm exec drizzle-kit check`
- [ ] **Step 4: Run `pnpm db:generate` again and verify no forward diff**
- [ ] **Step 5: Commit generated migration**
  Commit message: `chore: generate usage credits migration`

### Task 8: Full Verification, PR, and Handoff

**Files:**
- Create: `docs/HANDOFF_MKETY_USAGE_CREDITS_2026-09-07.md`
- Temporary verifier workflow may be created under `.github/workflows/` only if needed for immutable remote execution, then removed after evidence is captured.

- [ ] **Step 1: Run targeted Usage/Credits tests**
- [ ] **Step 2: Run full Jest suite**
- [ ] **Step 3: Run type-check and lint**
- [ ] **Step 4: Run migration integrity + Drizzle no-op verification**
- [ ] **Step 5: Run `pnpm vinext check`, production build, and Cloudflare preview dry-run**
- [ ] **Step 6: Capture immutable commit SHA and verification run evidence**
- [ ] **Step 7: Create/update draft PR stacked on `feat/mkety-entitlements-core`**
- [ ] **Step 8: Write handoff with architecture, implemented files, migration, verification evidence, stack order, remaining boundaries, and do-not-do rules**
- [ ] **Step 9: Remove temporary verifier workflow without changing application behavior and record final branch head separately from immutable application-verification SHA**

## Self-Review

- Spec coverage: all approved architecture sections map to Tasks 1-8.
- Placeholder scan: no TBD/TODO/"implement later" placeholders.
- Type consistency: stable `UsageMeterKey`, bigint quantities, tenant-scoped idempotency, and service names are consistent across tasks.
- Scope: one cohesive Usage/Credits core; wallet/real-money/purchased credits and broad platform integration remain explicitly out of scope.
