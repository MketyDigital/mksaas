# Mkety Billing Architecture

## Status

This is the authoritative architectural decision for the next shared Platform billing milestone. Implementation begins only after the current Auth → migration/runtime → Webhooks → cleansing baseline is promoted.

Recommended implementation sequence:

```text
Billing → Entitlements → Usage/Credits
```

## Reuse the managed-hosting billing subsystem

Mkety must reuse the verified external managed-hosting billing Worker/provider contract maintained in `MketyDigital/mklms` rather than copying or rebuilding legacy payment-provider routes inside `mksaas`.

Before implementing billing in `mksaas`, audit the then-current `mklms` implementation and documentation. `mklms` remains the source of truth for that reusable managed-hosting billing contract; this document records the Platform integration rule.

Reference areas currently expected in `mklms`:

```text
workers/billing/
docs/deployment/external-managed-hosting-billing.md
src/app/api/managed-hosting/settlement/route.ts
```

Exact paths may evolve and must be reverified when implementation starts.

## Provider boundary

Payment-provider handling remains centralized outside customer deployments. Existing managed customers must not be forced to rotate provider credentials solely because Mkety Platform adopts the shared billing control plane.

Where the current reusable contract still uses NOWPayments, preserve the existing provider secret names unless the source-of-truth implementation has deliberately migrated them:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

Provider credentials are infrastructure secrets and must never be exposed to tenant UI, logs, source control, or CMS-editable content.

## Tenant/customer isolation

Each managed customer/tenant must have its own installation/tenant identity and settlement-authentication secret. Customer database passwords must not be stored in the billing Worker.

The initial external customer registry may be replaced by Mkety tenant/database-backed configuration during Platform integration, but isolation must remain explicit and fail closed.

## Settlement contract

The billing integration must preserve these invariants:

1. Provider webhooks/IPNs are cryptographically verified and fail closed.
2. Only final successful provider payment state is eligible for automatic settlement; for the current NOWPayments contract this is `finished` unless the source-of-truth provider contract changes.
3. Customer/tenant settlement callbacks are signed per tenant/customer.
4. Settlement is idempotent.
5. Billing ledger mutation occurs behind a Mkety-owned service boundary rather than directly from public routes or CMS content.
6. Manual/offline billing overrides remain possible for managed products with appropriate authorization and auditability.
7. Existing managed installations remain compatible during control-plane migration.

## Mkety Platform ownership

`mksaas` will own Platform-facing billing domain concepts such as plans, subscriptions, ledger-visible state, entitlements and usage/credits. The external payment/managed-hosting subsystem is a provider/infrastructure integration, not the source of truth for tenant authorization.

The intended boundary is:

```text
Payment provider / managed-hosting billing Worker
            ↓ signed/idempotent settlement contract
Mkety Billing domain
            ↓
Entitlements
            ↓
Usage / Credits enforcement and reporting
```

Entitlement checks must not depend on presentation-layer pricing content. Public pricing/CMS records may describe offers, but they cannot mutate ledger balances, entitlement enforcement, settlement secrets, provider credentials or tenant isolation rules.

## Implementation gate

Before Billing implementation starts:

- Auth must be promoted and provider-neutral session/authorization boundaries must be stable.
- Migration/runtime baseline must be clean.
- Automation Webhooks must be promoted or explicitly isolated from billing migration numbering.
- stale template/payment documentation must be cleansed.
- the current `mklms` billing contract must be re-audited rather than copied from historical notes.

This document supersedes the intent of stale PR #3 (`docs: reuse external managed-hosting billing contract`).
