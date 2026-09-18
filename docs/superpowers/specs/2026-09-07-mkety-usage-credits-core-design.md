# Mkety Usage/Credits Core Design

## Status

Approved on 2026-09-07.

## Goal

Introduce a provider-neutral Usage/Credits subsystem that sits below Entitlements and above expensive/metered product operations. Entitlements answers whether a tenant may use a capability; Usage records measurable consumption; Credits controls internal spending capacity.

## Architecture

```text
Billing Plan Version
        ↓
Credit Allowance Policy
        ↓
Billing Period / Tenant
        ↓
Credit Grant
        ↓
Tenant Credit Account
        ↓
Metered Operation
        ↓
Usage Event
        ↓
Credit Debit
        ↓
Updated Available Balance
```

Request flow:

```text
requireEntitlement(...)
        ↓
check / consume credits
        ↓
perform expensive operation
        ↓
record usage
```

Billing, Entitlements, Usage, and Credits remain separate concerns. Usage/Credits must not depend directly on Selar, NOWPayments, or other payment providers.

## Stable Meter Vocabulary

Application code uses stable meter keys rather than plan slugs or provider names.

Initial keys:

- `ai.generation`
- `ai.tokens.input`
- `ai.tokens.output`
- `automation.run`
- `workflow.execution`
- `knowledge.ingestion`
- `webhook.delivery`

Unknown meter keys fail closed.

## Plan-Version Credit Allowances

Recurring subscription credits attach to immutable Billing plan versions.

Table: `billing_plan_version_credit_allowances`

Fields:

- `id`
- `plan_version_id`
- `credit_amount`
- `grant_interval`
- `created_at`

A new commercial allowance creates a new plan version rather than silently changing existing customers.

## Tenant Credit Account

Table: `tenant_credit_accounts`

Fields:

- `tenant_id`
- `available_credits`
- `lifetime_granted`
- `lifetime_consumed`
- `updated_at`

All quantities use integer/bigint units. Floating-point balances are prohibited.

The account row is a fast concurrency-safe projection, not the sole audit record.

## Immutable Credit Ledger

Table: `credit_ledger_entries`

Fields:

- `id`
- `tenant_id`
- `delta`
- `entry_type`
- `source`
- `billing_period_id`
- `usage_event_id`
- `idempotency_key`
- `reason`
- `actor_user_id`
- `created_at`

Ledger history is append-only. Corrections use compensating entries.

Initial entry types include:

- `period_grant`
- `usage`
- `manual_grant`
- `manual_debit`
- `adjustment`

Credits are internal product units and must not be mixed with the Billing financial ledger.

## Immutable Usage Events

Table: `usage_events`

Fields:

- `id`
- `tenant_id`
- `meter_key`
- `quantity`
- `credits_charged`
- `idempotency_key`
- `project_id` (nullable)
- `workspace_key` (nullable)
- `source`
- `occurred_at`
- `created_at`

Usage events are immutable product measurements. Pricing/metering may evolve without mutating historical usage.

## Transactional Consumption

Credit consumption must be atomic and concurrency-safe.

Required transaction sequence:

1. Check idempotency key.
2. Lock or atomically conditionally update the tenant credit account.
3. Verify sufficient balance.
4. Insert usage event.
5. Insert immutable credit-ledger debit.
6. Decrement available credits and increment lifetime consumed.
7. Commit.

Two concurrent requests must not both spend the same credits.

## Idempotency

Every retryable metered operation supplies an idempotency key.

Example API:

```ts
consumeCredits({
  tenantId,
  meter: 'automation.run',
  quantity: 1n,
  credits: 20n,
  idempotencyKey,
})
```

A duplicate key for the same tenant returns the existing recorded result and never charges twice.

## Period Grants

Billing current-period state is the source of recurring allowance eligibility.

```text
Billing period becomes eligible
        ↓
Usage/Credits grant service
        ↓
unique grant keyed by billing period
        ↓
credit ledger + account projection
```

Retrying grant processing must not duplicate credits.

Usage/Credits consumes Mkety Billing state only; it must not inspect payment-provider events directly.

## Manual Adjustments

Controlled manual operations may grant, debit, or correct credits, but all changes must go through the same ledger/account service and require tenant scope, reason, actor identity where applicable, and idempotency.

Direct database edits to balances are prohibited.

## Service Boundary

Initial server-facing interfaces:

```ts
getCreditBalance(tenantId)
grantCredits(...)
consumeCredits(...)
recordUsage(...)
getTenantUsage(...)
getCreditLedger(...)
```

Protected metered operations should compose as:

```text
requireEntitlement(...)
        ↓
consumeCredits(...)
        ↓
execute operation
```

Operation execution remains outside the Credits subsystem.

## Error Handling

The core service exposes explicit domain failures for:

- unknown meter key
- insufficient credits
- invalid quantity/credit amount
- idempotency conflict
- missing tenant account state when a debit is attempted

Errors returned to callers should be safe and must not expose internal SQL or provider details.

## Initial Implementation Scope

Implement:

1. Stable meter-key vocabulary and types.
2. Plan-version credit allowance schema.
3. Tenant credit account schema.
4. Immutable usage-event schema.
5. Immutable credit-ledger schema.
6. Transactional `grantCredits`.
7. Transactional, idempotent `consumeCredits`.
8. Billing-period grant idempotency.
9. Tenant-isolation and concurrency-focused tests.
10. Integration at one existing expensive operation seam only.
11. Real Drizzle migration and migration verification.
12. Full repository verification and handoff documentation.

## Explicit Non-Goals

Do not implement in this slice:

- purchased credit packs
- real-money wallet functionality
- provider cost accounting
- overage billing
- prepaid-card behavior
- expiring credit buckets
- complex reservation/settlement flows
- tiered metering
- public usage dashboards
- plan-slug checks in product code
- frontend-only authorization

## Security and Isolation

- Every query and mutation is tenant-scoped.
- Frontend state is never the authority for entitlement or credit checks.
- Unknown meter keys fail closed.
- Protected operations must check Entitlements before credit consumption where the capability itself is gated.
- Manual mutations require explicit actor/reason audit context.

## Verification

Required before completion:

- targeted Usage/Credits tests
- concurrency/idempotency tests
- tenant-isolation tests
- full Jest suite
- TypeScript type-check
- lint
- migration integrity check
- Drizzle schema check
- forward `db:generate` no-op
- vinext check
- production build
- Cloudflare preview dry-run
- immutable commit/worktree SHA proof

## Stack

```text
Auth
 ↓
Webhooks
 ↓
Billing
 ↓
Entitlements
 ↓
Usage / Credits
```

The implementation branch is `feat/mkety-usage-credits-core`, stacked on `feat/mkety-entitlements-core`.