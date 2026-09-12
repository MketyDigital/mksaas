# Mkety Billing Core Foundation Design

## Status

Approved architectural design for the first Mkety Platform Billing milestone.

This milestone follows the approved platform sequence:

```text
Billing -> Entitlements -> Usage/Credits
```

It is intentionally domain-first. Payment gateways are adapters; Mkety Billing owns commercial truth.

## Goals

Build a globally standard, provider-neutral Billing core that:

- owns plans, plan versions, subscriptions, billing periods, settlements and immutable ledger state;
- supports Selar and NOWPayments as equal first-class gateway capabilities;
- supports recurring/automatic renewal where the selected gateway/payment method reliably supports it;
- falls back to renewal invoice/checkout or authorized manual settlement where automatic renewal is unavailable;
- preserves hardened managed-hosting settlement behavior from `MketyDigital/mklms`;
- gives the future Entitlements subsystem one stable Mkety-owned source of truth.

## Non-goals for this milestone

Do not build yet:

- entitlement enforcement;
- usage metering or credits/wallet balances;
- tax/VAT calculation;
- couponing or promotion engines;
- automatic proration;
- full refunds automation;
- sophisticated dunning/retry orchestration;
- live production provider deployment;
- migration of provider secrets into tenant-facing configuration.

Extension points must allow these later without changing the core ownership model.

## Source-of-truth boundaries

### Mkety Billing Core owns

- plan identities;
- immutable plan versions;
- tenant subscriptions and lifecycle state;
- billing periods and amount due;
- checkout attempt records;
- verified settlement records;
- immutable ledger entries;
- authorized manual adjustments/waivers;
- provider-neutral renewal policy;
- service APIs consumed by Entitlements.

### Gateway/infrastructure adapters own

- provider API credentials;
- checkout/invoice creation;
- provider webhook or API verification;
- provider-specific status mapping;
- provider customer/subscription references;
- normalization into Mkety settlement events.

A provider may never directly mutate entitlement state, usage state, ledger balances or subscription authorization state.

## Existing live systems audited

### `MketyDigital/Mkety` main

The existing enterprise checkout supports two gateway choices:

- Selar for local/card/mobile-money style hosted checkout;
- NOWPayments for crypto invoice checkout.

The live implementation records `selar` or `nowpayments` as the payment provider. The legacy NOWPayments route contains useful capability but must not be copied directly because it can accept callbacks when the signature secret is absent and treats non-final states such as `confirmed` and `sending` as completed.

### `MketyDigital/mklms` main

The reusable managed-hosting billing Worker is the hardened provider contract to preserve:

- signed/fresh invoice requests;
- mandatory provider webhook verification;
- fail closed when secrets/signatures are missing;
- NOWPayments automatic settlement only on final `finished` state;
- per-installation signed settlement callbacks;
- idempotent customer-side settlement;
- no customer database passwords in the billing Worker;
- manual/offline operational fallback remains available.

## Core domain model

The first milestone uses these first-class records:

```text
billing_plans
billing_plan_versions
billing_subscriptions
billing_periods
billing_checkouts
billing_settlements
billing_ledger_entries
billing_manual_adjustments
billing_renewal_attempts
```

### Billing plan

Stable commercial identity, for example:

- `creator`;
- `ai-suite`;
- `mkety-one`;
- `enterprise`.

A plan identity is not edited to rewrite historical subscriptions.

### Billing plan version

Immutable commercial terms for one effective version:

- plan ID;
- version number;
- amount in minor units;
- ISO currency;
- billing interval (`monthly`, `yearly`, `one_time`, `custom`);
- effective dates;
- public/self-service availability;
- optional metadata reference for later entitlement/limit mapping.

New pricing creates a new plan version.

### Billing subscription

Tenant-scoped relationship to one plan version.

Core lifecycle:

```text
trialing
active
past_due
paused
cancel_at_period_end
cancelled
```

Required recurring fields include:

- current period start/end;
- renewal mode;
- `autoRenew` preference;
- optional grace-period end;
- optional provider customer/subscription references;
- cancellation timestamps/reason where applicable.

### Billing period

Concrete charge window for a subscription:

- period start/end;
- amount due in minor units;
- currency;
- due timestamp;
- collection state;
- settlement totals derived from immutable entries.

### Checkout

A disposable provider-facing attempt to pay a billing period.

Lifecycle:

```text
created
pending
completed
expired
cancelled
```

A redirect/success page never proves payment.

### Settlement

Normalized verified money event from a gateway or authorized manual source.

Lifecycle:

```text
received
verified
applied
rejected
reversed
```

Normalized shape:

```text
provider
providerPaymentId
providerEventId
subscriptionId
billingPeriodId
amountExpectedMinor
currencyExpected
amountPaidMinor
currencyPaid
status
occurredAt
rawReference
```

Provider payloads are not the domain model.

### Ledger entry

Append-only accounting consequence.

Initial entry types:

```text
charge
payment
credit
debit_adjustment
credit_adjustment
waiver
refund
reversal
```

Corrections use compensating entries. Existing entries are never destructively edited to change financial history.

### Manual adjustment

Privileged command with:

- tenant;
- actor;
- amount/currency;
- adjustment type;
- reason;
- external/reference evidence where supplied;
- idempotency key;
- audit timestamps.

It produces ledger effects through the same Billing service boundary rather than mutating balances directly.

## Money representation

All monetary amounts are stored as integer minor units plus ISO currency code.

Never use floating-point values for persisted monetary arithmetic.

Currency conversion, if needed later, must be represented as explicit quoted amounts/rates and separate ledger effects rather than silently changing stored amounts.

## Idempotency and integrity

Required protections:

- unique `(provider, providerEventId)` when a provider event ID exists;
- duplicate application protection for `(provider, providerPaymentId, settlement class/type)`;
- unique manual-adjustment command/idempotency key;
- a settlement can produce ledger effects only once unless an explicit reversal/compensating event is recorded;
- checkout completion cannot itself create entitlement access;
- ledger entries are append-only;
- tenant IDs are explicit on all tenant-owned billing rows or derivable through an enforced foreign-key chain.

## Gateway adapter contract

The Billing core defines one provider-neutral adapter contract with responsibilities equivalent to:

```text
createCheckout()
verifyIncomingEvent()
normalizeSettlement()
```

The core must not implement provider behavior through scattered checks such as:

```text
if provider == nowpayments
if provider == selar
```

Provider selection happens through adapter registration/resolution.

## Initial gateways

### Selar

First-class hosted checkout provider for supported card/local/mobile-money flows.

Automatic settlement is accepted only through a verifiable webhook/API confirmation path. A user returning to a browser success URL is never settlement proof.

Recurring behavior is capability-driven because supported payment methods may differ in whether automatic charging is available.

### NOWPayments

First-class crypto checkout provider.

Use the hardened contract from `mklms` as the security baseline:

- signature is mandatory;
- missing secrets fail closed;
- provider webhook verification occurs before normalization;
- automatic settlement uses final `finished` state only;
- non-final states such as `confirmed`, `sending` and `partially_paid` do not settle a billing period automatically.

## Recurring and renewal model

A monthly/yearly billing schedule does not imply automatic collection.

Each subscription carries a provider-neutral renewal mode:

```text
automatic
provider_managed
invoice_required
manual
```

Each gateway adapter exposes a capability descriptor, initially including:

```text
supportsRecurring
supportsAutoCharge
supportsHostedSubscription
supportsWebhookVerification
supportsRefunds
supportsPartialPayment
supportsMultipleCurrencies
```

The renewal engine chooses behavior by capability, not gateway name.

Examples:

```text
Gateway/payment method supports verified auto-charge
-> automatic/provider_managed
-> renewal attempt
-> verified settlement
-> next period becomes paid/active

Gateway supports recurring invoice but not reliable auto-charge
-> invoice_required
-> create renewal checkout/invoice
-> verified settlement
-> next period becomes paid/active

Gateway/payment method cannot reliably recur
-> manual
-> create next billing period
-> expose/send renewal checkout or accept authorized manual settlement
-> grace-period policy applies until paid
```

Subscription controls from the first milestone:

- `autoRenew` preference;
- `cancelAtPeriodEnd` behavior;
- `currentPeriodStart` / `currentPeriodEnd`;
- configurable grace-period representation;
- renewal attempt history separate from settlements;
- external provider subscription/customer references as non-authoritative identifiers;
- graceful fallback from auto-charge to invoice/manual where supported by policy.

A complex retry/dunning engine is deferred, but the data model must support future attempts and outcomes.

## Manual/offline settlement

Manual payment is a settlement source, not a fake gateway.

Authorized operators may record:

- offline bank transfer;
- enterprise invoice settlement;
- negotiated credit/waiver;
- migration carry-over balance;
- exceptional operational correction.

Every manual action requires actor, reason, idempotency key and audit history.

## Subscription vs payment state separation

Subscription state and payment state are intentionally distinct.

A payment attempt may fail while a subscription remains in grace period. A subscription may be trialing without any payment. A verified payment may be recorded before a scheduled period transition.

Only Billing service rules may translate ledger/settlement state into subscription lifecycle changes.

## Entitlements boundary

The next Entitlements subsystem consumes Mkety Billing state, not gateway state and not CMS pricing content.

Expected future dependency:

```text
Billing service -> normalized subscription commercial state -> Entitlements
```

Entitlements must never ask Selar or NOWPayments whether a user has access.

## Public pricing/CMS boundary

Public pricing content may describe plans, labels, prices and marketing claims.

CMS content cannot mutate:

- ledger entries;
- subscription lifecycle;
- provider credentials;
- settlement secrets;
- entitlement enforcement;
- tenant isolation;
- usage/credit balances.

## Security requirements

- gateway secrets remain server/infrastructure-only;
- webhook verification fails closed;
- no provider secret is stored in tenant-editable fields;
- tenant authorization uses current Mkety DB-backed membership/RBAC;
- privileged manual adjustments require explicit authorization and auditability;
- external references are bounded strings and validated;
- raw provider payload retention, if later enabled, must be bounded/redacted and must never store secrets unnecessarily;
- no production deployment or credential mutation is part of this milestone.

## Migration sequencing

The active downstream baseline currently owns:

```text
0009_mkety_auth
0010_automation_webhook_trigger
```

Billing must become the next application migration only after generating/reconciling Drizzle metadata correctly against the current branch. The migration baseline guard and `drizzle-kit check` remain mandatory, and subsequent generation must be a no-op.

## Testing requirements

TDD is mandatory for behavior changes.

Coverage must include at minimum:

- money/minor-unit invariants;
- subscription lifecycle transitions;
- renewal-mode/capability resolution;
- settlement idempotency;
- rejection of unverified/non-final settlements;
- duplicate provider events;
- ledger append-only/compensating semantics;
- manual adjustment authorization/service invariants;
- tenant isolation;
- migration baseline integrity;
- full existing test/type/lint/vinext/build gates.

## First milestone completion definition

Billing Core Foundation is complete when:

1. schema and migration exist for the approved domain model;
2. provider-neutral Billing domain/service interfaces exist;
3. Selar and NOWPayments capability adapters are represented without live secret deployment;
4. normalized settlement application is idempotent and produces immutable ledger effects;
5. recurring renewal policy resolves to automatic/provider-managed/invoice/manual based on capabilities and subscription preference;
6. authorized manual settlement/adjustment exists behind the service boundary;
7. tenant-scoped read models/API needed for the future Billing UI are available;
8. all migration and repository verification gates pass;
9. no production provider credentials or production deployment are changed;
10. Entitlements can be implemented next without reading gateway-specific state.
