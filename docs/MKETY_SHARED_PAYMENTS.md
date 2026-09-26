# Mkety Shared Payments

## Status

**Architecture update:** September 26, 2026

This document is the operational source of truth for the shared Mkety payment boundary in `mksaas`.

The active provider set is:

- **NOWPayments** — primary/default crypto path.
- **Flutterwave v3** — Inline for Mkety-owned checkout pages; v3 Standard API only for the central cross-product broker where a hosted link is required.
- **Kora Checkout Standard** — provider-controlled checkout embedded inside Mkety-owned payment pages.

Selar is not an active Mkety payment provider.

Flutterwave v4 is not part of the active runtime. Flutterwave's current platform guidance states that an account/integration uses one API version at a time, so Mkety must not run v3 and v4 in parallel. A future v4 move is a deliberate migration/replacement project.

## Core rules

1. Mkety owns canonical commercial prices and payment references.
2. Browser return, callback UI, or modal success is never proof of payment.
3. Provider webhook signatures are verified before routing.
4. Provider transactions/charges are re-queried server-side where the provider contract requires it.
5. Reference, status, amount, and currency must match Mkety's stored checkout/order state before settlement.
6. Settlement is idempotent and applies through the owning Billing/Enterprise ledger.
7. Provider secrets are server-only.
8. Mkety never collects or stores raw card details.
9. Products must use the shared payment boundary rather than owning independent provider credentials and settlement logic.
10. NOWPayments behavior remains unchanged unless a separate payment migration explicitly changes it.

## High-level topology

```text
Mkety product / checkout
        |
        v
Shared Mkety payment boundary
        |
        +-- NOWPayments ------> hosted invoice / crypto flow
        |
        +-- Flutterwave v3 ---> Inline on Mkety-owned pages
        |                       or Standard hosted link for broker clients
        |
        +-- Kora -------------> Checkout Standard iframe/modal on Mkety pages
        |
        v
verified webhook + server re-query
        |
        +-- SaaS ----------> MkSaaS Billing ledger / Entitlements
        +-- Enterprise ----> MkSaaS Enterprise order ledger
        +-- Media ---------> verified forwarding to Media-owned ledger
        +-- Host ----------> verified forwarding to Host-owned ledger
```

## Provider availability

### NOWPayments — primary/default

Available when:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

Self-service SaaS checkout uses the existing NOWPayments invoice flow. Enterprise uses the existing admin-issued exact-amount NOWPayments flow. Existing IPN verification and final-`finished` settlement semantics remain authoritative.

### Flutterwave v3

Mkety-owned Inline checkout is available only when all of the following exist:

```text
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
```

The optional cross-product hosted-checkout broker additionally requires:

```text
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

The public key is safe to pass to Flutterwave Inline. The secret key and webhook hash stay server-side.

### Kora

Kora checkout is available only when both values exist:

```text
KORA_PUBLIC_KEY
KORA_SECRET_KEY
```

The public key is passed to Kora's provider-controlled Checkout Standard UI. The secret key remains server-side for verification/re-query.

## Mkety-owned checkout UX

### Flutterwave Inline

Mkety self-service and Enterprise Flutterwave payments start on Mkety-owned pages.

The server:

1. creates/persists the Mkety checkout or Enterprise order;
2. creates the canonical Mkety payment reference;
3. resolves the exact provider amount/currency;
4. generates Flutterwave's `payload_hash` using the server-only secret key;
5. renders only the public checkout payload to the browser.

The browser then loads:

```text
https://checkout.flutterwave.com/v3.js
```

and opens `FlutterwaveCheckout(...)` over the Mkety payment page.

The user therefore remains visually inside Mkety while sensitive card/bank/payment UI is controlled by Flutterwave.

The success/redirect path is informational only. It never activates subscription access or confirms an Enterprise order.

### Kora embedded Checkout Standard

Mkety self-service and Enterprise Kora payments also start on Mkety-owned pages.

The browser loads Kora Checkout Standard with the public key and an Mkety-generated reference. The checkout is rendered into the Mkety page through Kora's provider-controlled iframe/container support.

The Kora success/pending/failed/close callbacks update only the customer-facing state. They do not settle payment.

## Flutterwave v3 Standard broker

Some independently deployed Mkety products cannot render the central Mkety Inline page and instead require a hosted provider link.

For that compatibility boundary only, the central broker remains:

```text
POST https://mkety.com/api/payments/flutterwave/start
```

Authenticated callers use `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`.

The broker:

- validates the Mkety-owned reference and source;
- rejects customer/provider-selected callback destinations;
- resolves the provider quote from the same database-managed Mkety payment settings;
- creates a Flutterwave v3 Standard hosted checkout through `/v3/payments`;
- returns the hosted link and exact provider quote.

This is still one Flutterwave **v3** integration. It is not a parallel v4 control plane.

## Flutterwave webhooks

Canonical endpoint:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

The active webhook contract is v3/Standard:

- verify `verif-hash` against `FLUTTERWAVE_STANDARD_WEBHOOK_HASH`;
- parse only verified JSON;
- ignore unrelated event types safely;
- for `charge.completed`, re-query:
  ```text
  GET https://api.flutterwave.com/v3/transactions/{transaction_id}/verify
  ```
- require webhook ID/reference/status/currency/amount to match the re-queried transaction;
- route the verified Mkety reference to its owning ledger.

For Media/Host forwarding, central Mkety additionally signs an attestation with `FLUTTERWAVE_CHECKOUT_BROKER_SECRET` before forwarding the unchanged provider payload/signature to the configured product webhook.

Unknown references fail closed.

## Kora webhooks

Canonical endpoint:

```text
https://mkety.com/api/payments/kora/webhook
```

Mkety:

1. verifies the Kora webhook signature with `KORA_SECRET_KEY`;
2. re-queries the charge by the Mkety reference;
3. verifies the returned reference/status;
4. routes only known Mkety references;
5. verifies the stored expected amount/currency before applying value.

Media/Host forwarding remains server-configured. Provider/customer metadata cannot choose arbitrary webhook destinations.

## Canonical pricing and collection currency

Mkety self-service plan prices remain canonically USD.

USD is always available for Flutterwave.

Non-USD Flutterwave collection is available only when an approved commercial rate exists in the Mkety database-backed Payments control surface.

Current supported collection-currency contract:

```text
USD
NGN
GHS
KES
GBP
EUR
ZAR
XAF
XOF
UGX
RWF
TZS
MWK
EGP
```

The presence of a currency in the code contract does not mean it is automatically shown. A non-USD currency is shown only when an approved rate exists.

Flutterwave then determines which actual payment rails are available for that selected currency and merchant account.

## Payment settings authority

Business payment configuration is managed in:

```text
Platform Control -> Payments
```

The configuration is stored in the existing `platform_app_control_center_modules.metadata_json` record for the `payments` module.

Current editable business settings include:

- Flutterwave commercial FX rate per supported non-USD currency;
- Flutterwave FX markup in basis points.

Runtime secrets are **not** stored in that database record.

The old `MKETY_PAYMENT_FX_RATES_JSON` environment variable is retired and must not be restored as a second pricing authority.

### FX quote rule

For a canonical USD amount:

- USD collection is identity pricing;
- non-USD collection multiplies by the configured commercial rate;
- the configured markup is then applied;
- the result is rounded upward to the smallest provider currency unit so Mkety is not silently under-collected;
- the exact provider amount/currency is persisted with the checkout.

On settlement, Mkety verifies the paid provider amount/currency against that stored provider quote before applying canonical USD billing value.

## Self-service SaaS flow

```text
Pricing
  -> sign in / create workspace
  -> authenticated Mkety checkout
  -> select prepaid term
  -> select configured provider
  -> provider checkout
  -> provider webhook
  -> server verification/re-query
  -> idempotent Billing settlement
  -> Entitlements/access
```

The browser cannot submit or override the canonical plan price.

For Flutterwave, the user may select only collection currencies enabled by approved database rates.

## Enterprise flow

Enterprise payment links remain admin-issued exact-amount payments.

The Mkety operator sets:

- customer/company details;
- agreed project/scope;
- exact USD amount;
- payment stage/installment;
- provider.

The customer cannot edit the commercial amount.

Provider behavior:

- NOWPayments -> secure invoice/link;
- Flutterwave -> Mkety Enterprise payment page + Flutterwave Inline;
- Kora -> Mkety Enterprise payment page + embedded Kora Checkout Standard.

Enterprise payment remains pending until verified settlement. Creating or paying a link does not automatically grant a subscription, credits, wallet funds, infrastructure, or workspace entitlements.

## Shared references

Canonical Mkety reference prefixes include:

```text
SAAS-MKS-*
MEDIA-MKM-*
HOST-MKH-*
ENT-MKE-*
```

Existing Media `MKM-*` references remain supported for compatibility where explicitly handled.

Reference ownership is authoritative. Provider metadata may confirm ownership but must never override a conflicting or unknown reference.

## Runtime variables

### Required primary payment path

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

### Optional Flutterwave v3

```text
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

### Optional Kora

```text
KORA_PUBLIC_KEY
KORA_SECRET_KEY
```

### Optional server-owned forwarding destinations

```text
MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL
MKETY_MEDIA_KORA_WEBHOOK_URL
MKETY_HOST_FLUTTERWAVE_WEBHOOK_URL
MKETY_HOST_KORA_WEBHOOK_URL
```

Do not add Flutterwave v4 `CLIENT_ID` / `CLIENT_SECRET` / v4 webhook credentials to the active runtime while v3 is in use.

## Production verification

Before promotion of payment changes:

1. run focused payment tests;
2. run full test/typecheck/lint/build gates;
3. run migration integrity checks;
4. seed/smoke Platform Control so the `payments` module exists;
5. verify NOWPayments read-only credential health without creating a CI payment;
6. verify missing/invalid Flutterwave and Kora webhook signatures fail closed;
7. verify enabled provider pages do not expose secret keys;
8. verify browser success/return does not grant value;
9. verify provider amount/currency/reference mismatches are rejected;
10. verify Media/Host forwarding remains restricted to server-owned destinations;
11. verify exact-head candidate deployment before production promotion.

## Future Flutterwave v4 migration

A future v4 migration may be appropriate, but it must be done as a controlled replacement:

1. confirm v4 supports every required Mkety payment method and product handoff;
2. build the v4 equivalents behind tests;
3. migrate webhooks/verification and provider credentials together;
4. remove the v3 runtime only when the complete replacement is ready;
5. do not operate both versions as normal production payment paths on the same Flutterwave integration.

Until that migration is explicitly approved and implemented, the authoritative Flutterwave architecture is v3.
