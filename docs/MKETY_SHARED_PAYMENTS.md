# Mkety Shared Payments

## Status

**Architecture update:** September 26, 2026

This document is the operational source of truth for the shared Mkety payment boundary in `mksaas`.

The active provider set is:

- **NOWPayments** — primary/default crypto path.
- **Flutterwave v3** — centralized behind the Mkety checkout broker. Mkety-owned products and external Mkety products use the same broker contract; the broker may return Inline or hosted checkout as requested.
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
10. NOWPayments invoices use canonical short Mkety references (`SAAS-MKS-*`, `ENT-MKE-*`, etc.); legacy billing references remain accepted only for settlement compatibility.

## High-level topology

```text
Mkety product / checkout
        |
        v
Shared Mkety payment boundary
        |
        +-- NOWPayments ------> hosted invoice / crypto flow
        |
        +-- Flutterwave v3 ---> central broker
        |                       -> Inline or Standard hosted checkout
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
        +-- Assist --------> verified forwarding to Assist-owned credit ledger
```

## Provider availability

### NOWPayments — primary/default

Available when:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

Self-service SaaS checkout and Enterprise exact-amount checkout use the same NOWPayments invoice contract proven by Mkety Media: a short Mkety-owned order reference, provider invoice ID, hosted invoice URL, and Mkety embedded widget page. Existing IPN verification and final-`finished` settlement semantics remain authoritative.

### Flutterwave v3

Flutterwave checkout is available only through the shared Mkety broker boundary. The central broker runtime requires:

```text
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

Product runtimes such as `app.mkety.com` only need the shared broker secret to request a checkout from the central `mkety.com` payment service. The provider secret key and webhook hash stay on the central payment authority.

### Kora

Kora checkout is available only when both values exist:

```text
KORA_PUBLIC_KEY
KORA_SECRET_KEY
```

The public key is passed to Kora's provider-controlled Checkout Standard UI. The secret key remains server-side for verification/re-query.

## Mkety-owned checkout UX

### Flutterwave shared broker

Mkety self-service, Enterprise AI, public Enterprise, and Mkety Media use the same central Flutterwave payment authority.

The product server:

1. creates/persists the Mkety checkout or Enterprise order;
2. creates the canonical Mkety payment reference;
3. calls `POST https://mkety.com/api/payments/flutterwave/start` with `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`;
4. sends canonical USD value, requested collection currency, customer identity, owning checkout/order IDs, and an allow-listed Mkety redirect;
5. receives the exact provider quote and either an Inline payload or hosted checkout URL.

Mkety Media requests Inline and loads Flutterwave's official browser SDK. Main Mkety billing, Enterprise AI, public Enterprise, and Media request the broker-issued Inline experience and launch Flutterwave's official SDK from a Mkety page. If the broker returns a hosted fallback instead, the Mkety page redirects to that provider URL. All paths use the same central quote, reference, secret ownership, webhook verification, and settlement router.

The success/redirect path is informational only. It never activates subscription access or confirms an Enterprise order.

### Kora embedded Checkout Standard

Mkety self-service and Enterprise Kora payments also start on Mkety-owned pages.

The browser loads Kora Checkout Standard with the public key and an Mkety-generated reference. The checkout is rendered into the Mkety page through Kora's provider-controlled iframe/container support.

The Kora success/pending/failed/close callbacks update only the customer-facing state. They do not settle payment.

## Flutterwave v3 central broker

The central broker is the payment boundary for Mkety Platform, Enterprise AI, public Enterprise, Media, Host, and Assist. Products do not create Flutterwave provider checkouts directly.

The canonical broker remains:

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

For Media/Host/Assist forwarding, central Mkety additionally signs an attestation with `FLUTTERWAVE_CHECKOUT_BROKER_SECRET` before forwarding the unchanged provider payload/signature to the configured product webhook. Assist accepts Flutterwave settlement only at its stable provider-owned endpoint and grants credits from its own stored checkout row, never from webhook-supplied credit metadata.

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

- NOWPayments -> canonical short Mkety reference -> provider invoice -> embedded Mkety widget page with hosted-link fallback;
- Flutterwave -> central Mkety broker -> provider-hosted checkout (or broker-issued Inline payload where that product deliberately uses Inline);
- Kora -> Mkety Enterprise payment page + embedded Kora Checkout Standard.

Enterprise payment remains pending until verified settlement. Creating or paying a link does not automatically grant a subscription, credits, wallet funds, infrastructure, or workspace entitlements.

## Shared references

Canonical Mkety reference prefixes include:

```text
SAAS-MKS-*
MEDIA-MKM-*
HOST-MKH-*
ASSIST-MKA-*
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

## Flutterwave payment-method availability

Mkety v3 checkout deliberately does **not** send a per-transaction `payment_options` allow-list. Flutterwave Dashboard payment-method settings remain authoritative, so every method enabled for the merchant account can appear when valid for the selected collection currency, customer, device and region. Methods that are still under Flutterwave review must not be faked as live; once Flutterwave approves/enables them in the account, Mkety checkout can surface them without an application change.

Platform Control presents the intended method families (cards, bank transfer, mobile money, pay-with-bank, wallets and local alternatives) as a coverage catalogue. The catalogue is descriptive only and never narrows the provider checkout. Currency selection remains driven by Mkety's configured commercial FX quotes, while Flutterwave performs the final payment-rail eligibility filtering.
