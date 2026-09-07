# Mkety Billing Core Design

## Status

Approved for implementation on 2026-09-07.

This design governs the first Mkety Platform Billing milestone and supersedes provider-shaped legacy billing logic. It preserves useful behavior from `MketyDigital/Mkety` and the hardened managed-hosting billing contract in `MketyDigital/mklms`, but Mkety Platform owns the billing domain.

## Goal

Build a provider-neutral, tenant-scoped Billing core that supports plans, immutable commercial versions, subscriptions, billing periods, verified settlements, an append-only ledger, manual audited adjustments, and capability-driven recurring renewal.

The next dependent subsystem is Entitlements, followed by Usage/Credits.

## Scope

Milestone one includes:

- Plans and immutable plan versions.
- Tenant subscriptions and lifecycle state.
- Billing periods and amounts due.
- Checkout-attempt records.
- Verified settlement records.
- Immutable ledger entries.
- Audited manual adjustments/waivers.
- Renewal-attempt records.
- Gateway capability contracts.
- Selar and NOWPayments as first-class gateway identities at the adapter boundary.
- Automatic renewal when a gateway/payment method proves it can support it reliably.
- Invoice/manual fallback where automatic renewal is not supported.

Milestone one deliberately excludes:

- Wallet/credits implementation.
- Metered usage.
- Tax/VAT engine.
- Coupons/discount engine.
- Automated proration.
- Multi-provider refund orchestration.
- Complex dunning/retry engine.
- Entitlement enforcement itself.

These may be added later without changing the core ownership boundaries below.

## Ownership boundary

### Mkety Billing Core owns

- Plan identity and plan versions.
- Subscription state.
- Billing periods.
- Checkout-attempt references.
- Settlement acceptance/application state.
- Ledger-visible accounting consequences.
- Manual adjustments, waivers, reversals, and audit metadata.
- Renewal orchestration policy.
- Provider-neutral external references.
- The stable service contract consumed by Entitlements.

### Gateway/infrastructure adapters own

- Provider credentials.
- Provider-specific checkout requests.
- Provider-specific webhook/API verification.
- Provider-specific status normalization.
- Provider customer/subscription references.
- Provider-specific recurring mechanics.

Provider code must not directly grant product access or mutate Entitlements.

## External source audits

### Live Mkety enterprise billing

`MketyDigital/Mkety` currently exposes both:

- Selar for card/mobile-money/local hosted checkout.
- NOWPayments for crypto invoice checkout.

The legacy live implementation records provider identity on enterprise orders and redirects Selar checkout locally while creating NOWPayments invoices directly.

Useful capability is preserved, but the direct route/provider coupling is not copied.

The old NOWPayments webhook must not be copied as-is because it may accept callbacks when the signature secret is absent and it historically treated non-final states such as `confirmed`/`sending` as completed.

### Hardened managed-hosting billing

`MketyDigital/mklms` contains the hardened reusable provider/settlement contract:

- Central Cloudflare billing Worker.
- NOWPayments invoice creation.
- Mandatory provider signature verification.
- Fail-closed behavior.
- Only final `finished` state can automatically settle.
- Per-installation HMAC-SHA256 signed settlement callbacks.
- Fresh timestamp enforcement.
- Idempotent target mutation.
- No customer database passwords inside the Worker.
- Manual `PENDING` / `PAID` / `WAIVED` fallback remains available.

Mkety Platform should preserve these security invariants.

## Core flow

```text
Plan
  ↓
Plan Version
  ↓
Subscription
  ↓
Billing Period
  ↓
Checkout / Renewal Attempt
  ↓
Gateway adapter
  ↓
Verified normalized Settlement
  ↓
Mkety Billing service
  ↓
Append-only Ledger
  ↓
Subscription billing state
  ↓
Entitlements (next subsystem)
```

A browser redirect is never payment proof.

A gateway event is never direct authorization proof.

Only an accepted and applied Mkety settlement, an authorized trial/grant, or an audited manual override may advance paid billing state.

## Data model

### `billing_plans`

Stable commercial identity.

Examples:

- `creator`
- `ai-suite`
- `mkety-one`
- `enterprise`

Fields include stable key, display name, description, status, timestamps.

### `billing_plan_versions`

Immutable commercial terms for one version of a plan.

Fields include:

- `plan_id`
- integer `version`
- `amount_minor`
- ISO currency code
- billing interval
- public/private availability
- metadata/terms reference
- effective date range

Existing subscriptions remain pinned to their plan version until an explicit migration/change operation.

### `billing_subscriptions`

Tenant-to-plan-version relationship.

Required concepts:

- tenant ID
- plan version ID
- subscription lifecycle status
- renewal mode
- auto-renew preference
- current period start/end
- grace-period end
- gateway provider identity
- provider customer/subscription references
- cancel-at-period-end flag
- cancellation metadata

### `billing_periods`

One concrete charge window.

Required concepts:

- tenant ID
- subscription ID
- start/end
- amount due in minor units
- ISO currency
- collection state
- due timestamp

A subscription may have many historical periods. A period is not destroyed when paid.

### `billing_checkouts`

Disposable provider-facing payment-attempt state for one billing period.

Fields include provider, provider checkout reference, expected amount/currency, status, checkout URL and expiration.

Checkout completion alone cannot apply money to the ledger.

### `billing_settlements`

Normalized verified money event from an external gateway or authorized manual source.

Fields include:

- tenant ID
- subscription ID
- billing-period ID
- provider/source
- provider payment ID
- provider event ID
- settlement type
- expected amount/currency
- paid amount/currency
- received/verified/applied/rejected/reversed state
- raw/reference pointer
- occurred/verified/applied timestamps

Idempotency must protect provider event IDs and provider payment/type combinations.

### `billing_ledger_entries`

Append-only accounting events.

Initial entry types:

- `charge`
- `payment`
- `credit`
- `debit_adjustment`
- `credit_adjustment`
- `waiver`
- `refund`
- `reversal`

Corrections use compensating/reversal entries; historical ledger rows are never silently rewritten.

### `billing_manual_adjustments`

Privileged audited commands that create accounting consequences.

Required concepts:

- tenant
- optional subscription/period
- actor user
- idempotency key
- adjustment type
- amount/currency
- mandatory reason
- optional external/reference evidence

Manual settlement/waiver is a source of authorized billing truth, not a fake payment gateway.

### `billing_renewal_attempts`

Records orchestration attempts independently from settlement results.

Required concepts:

- tenant
- subscription
- optional billing period
- renewal mode
- provider
- attempt state
- outcome reference
- attempted/completed timestamps

## Money representation

All monetary values must use integer minor units plus ISO currency code.

Do not use floating-point money in persisted billing state.

Examples:

- USD 19.99 -> `1999`, `USD`
- NGN 50,000 -> `5000000`, `NGN`

Currency conversion, if added later, must be explicit and auditable.

## Lifecycle separation

### Subscription lifecycle

```text
trialing
active
past_due
paused
cancel_at_period_end
cancelled
```

### Checkout lifecycle

```text
created
pending
expired
cancelled
completed
```

### Settlement lifecycle

```text
received
verified
applied
rejected
reversed
```

Payment provider statuses must be normalized at the adapter boundary before they reach the core.

## Gateway adapter contract

The Billing core should depend on a provider-neutral interface conceptually equivalent to:

```ts
interface BillingGatewayAdapter {
  readonly provider: string;
  readonly capabilities: GatewayCapabilities;

  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyIncomingEvent(input: VerifyGatewayEventInput): Promise<VerifiedGatewayEvent>;
  normalizeSettlement(event: VerifiedGatewayEvent): NormalizedSettlement;
}
```

The core must not accumulate provider-name conditional branches as a substitute for adapters.

## Normalized settlement contract

Adapters normalize provider-specific events into the same logical shape:

```text
provider
providerPaymentId
providerEventId
subscriptionId / billingPeriodId
amountExpected
currencyExpected
amountPaid
currencyPaid
status
occurredAt
rawReference
```

Only statuses that the adapter can prove to be final and successful are eligible for settlement application.

## Selar adapter

Selar is a first-class checkout gateway for card/mobile-money/local payment experiences.

The current live Mkety integration uses a hosted checkout URL. That behavior can be reused as a checkout capability, but browser success redirects are never settlement proof.

Automatic settlement requires an explicit verified webhook/API confirmation path.

If a selected Selar payment method supports recurring automatic charging, the adapter may advertise that capability. If a method does not support reliable auto-charge, the renewal engine falls back to renewal checkout/invoice/manual settlement.

## NOWPayments adapter

NOWPayments is a first-class crypto gateway.

Security requirements:

- mandatory signature verification;
- fail closed when credentials/signatures are missing;
- only final successful provider state is settlement-eligible;
- preserve the hardened `mklms` behavior where `finished` is the automatic settlement state;
- do not copy legacy behavior that treated `confirmed`/`sending` as paid;
- replay-safe/idempotent application.

Recurring support may use provider recurring invoice or customer-balance/custody capabilities where configured. The core must not assume those capabilities exist for every merchant setup or customer payment method.

## Recurring and renewal policy

A monthly/yearly plan describes a billing schedule, not a guarantee that the gateway can auto-charge.

The subscription has a provider-neutral renewal mode:

```text
automatic
provider_managed
invoice_required
manual
```

Each adapter declares capabilities such as:

```ts
interface GatewayCapabilities {
  supportsRecurring: boolean;
  supportsAutoCharge: boolean;
  supportsHostedSubscription: boolean;
  supportsRecurringInvoice: boolean;
  supportsWebhookVerification: boolean;
  supportsRefunds: boolean;
  supportsPartialPayment: boolean;
  supportsMultipleCurrencies: boolean;
}
```

The renewal policy selects the strongest safe mode available:

1. automatic charge when both customer preference and adapter capability allow it;
2. provider-managed hosted subscription where safe;
3. recurring invoice / renewal checkout;
4. manual renewal fallback.

Required subscription controls:

- `autoRenew`
- `cancelAtPeriodEnd`
- current period boundaries
- configurable grace period
- renewal-attempt audit records
- external provider references only, never provider-owned authorization state

Complex retry/dunning is deferred, but the model must allow it later.

## Idempotency and integrity

Required protections:

- unique provider event identity where available;
- duplicate provider payment/type application prevented;
- manual adjustment idempotency key scoped to tenant;
- ledger append-only semantics;
- reversals/compensating entries instead of destructive mutation;
- provider callbacks verified before business mutation;
- public routes call service boundaries rather than mutating ledger tables directly.

## Tenant isolation and authorization

All tenant-owned billing state must include tenant identity and follow existing Mkety Auth database-backed membership/RBAC truth.

Provider credentials and webhook secrets are infrastructure secrets and must never be exposed to tenant UI, logs, CMS content, or source control.

Manual adjustments require privileged authorization and actor attribution.

## Public pricing separation

Public pricing/CMS content may describe offers, labels, CTA copy, displayed prices, and feature summaries.

It must not directly mutate:

- billing plan versions;
- subscription state;
- ledger balances;
- settlement state;
- entitlement enforcement;
- gateway credentials;
- settlement secrets.

Billing commercial truth is server-side domain state.

## Entitlements boundary

Billing answers questions such as:

- What plan version is this tenant subscribed to?
- Is the subscription trialing/active/past due/cancelled?
- What billing period is current?
- Has the required settlement been applied?
- Is the tenant in an allowed grace period?

Entitlements, implemented next, converts that billing state into product-access decisions.

Billing routes must not directly encode feature-access rules that belong in Entitlements.

## Usage/Credits boundary

Usage/Credits, implemented after Entitlements, will own metering, included quotas, credit consumption, top-ups, and overage accounting.

The Billing model may reference later wallet/usage consequences but must not prematurely embed those engines in this milestone.

## Verification requirements

Before this Billing foundation is considered complete:

- domain behavior tests pass;
- schema tests cover tenant isolation, money representation, idempotency indexes and immutable relationships;
- migration `0011_billing_core_foundation` is the only next application migration after Auth `0009` and Webhooks `0010`;
- migration guard and `drizzle-kit check` pass;
- forward Drizzle generation is a no-op;
- full tests pass;
- type-check passes;
- lint passes without errors;
- `vinext check` passes;
- production build passes;
- isolated Cloudflare preview packaging dry-run passes;
- no production deployment occurs as part of internal verification;
- Billing PR remains downstream of Auth/Webhooks promotion order.

## Promotion boundary

Billing must not be merged ahead of the prerequisite promotion sequence.

Current order remains:

```text
Auth
→ Webhooks
→ Billing
→ Entitlements
→ Usage/Credits
```

A green Billing branch is not permission to bypass the external Auth preview/ZITADEL gate or the Webhooks promotion boundary.
