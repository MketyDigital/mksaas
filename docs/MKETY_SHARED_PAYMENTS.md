# Mkety Shared Payments

## Current production architecture

Mkety uses one shared payment boundary at `mkety.com` while each Mkety product keeps ownership of its own invoices, subscriptions, entitlements, and fulfilment.

Current provider priority:

1. NOWPayments — primary/default crypto path.
2. Flutterwave — additional fiat/local-payment path.
3. Kora — additional fiat/local-payment path when merchant verification and credentials are ready.

Provider visibility is environment-driven. A provider is not shown merely because code for it exists.

## Flutterwave version policy

The active Flutterwave integration is **v3 only**.

Flutterwave currently states that v3 and v4 should not be used simultaneously for the same integration. Mkety therefore does not mix v4 OAuth/webhook flows with v3 Inline/Standard settlement.

Active Flutterwave credentials:

```text
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

The public key is client-safe and is used only by Flutterwave Inline. The secret key, webhook hash, and broker secret remain server-side.

Reserved future v4 credentials may remain documented for a later full-version migration:

```text
FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET
```

They are **not part of the active runtime payment path**. A future v4 migration should replace the v3 provider adapter as one atomic version change; it should not run alongside v3.

## Why Inline is preferred

Mkety prefers Flutterwave Inline because it gives customers a smoother Mkety-branded journey while Flutterwave still owns the sensitive payment interface.

The customer journey is:

```text
Mkety checkout
   ↓
choose Flutterwave + payment currency
   ↓
Mkety locks reference / amount / currency / metadata
   ↓
mkety.com/pay/flutterwave?session=<opaque-id>
   ↓
Flutterwave Inline opens over Mkety
   ↓
customer pays with methods Flutterwave makes available
   ↓
Flutterwave webhook
   ↓
Mkety re-verifies transaction server-side
   ↓
settle owning Mkety product
```

Mkety never accepts raw card number, CVV, or expiry data.

Flutterwave Standard remains a same-v3 hosted fallback helper in code, but Inline is the preferred active experience.

## Shared ownership model

```text
Flutterwave / Kora / NOWPayments
             |
             v
       mkety.com
  shared payment boundary
             |
      +------+-------+---------+
      |              |         |
    SaaS          Enterprise  Media
      |              |         |
 MkSaaS ledger  order ledger   media.mkety.com
                                owns invoice,
                                subscription,
                                plan, activation
```

A provider account never decides product ownership. Mkety does.

## Mkety-owned references

Canonical new prefixes:

- SaaS: `SAAS-MKS-...`
- Media: `MEDIA-MKM-...`
- future Hosting: `HOST-MKH-...`
- Enterprise: `ENT-MKE-...`

Mkety Media already uses invoice references such as:

```text
MKM-A83K27
```

Those remain supported. A verified `MKM-*` reference routes to Media. If provider metadata is present and conflicts with the reference, the event is rejected.

## Provider metadata

Where supported, transactions also carry explicit Mkety metadata.

Media:

```json
{
  "source": "media",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id"
}
```

SaaS:

```json
{
  "source": "saas",
  "checkout_id": "billing-checkout-id",
  "tenant_id": "tenant-id"
}
```

Enterprise:

```json
{
  "source": "enterprise",
  "order_id": "MKETY-ENT-..."
}
```

Reference and metadata are consistency signals, not substitutes for provider verification.

## Flutterwave customer currency model

Mkety product prices remain canonically USD.

Flutterwave collection currency is separate. The current supported Mkety currency catalogue is:

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
EGP
MWK
```

Flutterwave ultimately determines which payment rails are available for the selected currency and merchant account.

Examples:

```text
NGN → card / bank transfer / USSD / other enabled NGN methods
GHS → card / Mobile Money where enabled
KES → card / M-Pesa where enabled
GBP/EUR/USD → applicable enabled methods
```

Mkety does not promise that every rail appears for every currency or account.

## FX configuration lives in Platform Control

FX is business configuration, not a secret.

Do **not** use an FX environment variable.

Platform Control → Enterprise Payments exposes:

- enabled Flutterwave collection currencies;
- one base rate per non-USD currency, expressed as local currency units per 1 USD;
- one optional global FX markup/buffer percentage.

Example:

```text
NGN  1 USD = 1600
GHS  1 USD = 15.50
KES  1 USD = 130
GBP  1 USD = 0.78
EUR  1 USD = 0.92

FX markup = 2%
```

Mkety rounds the final collection amount upward to the smallest supported two-decimal provider unit so the canonical price is never under-collected.

USD always uses a 1:1 rate and no markup.

A non-USD currency may be enabled before a rate is entered, but checkout fails closed for that currency until a valid rate exists.

Changing FX configuration does not require a code deployment.

## Local-currency accounting

Mkety stores both sides of a local-currency checkout.

Example:

```text
Canonical Mkety amount:
USD 39.99

Provider collection amount:
NGN 65,000.00
```

Billing checkout stores:

- canonical amount/currency;
- provider quoted amount/currency.

Settlement stores:

- canonical amount/currency applied to the Mkety ledger;
- actual provider amount/currency for audit.

The webhook must match or exceed the stored provider quote in the exact stored provider currency before the canonical USD settlement is applied.

## Inline checkout session security

Flutterwave Inline parameters are not trusted from query strings.

Mkety creates a short-lived server-side checkout session containing:

- provider;
- Mkety source;
- reference;
- canonical amount/currency;
- collection amount/currency;
- customer email/name;
- redirect URL;
- Mkety metadata;
- Flutterwave `payload_hash`;
- expiry.

The customer receives only:

```text
https://mkety.com/pay/flutterwave?session=<opaque UUID>
```

The payment page loads the server-owned session and renders Flutterwave Inline using:

- `FLUTTERWAVE_PUBLIC_KEY`;
- the locked transaction reference;
- locked amount/currency;
- locked customer information;
- locked metadata;
- the server-generated `payload_hash`.

The secret key never reaches the browser.

Successful verified payments close the Inline session so the same launcher URL cannot be reused as a fresh payment session.

## Flutterwave webhook

Flutterwave dashboard webhook:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

Active v3 webhook contract:

1. require `verif-hash`;
2. timing-safely compare it with `FLUTTERWAVE_STANDARD_WEBHOOK_HASH`;
3. ignore unrelated valid event types with HTTP 200;
4. for `charge.completed`, re-query the transaction using `FLUTTERWAVE_STANDARD_SECRET_KEY`;
5. require webhook and verified transaction ID, reference, status, currency, and amount to agree;
6. resolve Mkety product ownership;
7. settle locally or forward to the owning product;
8. keep settlement idempotent.

Browser redirects and Inline callbacks are never proof of payment.

## Media broker contract

Mkety Media delegates Flutterwave launch to:

```text
POST https://mkety.com/api/payments/flutterwave/start
```

Authentication:

```text
Authorization: Bearer <FLUTTERWAVE_CHECKOUT_BROKER_SECRET>
```

Media request:

```json
{
  "source": "media",
  "reference": "MKM-A83K27",
  "canonical_amount_usd": 39.99,
  "requested_payment_currency": "NGN",
  "email": "customer@example.com",
  "customer_name": "Customer business",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id",
  "redirect_url": "https://media.mkety.com/billing?payment=processing&provider=flutterwave",
  "media_webhook_url": "https://media.mkety.com/api/billing/flutterwave/webhook"
}
```

The broker does not trust `media_webhook_url` as a destination. Routing destinations are server-owned.

Response:

```json
{
  "checkout_url": "https://mkety.com/pay/flutterwave?session=...",
  "checkout_amount": 65000,
  "checkout_currency": "NGN"
}
```

Aliases `url`, `amount`, and `currency` are also returned for compatibility.

Media stores the exact returned checkout amount/currency on its invoice before redirecting the customer.

## Media webhook attestation

Flutterwave sends one webhook to MkSaaS.

For a verified Media v3 payment, central Mkety:

1. validates the original `verif-hash`;
2. re-queries the Flutterwave transaction;
3. requires webhook and verified transaction details to agree;
4. resolves the reference as Media;
5. computes:

```text
Base64(
  HMAC-SHA256(
    originalRawBody,
    FLUTTERWAVE_CHECKOUT_BROKER_SECRET
  )
)
```

6. forwards the original raw body unchanged;
7. preserves the original `verif-hash`;
8. adds:

```text
x-mkety-payment-attestation: <generated HMAC>
```

to:

```text
https://media.mkety.com/api/billing/flutterwave/webhook
```

Media validates the Mkety attestation and checks the stored quoted amount/currency before settling its own invoice.

Media does not need the Flutterwave v3 secret key or webhook hash.

## Media environment

For the current shared v3 architecture, Media needs:

```text
FLUTTERWAVE_CHECKOUT_BROKER_URL=https://mkety.com/api/payments/flutterwave/start
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=<same internal Mkety secret>
```

The final Media implementation may retain dormant v4 credentials for its own future migration code, but they are not required by the active central v3 flow.

## Enterprise Flutterwave

Enterprise negotiated orders remain canonically USD in this release.

Flutterwave Enterprise links use the same Mkety Inline launcher and same v3 webhook verification path.

This intentionally avoids silently introducing a second FX ledger for manually negotiated Enterprise amounts.

## Kora

Kora remains an independent additional provider.

It becomes visible only when:

```text
KORA_SECRET_KEY
```

Central webhook:

```text
https://mkety.com/api/payments/kora/webhook
```

Before settlement, Mkety:

1. verifies `x-korapay-signature`;
2. re-queries the charge/reference;
3. verifies status/reference/amount/currency;
4. settles locally or forwards the original webhook to the owning product.

Media destination defaults to:

```text
https://media.mkety.com/api/billing/kora/webhook
```

Kora can remain deployed but hidden while account verification is pending.

## Provider availability

### NOWPayments

Primary/default. Visible when:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

### Flutterwave

Visible only when the complete active v3 setup exists:

```text
FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
```

Shared Media/other-product broker additionally requires:

```text
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

### Kora

Visible when:

```text
KORA_SECRET_KEY
```

## Production configuration checklist

Central MkSaaS:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET

FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
FLUTTERWAVE_CHECKOUT_BROKER_SECRET

KORA_SECRET_KEY
```

Optional destination overrides:

```text
MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL
MKETY_MEDIA_KORA_WEBHOOK_URL
MKETY_HOST_FLUTTERWAVE_WEBHOOK_URL
MKETY_HOST_KORA_WEBHOOK_URL
```

FX rates and markup are stored in Platform Control/database and are not environment variables.

## Future v4 migration boundary

The v4 helper module is intentionally dormant.

When Mkety later chooses to move to v4/direct-charge/orchestrator flows:

1. decide the full customer payment-method UI and compliance boundary;
2. implement the v4 checkout adapter;
3. switch the active provider version as one atomic release;
4. replace v3 webhook verification with v4 webhook verification;
5. keep the existing Mkety references, metadata, checkout ownership, provider quote persistence, and settlement contracts;
6. do not run active v3 and v4 payment flows simultaneously.

The purpose of the current abstraction is to make that migration a provider-adapter change, not a billing-ledger rewrite.

## Security invariants

- Never trust browser redirects or Inline callbacks as proof of payment.
- Never expose the Flutterwave secret key.
- Never collect raw card details in Mkety for the current integration.
- Never infer product ownership from a provider account alone.
- Never allow caller-provided metadata to choose a forwarding URL.
- Never grant value before server-side provider re-query and amount/currency/reference validation.
- Never treat local-currency collection as though Flutterwave literally collected USD.
- Never enable a non-USD currency without a valid admin FX rate.
- Never mix active Flutterwave v3 and v4 flows.
- Keep all settlement processing idempotent.
- Keep NOWPayments first/default unless commercial policy explicitly changes.

## Operational activation

To activate Flutterwave v3 Inline:

1. switch the Flutterwave account/API key view to v3 if necessary;
2. add the v3 public key;
3. add the v3 secret key;
4. choose a random webhook secret hash and configure the same value in Flutterwave and `FLUTTERWAVE_STANDARD_WEBHOOK_HASH`;
5. set a strong 32+ character `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`;
6. configure the Flutterwave dashboard webhook as `https://mkety.com/api/payments/flutterwave/webhook`;
7. configure the same broker URL/secret in Media;
8. enter non-USD rates/markup in Platform Control;
9. run low-value USD and selected local-currency transactions;
10. confirm SaaS and Media activation only after verified webhooks.

To activate Kora after merchant verification:

1. add `KORA_SECRET_KEY`;
2. configure `https://mkety.com/api/payments/kora/webhook` in Kora;
3. run a low-value checkout;
4. confirm central verification and owning-product settlement before broad use.
