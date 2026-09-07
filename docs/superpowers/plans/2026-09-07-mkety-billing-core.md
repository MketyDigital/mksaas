# Mkety Billing Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the provider-neutral, tenant-scoped Mkety Billing foundation with immutable commercial versions, subscriptions, periods, verified settlements, append-only ledger accounting, audited manual adjustments, and capability-driven recurring renewal.

**Architecture:** Mkety owns billing domain truth. Selar, NOWPayments, and future gateways sit behind adapters that create checkout experiences and normalize only verified provider events into a common settlement contract. Entitlements consumes Mkety subscription/billing state later; gateways never grant access directly.

**Tech Stack:** TypeScript, Next.js 16, vinext, Drizzle ORM/PostgreSQL, Jest, Cloudflare Workers packaging.

**Spec:** `docs/superpowers/specs/2026-09-07-mkety-billing-core-design.md`

## Global Constraints

- Application migration order remains `0009_mkety_auth` → `0010_automation_webhook_trigger` → `0011_billing_core_foundation`.
- Money is persisted as integer minor units plus uppercase ISO currency code; no floating-point billing persistence.
- Billing state is tenant-scoped.
- Ledger history is append-only; corrections use compensating/reversal entries.
- Browser redirects are never payment proof.
- Provider callbacks/events must fail closed and be verified before business mutation.
- NOWPayments automatic settlement is eligible only for final `finished` state under the currently verified contract.
- Selar is first-class at the gateway contract, but automatic settlement requires a verified webhook/API confirmation path.
- Recurring collection is capability-driven; unsupported methods fall back to invoice/checkout/manual renewal.
- Provider secrets never enter tenant UI, CMS content, logs, or source control.
- No production deployment is part of this plan.
- Billing remains downstream of Auth and Webhooks promotion.

---

## File structure

### Domain

- `src/features/billing/domain/types.ts` — shared billing states and gateway capability types.
- `src/features/billing/domain/subscription-lifecycle.ts` — legal subscription state transitions.
- `src/features/billing/domain/subscription-lifecycle.test.ts` — lifecycle behavior.
- `src/features/billing/domain/renewal-policy.ts` — capability-driven renewal selection.
- `src/features/billing/domain/renewal-policy.test.ts` — renewal behavior.
- `src/features/billing/domain/settlement.ts` — normalized settlement validation/application decisions.
- `src/features/billing/domain/settlement.test.ts` — final-state, amount/currency and idempotency-facing behavior.

### Persistence

- `src/shared/db/schema/billing-plans.ts`
- `src/shared/db/schema/billing-plan-versions.ts`
- `src/shared/db/schema/billing-subscriptions.ts`
- `src/shared/db/schema/billing-periods.ts`
- `src/shared/db/schema/billing-checkouts.ts`
- `src/shared/db/schema/billing-settlements.ts`
- `src/shared/db/schema/billing-ledger-entries.ts`
- `src/shared/db/schema/billing-manual-adjustments.ts`
- `src/shared/db/schema/billing-renewal-attempts.ts`
- `src/shared/db/schema/index.ts`
- `src/shared/db/migrations/0011_billing_core_foundation.sql`
- `src/shared/db/migrations/meta/0011_snapshot.json`
- `src/shared/db/migrations/meta/_journal.json`

### Services/adapters

- `src/features/billing/server/repository.ts` — billing persistence interface.
- `src/features/billing/server/postgres-repository.ts` — Drizzle implementation.
- `src/features/billing/server/settlement-service.ts` — transactional verified-settlement application.
- `src/features/billing/server/manual-adjustment-service.ts` — authorized adjustment/waiver/reversal commands.
- `src/features/billing/server/renewal-service.ts` — renewal-attempt preparation and mode selection.
- `src/features/billing/gateways/types.ts` — provider-neutral gateway adapter interfaces.
- `src/features/billing/gateways/registry.ts` — adapter registration/lookup only.
- `src/features/billing/gateways/selar-capabilities.ts` — Selar capability profile without secrets.
- `src/features/billing/gateways/nowpayments-capabilities.ts` — NOWPayments capability profile without secrets.

### Tests

- `src/features/billing/server/settlement-service.test.ts`
- `src/features/billing/server/manual-adjustment-service.test.ts`
- `src/features/billing/server/renewal-service.test.ts`
- `src/features/billing/gateways/registry.test.ts`
- `src/shared/db/schema/billing-core.test.ts`

---

### Task 1: Domain lifecycle and renewal policy

**Files:**
- Create/modify: `src/features/billing/domain/types.ts`
- Create/modify: `src/features/billing/domain/subscription-lifecycle.ts`
- Test: `src/features/billing/domain/subscription-lifecycle.test.ts`
- Create/modify: `src/features/billing/domain/renewal-policy.ts`
- Test: `src/features/billing/domain/renewal-policy.test.ts`

**Interfaces:**
- Produces `SubscriptionStatus`, `RenewalMode`, `GatewayCapabilities`, `canTransitionSubscription()`, and `selectRenewalMode()` for later services.

- [x] **Step 1: Write lifecycle and renewal-policy tests before production behavior.**
- [x] **Step 2: Verify RED failures against missing domain behavior.**
- [x] **Step 3: Implement minimal lifecycle and renewal selection.**
- [x] **Step 4: Verify domain tests pass.**

Required renewal selector behavior:

```ts
selectRenewalMode(
  { autoRenew: true },
  { supportsAutoCharge: true, supportsRecurring: true, ...caps },
) === 'automatic';

selectRenewalMode(
  { autoRenew: true },
  { supportsHostedSubscription: true, supportsAutoCharge: false, ...caps },
) === 'provider_managed';

selectRenewalMode(
  { autoRenew: true },
  { supportsRecurringInvoice: true, supportsAutoCharge: false, supportsHostedSubscription: false, ...caps },
) === 'invoice_required';

selectRenewalMode({ autoRenew: false }, caps) === 'manual';
```

### Task 2: Billing persistence schema and migration baseline

**Files:**
- Create: billing schema files listed above.
- Modify: `src/shared/db/schema/index.ts`
- Test: `src/shared/db/schema/billing-core.test.ts`
- Generate: `src/shared/db/migrations/0011_billing_core_foundation.sql`
- Generate: `src/shared/db/migrations/meta/0011_snapshot.json`
- Modify generated journal: `src/shared/db/migrations/meta/_journal.json`

**Interfaces:**
- Produces the tenant-scoped persistence contract used by all Billing services.

- [x] **Step 1: Add the tenant-scoped Drizzle schema matching the approved design.**
- [x] **Step 2: Export the schema through `src/shared/db/schema/index.ts`.**
- [x] **Step 3: Generate exactly `0011_billing_core_foundation` through guarded Drizzle generation.**
- [x] **Step 4: Reject destructive/unrelated SQL and verify journal tail.**
- [x] **Step 5: Run `pnpm db:check:migrations` and `pnpm exec drizzle-kit check`.**
- [x] **Step 6: Prove forward generation creates no `0012` probe migration.**

Schema regression test must assert at least:

```ts
expect(billingSubscriptions.tenantId).toBeDefined();
expect(billingSettlements.providerEventId).toBeDefined();
expect(billingManualAdjustments.idempotencyKey).toBeDefined();
expect(billingLedgerEntries.reversalOfEntryId).toBeDefined();
```

### Task 3: Normalized settlement domain contract

**Files:**
- Create: `src/features/billing/domain/settlement.test.ts`
- Create: `src/features/billing/domain/settlement.ts`

**Interfaces:**
- Produces:

```ts
export type SettlementSource = 'selar' | 'nowpayments' | 'manual';
export type NormalizedSettlementStatus = 'verified_success' | 'verified_failure';

export interface NormalizedSettlement {
  provider: SettlementSource;
  providerPaymentId?: string;
  providerEventId?: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currencyExpected: string;
  amountPaidMinor: bigint;
  currencyPaid: string;
  status: NormalizedSettlementStatus;
  occurredAt: Date;
  rawReference?: string;
}

export function assertApplicableSettlement(input: NormalizedSettlement): void;
```

- [ ] **Step 1: Write a failing test that rejects non-success normalized settlements.**

```ts
expect(() => assertApplicableSettlement({ ...base, status: 'verified_failure' })).toThrow();
```

- [ ] **Step 2: Run the targeted test and verify RED.**

Run:

```bash
pnpm test -- --runInBand src/features/billing/domain/settlement.test.ts
```

Expected: FAIL because `settlement.ts` / `assertApplicableSettlement` is missing.

- [ ] **Step 3: Implement minimal validation for final successful state, positive expected amount, non-negative paid amount, and normalized uppercase 3-letter currency codes.**
- [ ] **Step 4: Add failing tests for mismatched expected/paid currency and zero/negative expected amount.**
- [ ] **Step 5: Implement only the validation needed to make those tests pass.**
- [ ] **Step 6: Run targeted domain tests green and commit.**

### Task 4: Gateway adapter contract and registry

**Files:**
- Create: `src/features/billing/gateways/types.ts`
- Create: `src/features/billing/gateways/registry.test.ts`
- Create: `src/features/billing/gateways/registry.ts`
- Create: `src/features/billing/gateways/selar-capabilities.ts`
- Create: `src/features/billing/gateways/nowpayments-capabilities.ts`

**Interfaces:**

```ts
export interface CreateCheckoutInput {
  tenantId: string;
  subscriptionId: string;
  billingPeriodId: string;
  amountExpectedMinor: bigint;
  currency: string;
  returnUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutResult {
  provider: string;
  providerCheckoutId?: string;
  checkoutUrl: string;
  expiresAt?: Date;
}

export interface VerifiedGatewayEvent {
  provider: string;
  rawReference?: string;
  payload: unknown;
}

export interface BillingGatewayAdapter {
  readonly provider: string;
  readonly capabilities: GatewayCapabilities;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyIncomingEvent(request: Request): Promise<VerifiedGatewayEvent>;
  normalizeSettlement(event: VerifiedGatewayEvent): NormalizedSettlement;
}
```

- [ ] **Step 1: Write a failing registry test proving duplicate provider registration is rejected and unknown providers fail closed.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement registry with exact provider-key lookup and no provider-specific conditionals in core services.**
- [ ] **Step 4: Add capability profiles for Selar and NOWPayments.**

Initial profile intent:

```ts
selar: {
  supportsRecurring: true,
  supportsAutoCharge: true,
  supportsHostedSubscription: true,
  supportsRecurringInvoice: true,
  supportsWebhookVerification: true,
  supportsRefunds: true,
  supportsPartialPayment: false,
  supportsMultipleCurrencies: true,
}
```

The Selar runtime adapter must downgrade any capability that is not actually configured/verified for the merchant/payment method; this static profile describes potential provider capability, not guaranteed transaction capability.

NOWPayments profile must distinguish automatic balance/custody support from recurring invoice support at runtime and must never imply every crypto checkout is auto-chargeable.

- [ ] **Step 5: Run registry/capability tests green and commit.**

### Task 5: Transactional settlement application service

**Files:**
- Create: `src/features/billing/server/repository.ts`
- Create: `src/features/billing/server/settlement-service.test.ts`
- Create: `src/features/billing/server/settlement-service.ts`
- Create/modify: `src/features/billing/server/postgres-repository.ts`

**Interfaces:**

```ts
export interface BillingRepository {
  findSettlementByProviderEvent(provider: string, providerEventId: string): Promise<{ id: string; status: string } | null>;
  createVerifiedSettlement(input: NormalizedSettlement): Promise<{ id: string }>;
  appendLedgerPayment(input: {
    tenantId: string;
    subscriptionId: string;
    billingPeriodId: string;
    settlementId: string;
    amountMinor: bigint;
    currency: string;
  }): Promise<void>;
  markBillingPeriodPaid(periodId: string, settledAt: Date): Promise<void>;
  activateSubscriptionThroughPeriod(subscriptionId: string, periodEnd: Date): Promise<void>;
  markSettlementApplied(settlementId: string, appliedAt: Date): Promise<void>;
}
```

The PostgreSQL implementation must execute settlement creation, payment ledger entry, period mutation, subscription advancement and settlement application atomically.

- [ ] **Step 1: Write failing service tests proving duplicate provider events are idempotent and never append a second ledger payment.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement minimal service orchestration against the repository interface.**
- [ ] **Step 4: Write failing tests proving a rejected/unverified settlement cannot change period/subscription state.**
- [ ] **Step 5: Implement the transactional Postgres repository path.**
- [ ] **Step 6: Run settlement-service tests and billing schema tests green.**
- [ ] **Step 7: Commit.**

### Task 6: Manual adjustment and waiver service

**Files:**
- Create: `src/features/billing/server/manual-adjustment-service.test.ts`
- Create: `src/features/billing/server/manual-adjustment-service.ts`
- Modify: `src/features/billing/server/repository.ts`
- Modify: `src/features/billing/server/postgres-repository.ts`

**Interfaces:**

```ts
export interface ManualAdjustmentCommand {
  tenantId: string;
  actorUserId: string;
  idempotencyKey: string;
  adjustmentType: 'credit_adjustment' | 'debit_adjustment' | 'waiver' | 'refund' | 'reversal';
  amountMinor: bigint;
  currency: string;
  reason: string;
  subscriptionId?: string;
  billingPeriodId?: string;
  reference?: string;
}
```

- [ ] **Step 1: Write failing tests requiring non-empty actor, reason and idempotency key.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement command validation and repository call.**
- [ ] **Step 4: Write failing idempotency test proving the same tenant/key cannot apply twice.**
- [ ] **Step 5: Implement transaction that persists adjustment plus matching append-only ledger entry.**
- [ ] **Step 6: Run tests green and commit.**

### Task 7: Renewal orchestration

**Files:**
- Create: `src/features/billing/server/renewal-service.test.ts`
- Create: `src/features/billing/server/renewal-service.ts`
- Modify: `src/features/billing/server/repository.ts`
- Modify: `src/features/billing/server/postgres-repository.ts`

**Interfaces:**

```ts
export interface RenewalPreparation {
  mode: RenewalMode;
  provider?: string;
  billingPeriodId: string;
  requiresCustomerAction: boolean;
}
```

- [ ] **Step 1: Write failing tests for automatic, provider-managed, invoice-required, and manual fallback selection.**
- [ ] **Step 2: Verify RED.**
- [ ] **Step 3: Implement renewal preparation using `selectRenewalMode()` and registered adapter capabilities.**
- [ ] **Step 4: Persist one renewal-attempt record for every orchestration attempt.**
- [ ] **Step 5: Verify `autoRenew=false` can never select automatic/provider-managed renewal.**
- [ ] **Step 6: Run tests green and commit.**

### Task 8: Adapter security contracts for Selar and NOWPayments

**Files:**
- Create: `src/features/billing/gateways/nowpayments.test.ts`
- Create: `src/features/billing/gateways/nowpayments.ts`
- Create: `src/features/billing/gateways/selar.test.ts`
- Create: `src/features/billing/gateways/selar.ts`

**Interfaces:**
- Both adapters implement `BillingGatewayAdapter`.
- Runtime secrets are supplied through server-only configuration/dependency injection rather than embedded constants.

- [ ] **Step 1: NOWPayments RED test: missing IPN secret or signature rejects the event.**
- [ ] **Step 2: NOWPayments RED test: `confirmed` and `sending` normalize as non-settleable; only verified `finished` is success.**
- [ ] **Step 3: Implement hardened NOWPayments verification/normalization preserving the `mklms` fail-closed contract.**
- [ ] **Step 4: Selar RED test: redirect/query-string success cannot produce a verified settlement.**
- [ ] **Step 5: Selar RED test: only the configured verified webhook/API confirmation mechanism can yield `verified_success`.**
- [ ] **Step 6: Implement Selar adapter boundary without storing secrets in tenant-facing data.**
- [ ] **Step 7: Run adapter tests green and commit.**

No live production provider credentials are required for these unit/contract tests.

### Task 9: Full Billing verification and cleanup

**Files:**
- Delete after successful migration generation: `.github/workflows/_billing-migration-generate.yml`
- Modify if needed: `docs/MKETY_BRANCH_RETIREMENT.md`
- Create/update Billing draft PR metadata.

- [ ] **Step 1: Run all Billing-targeted tests.**

```bash
pnpm test -- --runInBand src/features/billing src/shared/db/schema/billing-core.test.ts
```

- [ ] **Step 2: Run migration integrity.**

```bash
pnpm db:check:migrations
pnpm exec drizzle-kit check
```

- [ ] **Step 3: Prove forward generation is a no-op and no `0012` migration appears.**
- [ ] **Step 4: Run full test suite.**
- [ ] **Step 5: Run `pnpm type-check`.**
- [ ] **Step 6: Run `pnpm lint`; warnings may be reported but no errors accepted.**
- [ ] **Step 7: Run `pnpm exec vinext check`.**
- [ ] **Step 8: Run production `pnpm build`.**
- [ ] **Step 9: Run isolated Cloudflare preview packaging dry-run only; do not deploy production.**
- [ ] **Step 10: Remove temporary migration-generation workflow and prove only that workflow changed after immutable verification.**
- [ ] **Step 11: Mark accidental `feat/mkety-billing-core-foundation-copy` ref retire-safe because it points to a historical Billing SHA and contains no unique work.**
- [ ] **Step 12: Open/update Billing as a DRAFT PR and record verification evidence plus promotion boundary.**

## Promotion order

Do not merge Billing until the prerequisite promotion order is satisfied:

```text
Auth #16
→ Webhooks #15
→ Billing
→ Entitlements
→ Usage/Credits
```

Billing can be developed and internally verified while Auth remains externally blocked, but it must remain draft and must not be promoted ahead of its prerequisites.
