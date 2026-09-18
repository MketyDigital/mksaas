# Mkety Billing Architecture

## Status

Mkety Billing in `MketyDigital/mksaas` is the authoritative billing architecture and implementation boundary for Mkety Platform.

The implemented domain sequence is:

```text
Billing → Entitlements → Usage/Credits
```

Historical external billing implementations may explain why some security rules exist, but they are no longer an implementation dependency or source of truth.

## Ownership

MKSaaS owns:

- plan identities and immutable plan versions;
- tenant subscriptions and billing periods;
- checkout attempts;
- verified settlements;
- append-only monetary ledger entries;
- renewal policy and renewal attempts;
- authorized manual adjustments;
- the Billing state consumed by Entitlements.

Payment providers are adapters only. They do not own subscription truth, entitlement truth, or tenant authorization.

## Provider boundary

Provider integrations must remain behind the MKSaaS Billing gateway/service boundary.

Current provider rules include:

- provider credentials remain server-side infrastructure secrets;
- browser success/return pages are never proof of payment;
- provider callbacks must fail closed when verification is missing or invalid;
- NOWPayments automatic settlement accepts only a final verified `finished` state;
- non-final states such as `confirmed`, `sending`, or `partially_paid` must not settle a billing period;
- settlement must be idempotent;
- provider-specific state must normalize into the shared MKSaaS settlement contract before monetary state changes.

## Settlement contract

The authoritative settlement flow is:

```text
Payment provider
      ↓ verified provider adapter
MKSaaS Billing gateway boundary
      ↓ normalized/idempotent settlement
MKSaaS Billing domain + ledger
      ↓
Entitlements
      ↓
Usage / Credits enforcement
```

Billing ledger mutation occurs only behind Mkety-owned service/repository boundaries. Public routes, CMS content, pricing presentation, browser redirects, and provider payloads cannot directly grant access.

## Tenant isolation

Every billing operation must be tenant-scoped. Subscription, billing-period, checkout, settlement, and ledger relationships must be validated against Mkety-owned database state before mutation.

Provider credentials and verification secrets must never be exposed to tenant UI, logs, source control, or CMS-editable content.

## Commercial presentation boundary

Public pricing/CMS records describe offers. They do not define authoritative money, settlement, entitlement, or tenant-access state.

Fixed prices used for checkout must resolve from authoritative MKSaaS billing records or a server-owned commercial mapping, never from customer-editable request amounts.

Enterprise negotiated payments remain a separate controlled commercial flow and must not be used as a shortcut around self-service Billing invariants.

## Rule for future work

All new Mkety Platform billing, checkout, settlement, renewal, entitlement-integration, and payment-provider work must extend the MKSaaS Billing implementation directly.

Do not route future Platform billing implementation through a legacy external repository or treat an external customer application as the source of truth.

Security behavior learned from historical systems may be retained as an invariant only when it is represented and tested inside MKSaaS.
