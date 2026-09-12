# Mkety Billing Core Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-neutral, tenant-scoped Mkety Billing core with immutable financial history, Selar/NOWPayments adapter capabilities, verified settlement application, recurring-renewal policy and audited manual fallback.

**Architecture:** Mkety owns plans, plan versions, subscriptions, billing periods, settlements and ledger state. Gateway integrations implement a small adapter/capability boundary and normalize verified provider events into settlement commands. Entitlements will consume Billing state later and must never depend on gateway-specific state.

**Tech Stack:** TypeScript, Next.js/vinext, Drizzle ORM/PostgreSQL, Jest, Zod, existing Mkety DB-backed Auth/RBAC, Cloudflare Workers deployment baseline.

**Spec:** `docs/superpowers/specs/2026-09-07-mkety-billing-core-foundation-design.md`

## Global Constraints

- Preserve current vinext/Cloudflare runtime versions and package lock; no runtime dependency upgrades.
- Application migration order is currently `0009_mkety_auth` -> `0010_automation_webhook_trigger`; Billing is the next application migration.
- Use integer minor units plus ISO currency for persisted money; no floating-point billing arithmetic.
- Ledger entries are append-only; corrections use compensating entries.
- Provider callbacks fail closed and browser success redirects are never proof of payment.
- NOWPayments automatic settlement accepts final `finished` only.
- Selar and NOWPayments are equal first-class gateway adapters at schema/service level.
- Automatic renewal is capability-driven; monthly/yearly cadence does not imply auto-charge.
- Manual/offline settlement requires actor, reason and idempotency key.
- No production gateway credentials, ZITADEL settings or Cloudflare production deployment changes.
- TDD is mandatory for production behavior.

---

### Task 1: Billing Domain Types, State Rules and Renewal Resolution

**Files:**
- Create: `src/features/billing/domain/types.ts`
- Create: `src/features/billing/domain/subscription-lifecycle.ts`
- Create: `src/features/billing/domain/renewal-policy.ts`
- Test: `src/features/billing/domain/subscription-lifecycle.test.ts`
- Test: `src/features/billing/domain/renewal-policy.test.ts`

**Interfaces:**
- Produces `BillingInterval`, `SubscriptionStatus`, `RenewalMode`, `GatewayCapabilities`, `SubscriptionRenewalPreferences`.
- Produces `canTransitionSubscription(from, to): boolean`.
- Produces `resolveRenewalMode(preferences, capabilities): RenewalMode`.

- [ ] **Step 1: Write RED lifecycle tests** covering valid `trialing -> active`, `active -> cancel_at_period_end`, `past_due -> active`, terminal `cancelled`, and rejecting invalid resurrection `cancelled -> active`.
- [ ] **Step 2: Run** `pnpm test -- src/features/billing/domain/subscription-lifecycle.test.ts --runInBand` and confirm failure because the domain module does not exist.
- [ ] **Step 3: Implement minimal lifecycle types/rules** with explicit transition sets and no provider logic.
- [ ] **Step 4: Run lifecycle tests** and confirm green.
- [ ] **Step 5: Write RED renewal-policy tests** proving: `autoRenew=false -> manual`; verified auto-charge capability -> `automatic`; hosted recurring without auto-charge -> `provider_managed`; recurring invoice capability -> `invoice_required`; unsupported recurring -> `manual`.
- [ ] **Step 6: Run** `pnpm test -- src/features/billing/domain/renewal-policy.test.ts --runInBand` and confirm expected failure.
- [ ] **Step 7: Implement minimal capability-driven renewal resolution** without checking provider names.
- [ ] **Step 8: Run both Task 1 tests** and confirm green.
- [ ] **Step 9: Commit** `feat: add billing domain lifecycle and renewal rules`.

### Task 2: Billing Schema and Migration Baseline

**Files:**
- Create: `src/shared/db/schema/billing-plans.ts`
- Create: `src/shared/db/schema/billing-plan-versions.ts`
- Create: `src/shared/db/schema/billing-subscriptions.ts`
- Create: `src/shared/db/schema/billing-periods.ts`
- Create: `src/shared/db/schema/billing-checkouts.ts`
- Create: `src/shared/db/schema/billing-settlements.ts`
- Create: `src/shared/db/schema/billing-ledger-entries.ts`
- Create: `src/shared/db/schema/billing-manual-adjustments.ts`
- Create: `src/shared/db/schema/billing-renewal-attempts.ts`
- Modify: `src/shared/db/schema/index.ts`
- Test: `src/shared/db/schema/billing.test.ts`
- Generate: `src/shared/db/migrations/0011_*.sql`
- Generate/update: `src/shared/db/migrations/meta/0011_snapshot.json`
- Update: `src/shared/db/migrations/meta/_journal.json`

**Interfaces:**
- Every tenant-owned table links to `tenants.id` directly or through a strict FK chain.
- Monetary columns use integer/bigint minor units plus bounded ISO currency strings.
- Provider event/payment uniqueness constraints implement settlement idempotency.

- [ ] **Step 1: Write RED schema tests** asserting table exports, tenant/subscription/period foreign keys, append-only ledger shape, integer minor-unit columns and unique provider-event keys.
- [ ] **Step 2: Run** `pnpm test -- src/shared/db/schema/billing.test.ts --runInBand` and confirm missing-schema failure.
- [ ] **Step 3: Add minimal Drizzle schema files and exports** matching the approved model; use enums/check-friendly bounded strings consistent with existing project conventions.
- [ ] **Step 4: Run schema tests** and confirm green.
- [ ] **Step 5: Generate the next migration with Drizzle** from the current `0010` metadata baseline. Do not hand-number a conflicting migration.
- [ ] **Step 6: Inspect generated SQL** and verify no unrelated table/drop/rename operations are present.
- [ ] **Step 7: Run** `pnpm db:check:migrations` and `pnpm exec drizzle-kit check`.
- [ ] **Step 8: Run a no-op forward generation probe** and verify no `0012` migration is emitted.
- [ ] **Step 9: Commit** `feat: add billing core schema and migration`.

### Task 3: Provider-Neutral Gateway Adapter Contract

**Files:**
- Create: `src/features/billing/gateways/types.ts`
- Create: `src/features/billing/gateways/registry.ts`
- Create: `src/features/billing/gateways/selar.ts`
- Create: `src/features/billing/gateways/nowpayments.ts`
- Test: `src/features/billing/gateways/registry.test.ts`
- Test: `src/features/billing/gateways/selar.test.ts`
- Test: `src/features/billing/gateways/nowpayments.test.ts`

**Interfaces:**
- `BillingGatewayAdapter` exposes provider ID, capability descriptor, checkout normalization helpers and verified-event normalization boundary.
- `getBillingGateway(provider)` returns a registered adapter or fails closed.
- Adapter normalization returns the shared settlement command shape; it never writes DB state.

- [ ] **Step 1: Write RED registry tests** proving both `selar` and `nowpayments` resolve and unknown providers fail closed.
- [ ] **Step 2: Run registry test** and confirm missing-module failure.
- [ ] **Step 3: Implement adapter interface and registry** with no gateway secrets in domain types.
- [ ] **Step 4: Write RED Selar capability tests** showing hosted checkout/recurring capability is represented independently from whether a specific payment method supports auto-charge, and success redirect alone cannot normalize to verified settlement.
- [ ] **Step 5: Implement minimal Selar adapter capability model** without live API calls.
- [ ] **Step 6: Write RED NOWPayments tests** proving only verified final `finished` events normalize as settlement candidates; `confirmed`, `sending`, `partially_paid`, missing verification and unknown statuses do not.
- [ ] **Step 7: Implement minimal NOWPayments adapter normalization** based on the hardened `mklms` contract, not the legacy live route.
- [ ] **Step 8: Run all gateway tests** and confirm green.
- [ ] **Step 9: Commit** `feat: add billing gateway adapter contracts`.

### Task 4: Billing Repository and Idempotent Settlement Application

**Files:**
- Create: `src/features/billing/server/repository.ts`
- Create: `src/features/billing/server/settlement-service.ts`
- Test: `src/features/billing/server/settlement-service.test.ts`

**Interfaces:**
- `applyVerifiedSettlement(command, context)` performs one transactional settlement application.
- Repository methods are tenant-scoped and transaction-aware.
- Successful application creates/links settlement and ledger payment effects exactly once.

- [ ] **Step 1: Write RED service tests** with a deterministic repository fake proving one verified settlement creates one settlement plus one payment ledger effect and updates the billing-period collection projection.
- [ ] **Step 2: Add RED duplicate tests** proving repeated provider event/payment IDs return the existing application result without adding ledger entries.
- [ ] **Step 3: Add RED rejection tests** proving unverified/non-final commands cannot reach ledger mutation.
- [ ] **Step 4: Run targeted tests** and confirm failures because the service does not exist.
- [ ] **Step 5: Implement the minimal transactional service/repository contract** with explicit idempotency lookup before insert and tenant-scoped FK checks.
- [ ] **Step 6: Run targeted tests** and confirm green.
- [ ] **Step 7: Run schema/migration tests** to catch cross-layer regressions.
- [ ] **Step 8: Commit** `feat: add idempotent billing settlement service`.

### Task 5: Immutable Ledger and Compensating Entries

**Files:**
- Create: `src/features/billing/server/ledger-service.ts`
- Test: `src/features/billing/server/ledger-service.test.ts`

**Interfaces:**
- `appendLedgerEntry(input)` creates immutable entries.
- `reverseLedgerEntry(originalId, reason, context)` creates a linked compensating `reversal` entry and never edits/deletes the original.

- [ ] **Step 1: Write RED tests** proving charges/payments append, an original cannot be destructively changed through the service, and reversal creates a compensating entry with opposite signed effect/reference.
- [ ] **Step 2: Run targeted test** and confirm missing-service failure.
- [ ] **Step 3: Implement minimal append/reversal service** on the repository boundary.
- [ ] **Step 4: Run targeted tests** and confirm green.
- [ ] **Step 5: Commit** `feat: enforce immutable billing ledger semantics`.

### Task 6: Audited Manual Settlement and Adjustments

**Files:**
- Create: `src/features/billing/server/manual-adjustment-service.ts`
- Test: `src/features/billing/server/manual-adjustment-service.test.ts`

**Interfaces:**
- `applyManualAdjustment(input, actor)` requires tenant-scoped billing-management permission, non-empty reason and unique idempotency key.
- Manual settlement produces the same ledger/period consequences through Billing services, but records source `manual` and actor/audit details.

- [ ] **Step 1: Write RED authorization tests** proving unauthorized actors cannot create manual financial effects.
- [ ] **Step 2: Write RED validation/idempotency tests** for missing reason, duplicate command key and valid waiver/payment adjustment.
- [ ] **Step 3: Run targeted tests** and confirm expected failures.
- [ ] **Step 4: Implement minimal service** using current DB-backed RBAC helpers rather than session-serialized roles.
- [ ] **Step 5: Run targeted tests** and confirm green.
- [ ] **Step 6: Commit** `feat: add audited manual billing adjustments`.

### Task 7: Renewal Attempt Service

**Files:**
- Create: `src/features/billing/server/renewal-service.ts`
- Test: `src/features/billing/server/renewal-service.test.ts`

**Interfaces:**
- `prepareRenewal(subscription, adapterCapabilities, now)` creates a renewal-attempt decision with mode `automatic | provider_managed | invoice_required | manual`.
- This milestone records/returns the decision and checkout requirement; it does not implement a sophisticated retry scheduler.

- [ ] **Step 1: Write RED tests** for auto-renew disabled, auto-charge capable, hosted recurring, recurring invoice and unsupported/manual fallback.
- [ ] **Step 2: Add RED grace-period test** showing failed/unsettled renewal can move an active subscription to `past_due` while retaining explicit grace-period data rather than cancelling immediately.
- [ ] **Step 3: Run tests** and confirm failures.
- [ ] **Step 4: Implement the minimal renewal service** using Task 1 policy resolution and recording renewal attempt state.
- [ ] **Step 5: Run tests** and confirm green.
- [ ] **Step 6: Commit** `feat: add capability-driven billing renewal service`.

### Task 8: Tenant Billing Read Model and API Boundary

**Files:**
- Create: `src/features/billing/server/queries.ts`
- Create: `src/app/api/tenants/[tenant]/billing/summary/route.ts`
- Test: `src/features/billing/server/queries.test.ts`
- Test: `src/app/api/tenants/[tenant]/billing/summary/route.test.ts`

**Interfaces:**
- Read model returns current plan/version, subscription state, period dates, amount due, currency, renewal mode, auto-renew, grace state and recent ledger/settlement summaries.
- API authorizes current DB-backed tenant membership and fails closed for cross-tenant access.
- No provider secrets/raw secret material are returned.

- [ ] **Step 1: Write RED query tests** for tenant-scoped summary and no-secret projection.
- [ ] **Step 2: Write RED route tests** for authorized tenant member vs cross-tenant/unauthorized access.
- [ ] **Step 3: Run targeted tests** and confirm failures.
- [ ] **Step 4: Implement minimal queries and route** using existing Auth/RBAC patterns.
- [ ] **Step 5: Run targeted tests** and confirm green.
- [ ] **Step 6: Commit** `feat: expose tenant billing summary boundary`.

### Task 9: Full Verification and Promotion Evidence

**Files:**
- Modify only if verification exposes a real defect.
- Update: Billing PR body with evidence after all gates are green.

- [ ] **Step 1: Run Billing targeted suites** for domain, schema, gateways, services and API.
- [ ] **Step 2: Run full** `pnpm test -- --runInBand`.
- [ ] **Step 3: Run** `pnpm type-check`.
- [ ] **Step 4: Run** `pnpm lint` and require no errors.
- [ ] **Step 5: Run** `pnpm db:check:migrations` and `pnpm exec drizzle-kit check`.
- [ ] **Step 6: Prove forward Drizzle generation is a no-op** after Billing migration metadata is finalized.
- [ ] **Step 7: Run** `pnpm vinext check`.
- [ ] **Step 8: Run** `pnpm build`.
- [ ] **Step 9: Run isolated Cloudflare preview/deploy packaging dry-run** without production deployment.
- [ ] **Step 10: Confirm no provider/ZITADEL/Cloudflare production secret or deployment was changed.**
- [ ] **Step 11: Update draft PR with exact verified SHA and workflow/command evidence.**

## Self-review

- Spec coverage: plans/versioning, tenant subscriptions, periods, checkout, settlements, ledger, manual adjustment, recurring capability resolution, gateway adapters, tenant read model, migration integrity and Entitlements boundary are all assigned to tasks.
- Scope deliberately excludes Entitlements, Usage/Credits, tax, coupons, automatic proration and sophisticated dunning.
- Types remain provider-neutral; provider IDs are confined to adapter/settlement references.
- Renewal modes and settlement states are consistent with the design spec.
- Migration sequencing explicitly preserves the existing `0009 -> 0010` baseline and requires generated metadata plus no-op forward generation.
