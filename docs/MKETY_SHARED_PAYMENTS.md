# Mkety Shared Payments

## Status

This document is the source of truth for Mkety's shared payment architecture across the main Mkety platform, Mkety Media, and future Mkety products.

### Completed in code

- NOWPayments remains the primary/default crypto checkout.
- Kora is a hosted fiat provider and appears only when its server credential is configured.
- Flutterwave has one central Mkety webhook:
  - `https://mkety.com/api/payments/flutterwave/webhook`
- Flutterwave has one central product checkout broker:
  - `https://mkety.com/api/payments/flutterwave/start`
- Flutterwave supports two explicit, mutually exclusive account modes:
  - `v4`
  - `v3-hosted`
- Mkety owns the payment reference and product-routing metadata.
- Mkety Media can share the same Flutterwave merchant account and central webhook.
- The central webhook verifies Flutterwave first, re-queries the provider transaction, resolves the owning Mkety product, and then:
  - settles MkSaaS/Enterprise locally; or
  - forwards the unchanged original provider webhook body and signature to the owning external Mkety product.
- Media's existing `media-platform` implementation can independently verify either:
  - v4 `flutterwave-signature`; or
  - v3 `verif-hash`.
- Mkety billing stores both:
  - canonical plan amount/currency; and
  - provider settlement amount/currency.
- Canonical self-service plan pricing remains USD.
- Flutterwave hosted checkout can offer configured local settlement currencies:
  - USD
  - NGN
  - GHS
  - KES
  - GBP
  - EUR
- The customer can choose the settlement currency instead of being forced by IP/location.
- Conversion is server-owned and based only on explicit Mkety rates.
- A local currency is hidden when no Mkety rate is configured.
- Browser redirects never activate access by themselves.
- Provider webhooks and provider API re-query remain authoritative for settlement.

### Configuration still required before live use

The code intentionally does not invent or hard-code production credentials.

For the current Flutterwave account, choose exactly one account mode:

#### Option A — keep the account on Flutterwave v4

Use:

```text
FLUTTERWAVE_API_MODE=v4
FLUTTERWAVE_CLIENT_ID=...
FLUTTERWAVE_CLIENT_SECRET=...
FLUTTERWAVE_WEBHOOK_SECRET=...
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=...
```

This enables:

- OAuth2 access-token management;
- v4 HMAC webhook verification;
- provider charge re-query;
- central product routing;
- Media shared-account webhook forwarding;
- the authenticated central checkout-broker contract.

The customer-facing Flutterwave hosted all-method checkout button remains hidden in this mode because Flutterwave's current v4 model requires an explicit payment method and does not expose the old v3 Standard method-agnostic hosted checkout.

To collect directly in v4, Mkety must implement the selected v4 payment methods/orchestrator UX. Mkety must not silently collect raw card details or pretend that the v3 Standard page exists in v4 mode.

#### Option B — use Flutterwave hosted Standard checkout

Switch the Flutterwave account/API integration to v3 and configure:

```text
FLUTTERWAVE_API_MODE=v3-hosted
FLUTTERWAVE_V3_SECRET_KEY=...
FLUTTERWAVE_V3_SECRET_HASH=...
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=...
```

In this mode:

- Flutterwave appears as a hosted fiat checkout method.
- MkSaaS customers can choose the payment currency before checkout.
- Flutterwave Standard opens the secure Flutterwave-hosted payment page.
- Flutterwave displays the payment methods applicable to the selected transaction currency and merchant-account configuration.
- The same central webhook endpoint receives the v3 event using `verif-hash`.
- The event is independently re-queried before value is granted.
- Media can receive the unchanged v3 webhook because its current implementation already supports the fallback.

Flutterwave's current documentation states that an account uses either v3 or v4, not both simultaneously. The application therefore uses `FLUTTERWAVE_API_MODE` to prevent an invalid mixed state.

## Provider priority

Customer-facing payment order should remain:

1. NOWPayments — primary/default crypto
2. Flutterwave — additional fiat when fully configured for the active account mode
3. Kora — additional hosted fiat when configured

Kora does not appear until:

```text
KORA_SECRET_KEY=...
```

## Mkety-owned references

All shared-account transactions must carry a Mkety-owned reference.

Examples:

```text
SAAS-MKS-94JX26
MEDIA-MKM-A83K27
HOST-MKH-8G7P21
ENT-MKE-...
```

UUID-backed MkSaaS checkout references compact the UUID so the reference remains within provider reference limits.

Mkety Media already has live/current invoice references such as:

```text
MKM-XXXXXXXXXX
```

Those existing references are preserved. The central router accepts `MKM-*` only when the independently verified provider metadata also says:

```json
{
  "source": "media"
}
```

Reference and metadata must not conflict.

## Mkety-owned metadata

Where the provider supports metadata, include explicit ownership fields.

### Media

```json
{
  "source": "media",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id"
}
```

### Main MkSaaS

```json
{
  "source": "saas",
  "checkout_id": "billing-checkout-id",
  "tenant_id": "tenant-id"
}
```

### Enterprise

```json
{
  "source": "enterprise",
  "order_id": "enterprise-order-id"
}
```

Provider metadata never controls the forwarding URL. Destination URLs are server-owned Mkety configuration.

## One central Flutterwave webhook

Configure the Flutterwave dashboard webhook as:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

Do not configure the Flutterwave dashboard directly to `media.mkety.com` when using the shared-account model.

### v4 Media flow

```text
Flutterwave
  ↓
mkety.com/api/payments/flutterwave/webhook
  ↓
verify HMAC-SHA256/Base64 flutterwave-signature over raw body
  ↓
re-query charge from Flutterwave v4
  ↓
resolve source=media from reference + verified metadata
  ↓
forward ORIGINAL raw body + ORIGINAL flutterwave-signature
  ↓
media.mkety.com/api/billing/flutterwave/webhook
  ↓
Media verifies the same v4 signature again
  ↓
Media re-queries the charge again
  ↓
Media verifies invoice reference/currency/amount
  ↓
Media settles its own invoice/subscription idempotently
```

### v3-hosted Media flow

```text
Flutterwave Standard
  ↓
mkety.com/api/payments/flutterwave/webhook
  ↓
verify verif-hash
  ↓
re-query v3 transaction
  ↓
resolve source=media
  ↓
forward ORIGINAL raw body + ORIGINAL verif-hash
  ↓
media.mkety.com/api/billing/flutterwave/webhook
  ↓
Media verifies verif-hash again
  ↓
Media re-queries the v3 transaction again
  ↓
Media settles its own invoice/subscription idempotently
```

Default Media forwarding destination:

```text
https://media.mkety.com/api/billing/flutterwave/webhook
```

Optional server-side override:

```text
MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL=...
```

## Central Flutterwave checkout broker

Approved Mkety products can call:

```text
POST https://mkety.com/api/payments/flutterwave/start
Authorization: Bearer <FLUTTERWAVE_CHECKOUT_BROKER_SECRET>
Content-Type: application/json
```

Example Media request:

```json
{
  "source": "media",
  "reference": "MKM-A83K27",
  "amount": 39.99,
  "currency": "USD",
  "email": "customer@example.com",
  "customer_name": "Customer business",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id",
  "redirect_url": "https://media.mkety.com/billing?payment=processing&provider=flutterwave"
}
```

The broker validates:

- internal broker authentication;
- Mkety product source;
- reference format;
- reference/metadata ownership consistency;
- amount range;
- currency format;
- customer email;
- source-owned HTTPS redirect URL.

### Broker behavior in v4

The broker validates the handoff but returns a fail-closed response until a concrete v4 payment method has been selected/implemented.

### Broker behavior in v3-hosted

The broker creates Flutterwave Standard checkout server-side and returns:

```json
{
  "success": true,
  "checkout_url": "https://...",
  "url": "https://...",
  "reference": "MKM-A83K27"
}
```

No Flutterwave secret key is exposed to the calling product or browser.

## Canonical price vs settlement price

Mkety's product price remains canonical.

Example:

```text
Starter
Canonical Mkety amount: USD 5.99
```

A specific hosted Flutterwave checkout may instead collect:

```text
NGN 9,464.20
```

The billing checkout therefore records two distinct values:

```text
canonical amount: 599
canonical currency: USD

settlement expected amount: 946420
settlement currency: NGN
```

On webhook settlement:

1. Mkety verifies Flutterwave/Kora actually collected the exact provider settlement amount/currency.
2. Only after that verification does Mkety apply the canonical USD billing value to the subscription ledger.
3. A browser return or different local amount cannot activate the subscription.

This prevents FX presentation from changing the Mkety product catalog.

## Currency/payment-country layer

Mkety does not rely solely on IP geolocation.

When Flutterwave hosted checkout is active, the customer can choose from the currencies that Mkety has explicitly enabled.

Supported Mkety settlement-currency choices:

```text
USD — US Dollar
NGN — Nigerian Naira
GHS — Ghanaian Cedi
KES — Kenyan Shilling
GBP — British Pound
EUR — Euro
```

USD is always available.

Local currencies are enabled only through:

```text
MKETY_FLUTTERWAVE_USD_RATES_JSON
```

Example:

```json
{
  "NGN": "1580",
  "GHS": "15.40",
  "KES": "129.50",
  "GBP": "0.75",
  "EUR": "0.85"
}
```

These rates mean:

```text
1 USD = configured local-currency amount
```

The conversion is calculated server-side and rounded to the currency's minor unit.

Mkety does not currently use Flutterwave payout/transfer FX rates as subscription-pricing rates because those APIs are not documented as a collection-pricing quote contract.

A currency with no configured rate is hidden.

## Payment methods by currency

Flutterwave's hosted checkout filters payment methods according to the transaction currency and what is enabled on the merchant account.

Examples from Flutterwave's current payment-method documentation include:

- NGN: card, USSD, bank transfer, account, internet banking, NQR, eNaira, OPay
- GHS: card, Ghana mobile money
- KES: card, M-Pesa
- GBP: card/account methods
- EUR: card/account methods
- USD: supported card/account methods depending on merchant configuration

Mkety does not hard-code that every listed method is available to the merchant. Flutterwave remains responsible for displaying only methods valid for the selected currency/account configuration.

## Hosted checkout security

In `v3-hosted` mode, Mkety creates Standard checkout on the server.

Mkety sends:

- amount;
- currency;
- unique Mkety reference;
- redirect URL;
- customer email/name;
- Mkety metadata;
- Mkety branding;
- Flutterwave payload hash.

The payload hash is generated server-side from the immutable checkout fields and secret key.

Mkety never receives card PAN/CVV/expiry in hosted mode.

## v4 security boundary

In `v4` mode:

- OAuth access tokens are generated server-side from Client ID + Client Secret.
- Tokens are cached only until shortly before their short expiry.
- Webhooks are verified using HMAC-SHA256 over the unchanged raw request body and compared with `flutterwave-signature`.
- Mkety re-queries the charge before fulfillment.
- External Mkety products receive the original raw event and original signature.
- Mkety does not collect direct card details merely to imitate the v3 hosted UI.

## Kora

Kora remains independent from Flutterwave.

When:

```text
KORA_SECRET_KEY=...
```

is configured, Mkety can expose Kora hosted checkout.

Kora settlement follows the same rules:

1. verify Kora webhook signature;
2. re-query charge by reference;
3. resolve Mkety source;
4. verify expected amount/currency;
5. settle locally or forward the unchanged provider event to the owning Mkety product.

Central Kora webhook:

```text
https://mkety.com/api/payments/kora/webhook
```

Default Media Kora destination:

```text
https://media.mkety.com/api/billing/kora/webhook
```

## Environment reference

### Common

```text
NOWPAYMENTS_API_KEY=
NOWPAYMENTS_IPN_SECRET=

FLUTTERWAVE_API_MODE=v4
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=
MKETY_FLUTTERWAVE_USD_RATES_JSON=

KORA_SECRET_KEY=

MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL=https://media.mkety.com/api/billing/flutterwave/webhook
MKETY_MEDIA_KORA_WEBHOOK_URL=https://media.mkety.com/api/billing/kora/webhook
```

### Flutterwave v4

```text
FLUTTERWAVE_API_MODE=v4
FLUTTERWAVE_CLIENT_ID=
FLUTTERWAVE_CLIENT_SECRET=
FLUTTERWAVE_WEBHOOK_SECRET=
```

### Flutterwave hosted Standard

```text
FLUTTERWAVE_API_MODE=v3-hosted
FLUTTERWAVE_V3_SECRET_KEY=
FLUTTERWAVE_V3_SECRET_HASH=
```

## Media environment

Media's current branch already understands both Flutterwave modes.

Common:

```text
FLUTTERWAVE_CHECKOUT_BROKER_URL=https://mkety.com/api/payments/flutterwave/start
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=<same internal Mkety secret>
```

For v4:

```text
FLUTTERWAVE_CLIENT_ID=
FLUTTERWAVE_CLIENT_SECRET=
FLUTTERWAVE_WEBHOOK_SECRET=
```

For its existing v3 fallback:

```text
FLUTTERWAVE_V3_SECRET_KEY=
FLUTTERWAVE_V3_SECRET_HASH=
```

The central and Media services must match the actual Flutterwave account/API mode.

## Security rules

- Never activate a plan from a return URL.
- Never trust provider metadata until the provider event itself is authenticated.
- Never trust a webhook amount/currency without provider API re-query.
- Never accept forwarding destinations from provider/customer input.
- Never expose provider secrets to the browser.
- Never accept client-calculated FX amounts.
- Never silently switch a selected provider to another provider.
- Never show a provider when the credentials required for that mode are incomplete.
- Never treat a different settlement currency as a change to the canonical Mkety plan price.
- Keep settlement processing idempotent.

## Operational checklist

### Current v4 account

- [x] Central v4 OAuth helper implemented.
- [x] Short-lived token reuse/refresh implemented.
- [x] Central v4 webhook HMAC verification implemented.
- [x] Central charge re-query implemented.
- [x] Mkety reference + metadata router implemented.
- [x] Media raw-body/signature forwarding implemented.
- [x] Media current `MKM-*` compatibility implemented.
- [x] Currency/settlement ledger implemented.
- [x] Broker authentication implemented.
- [ ] Add real production v4 credentials to deployment secrets.
- [ ] Add the same webhook secret to Media.
- [ ] Configure Flutterwave dashboard webhook to the central Mkety URL.
- [ ] Choose/implement concrete customer-facing v4 payment methods if staying on v4.

### Hosted all-method checkout path

- [x] Server-side Flutterwave Standard checkout implemented.
- [x] Customer currency selector implemented.
- [x] Explicit Mkety FX-rate configuration implemented.
- [x] Payload hash implemented.
- [x] v3 `verif-hash` central webhook verification implemented.
- [x] v3 transaction re-query implemented.
- [x] Media unchanged body + `verif-hash` forwarding implemented.
- [x] Media already has v3 webhook fallback support.
- [ ] Switch the Flutterwave account/API mode to v3 if this UX is chosen.
- [ ] Configure `FLUTTERWAVE_API_MODE=v3-hosted`.
- [ ] Configure the v3 secret key and webhook secret hash.
- [ ] Configure local FX rates that Mkety wants to offer.
- [ ] Confirm desired payment methods are enabled in the Flutterwave merchant dashboard.

### Kora

- [x] Kora hosted checkout adapter implemented.
- [x] Kora webhook verification/re-query routing implemented.
- [x] Provider visibility is environment-gated.
- [ ] Add `KORA_SECRET_KEY` after Kora verifies the account.
- [ ] Configure Kora webhook to `https://mkety.com/api/payments/kora/webhook`.
