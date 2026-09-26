# Mkety Shared Payments

## Status

Current implementation state:

| Area                                   | State                                                                                                                                                    |
|----------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|
| NOWPayments                            | Primary/default crypto path; existing verified settlement remains authoritative                                                                          |
| Flutterwave hosted checkout            | Implemented through Flutterwave Standard when Standard secret + webhook hash are configured                                                              |
| Flutterwave v4 OAuth                   | Implemented with Client ID + Client Secret and short-lived access-token reuse                                                                            |
| Flutterwave v4 webhook                 | Implemented using raw-body HMAC-SHA256/Base64 `flutterwave-signature` verification                                                                       |
| Flutterwave Standard webhook           | Implemented on the same central URL using `verif-hash` plus server-side transaction verification                                                         |
| Flutterwave local-currency checkout    | Implemented for USD plus explicitly priced Mkety collection currencies; current contract supports NGN, GHS, KES, GBP, EUR, ZAR, XAF, XOF, UGX, RWF, and TZS |
| Kora hosted checkout                   | Implemented; becomes visible only when `KORA_SECRET_KEY` is configured                                                                                   |
| Kora webhook                           | Implemented with HMAC-SHA256 `x-korapay-signature` verification + charge re-query                                                                        |
| Mkety Media routing                    | Implemented through original-provider-webhook forwarding; Media keeps its own invoice/subscription ledger                                                |
| Direct v4 card collection inside Mkety | Not used; Mkety does not collect raw card details                                                                                                        |

NOWPayments remains first/default. Flutterwave and Kora are additional fiat paths.

## Architectural rule

Mkety owns the reusable provider boundary. Each product owns its own commercial ledger.

```text
Provider account / webhook
        |
        v
mkety.com shared payments boundary
        |
        +-- SaaS ----------> MkSaaS billing ledger
        +-- Enterprise ----> MkSaaS enterprise order ledger
        +-- Media ---------> original provider webhook forwarded to Media
        +-- future Host ---> original provider webhook forwarded to Host
```

A provider account or webhook URL never determines product ownership by itself.

## Mkety-owned references

New shared-account transactions should use these prefixes:

- Platform SaaS: `SAAS-MKS-...`
- Mkety Media: `MEDIA-MKM-...`
- Future Hosting: `HOST-MKH-...`
- Enterprise: `ENT-MKE-...`

UUID targets are compacted when possible so references stay within provider limits.

Mkety Media already has invoice references such as:

```text
MKM-A83K27
```

Those existing references remain valid and route to Media directly after provider verification. If provider metadata is present, it must agree with the reference. Metadata cannot override a conflicting canonical prefix.

## Explicit metadata

Provider requests should carry Mkety-owned metadata where supported.

Media:

```json
{
  "source": "media",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id"
}
```

Platform SaaS:

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

## Settlement invariants

A browser return is never proof of payment.

Before access/value is granted, Mkety must:

1. verify the provider webhook signature;
2. re-query the provider transaction/charge API;
3. resolve the Mkety source from verified reference + metadata;
4. locate the owning checkout/order/invoice;
5. verify provider, status, expected currency, and expected amount;
6. apply settlement idempotently in the owning ledger.

### Local-currency collections

Mkety subscription prices remain canonically USD.

USD is always available. For non-USD collection, Mkety requires an explicit approved commercial rate in `MKETY_PAYMENT_FX_RATES_JSON`. The Flutterwave transfer/remittance rate endpoint is deliberately not used as customer-checkout pricing because Flutterwave documents that rate flow for transfer/remittance conversion rather than Standard customer-payment pricing.

The shared contract currently understands:

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
```

Example configuration:

```text
MKETY_PAYMENT_FX_RATES_JSON={"NGN":"1600","GHS":"15.5","KES":"130","GBP":"0.78","EUR":"0.92"}
```

Each value means local collection-currency units per 1 USD of canonical Mkety price. If a rate is not configured, that non-USD currency fails closed rather than guessing. V4 OAuth remains available for native-v4 verification/control-plane operations and future approved currency services, but it does not automatically turn transfer/remittance pricing into a checkout exchange rate.

The exact configured collection amount returned by the server is locked into the checkout record.

Mkety calculates the provider quote server-side and persists both sides of the transaction:

```text
Canonical Mkety price:
USD 39.99

Provider collection quote:
NGN <quoted amount>
```

The checkout record stores:

- canonical amount/currency;
- provider amount/currency.

On settlement, Mkety verifies the actual provider payment against the stored provider quote. Only after that validation does Mkety apply the canonical USD billing settlement.

The settlement record retains the original provider amount/currency for auditability.

This means a local-currency payment is never falsely recorded as though Flutterwave literally collected USD.

## Flutterwave architecture

### Customer collection

Mkety deliberately uses Flutterwave's hosted Standard checkout for the customer-facing multi-method payment UI.

Why:

- customer card details stay with Flutterwave;
- Mkety does not need PCI-scoped raw card collection;
- Flutterwave can display payment methods applicable to the selected transaction currency and merchant-account configuration;
- v4 remains available for modern API/control-plane operations.

Hosted checkout creation uses:

```text
FLUTTERWAVE_STANDARD_SECRET_KEY
```

The central hosted-checkout endpoint is:

```text
POST https://mkety.com/api/payments/flutterwave/start
```

### Flutterwave v4 control plane

Native v4 support uses:

```text
FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET
```

OAuth access tokens are short lived and are refreshed/reused server-side before expiry. Native v4 production API calls use Flutterwave's documented production host `https://f4bexperience.flutterwave.com`; Flutterwave Standard remains on the separate `https://api.flutterwave.com/v3` API.

The v4 webhook signature is:

```text
flutterwave-signature
HMAC-SHA256(raw request body, FLUTTERWAVE_WEBHOOK_SECRET)
Base64 output
```

After signature verification Mkety re-queries the charge before settlement.

### Flutterwave Standard webhook compatibility

Flutterwave Standard currently documents the legacy:

```text
verif-hash
```

contract.

Mkety therefore supports both signature modes on one URL:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

Standard compatibility uses:

```text
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
```

For a Standard event Mkety:

1. timing-safely verifies `verif-hash`;
2. re-queries `/v3/transactions/{id}/verify`;
3. verifies source/reference/amount/currency;
4. settles or forwards to the owning Mkety product.

For a native v4 event Mkety uses the v4 HMAC signature and v4 charge-retrieval flow instead.

## Flutterwave currency/payment-method UX

The checkout page keeps the canonical product price visible in USD and lets the customer choose a collection currency.

Example:

```text
Business
Canonical price: $39.99

Pay with Flutterwave in:
USD | any Mkety-configured collection currencies
```

Mkety shows the quoted local collection amount before redirect. The quote source is recorded as `identity` or `configured` for auditability.

Flutterwave's hosted interface determines which enabled payment methods are valid for that selected currency. Mkety does not hard-code a promise that every rail will appear for every merchant/country.

Examples of the intended experience:

```text
NGN -> card / transfer / USSD / other enabled NGN rails
GHS -> card / Mobile Money where enabled
KES -> card / M-Pesa where enabled
GBP -> applicable GBP methods
EUR -> applicable EUR methods
USD -> applicable USD methods
```

Exact methods remain controlled by Flutterwave account/currency availability.

## Mkety Media shared-account flow

The Flutterwave dashboard webhook remains one central URL:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

Media launches checkout through:

```text
https://mkety.com/api/payments/flutterwave/start
```

Media sends the final shared broker contract:

```json
{
  "source": "media",
  "reference": "MKM-A83K27",
  "canonical_amount_usd": 39.99,
  "requested_payment_currency": "NGN",
  "email": "customer@example.com",
  "customer_name": "Example Business",
  "invoice_id": "media-invoice-id",
  "tenant_id": "media-tenant-id",
  "redirect_url": "https://media.mkety.com/billing?payment=processing&provider=flutterwave",
  "media_webhook_url": "https://media.mkety.com/api/billing/flutterwave/webhook"
}
```

The broker does not trust `media_webhook_url` as a routing destination; forwarding destinations are server-owned. The field is accepted only for contract compatibility. A successful broker response includes:

```json
{
  "checkout_url": "https://...",
  "checkout_amount": 65000,
  "checkout_currency": "NGN"
}
```

The aliases `url`, `amount`, and `currency` are returned as well. Media stores that exact quoted amount/currency before redirecting the customer.

The broker authenticates Media with:

```text
Authorization: Bearer <FLUTTERWAVE_CHECKOUT_BROKER_SECRET>
```

### Webhook routing to Media

For a verified Media event, central Mkety always forwards the original unchanged raw request body and the original provider signature/header name to:

```text
https://media.mkety.com/api/billing/flutterwave/webhook
```

For native v4 events:

```text
flutterwave-signature: <original Flutterwave signature>
```

Media independently verifies the v4 HMAC and re-queries the v4 charge before settlement.

For Flutterwave Standard events, central Mkety first:

1. timing-safely validates `verif-hash`;
2. re-queries the Flutterwave transaction using the central-only `FLUTTERWAVE_STANDARD_SECRET_KEY`;
3. requires webhook and verified transaction status/reference/currency/amount to agree;
4. signs the unchanged raw body with `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`.

It then forwards:

```text
verif-hash: <original Flutterwave value>
x-mkety-payment-attestation: Base64(HMAC-SHA256(rawBody, FLUTTERWAVE_CHECKOUT_BROKER_SECRET))
```

Media validates the Mkety attestation, checks the exact stored checkout amount/currency, and settles its own ledger. The Standard secret key never needs to exist in Media.

There is no second normalized central-settlement protocol for Media.

### Media Flutterwave environment

Primary/shared v4 values:

```text
FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET

FLUTTERWAVE_CHECKOUT_BROKER_URL=https://mkety.com/api/payments/flutterwave/start
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=<same internal Mkety broker secret>
```

Media does **not** need `FLUTTERWAVE_STANDARD_SECRET_KEY`, `FLUTTERWAVE_V3_SECRET_KEY`, or a Standard webhook hash. Standard verification remains centralized on MkSaaS. Media validates the internal attestation with the same `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`.

No Encryption Key is required because Mkety/Media do not directly collect/encrypt card details in this architecture.

## Kora

Kora uses hosted Checkout Redirect.

Enabled when:

```text
KORA_SECRET_KEY
```

Central webhook:

```text
https://mkety.com/api/payments/kora/webhook
```

Before settlement Mkety:

1. verifies `x-korapay-signature` as HMAC-SHA256 over the webhook `data` object;
2. re-queries Kora by the Mkety reference;
3. verifies reference/status/amount/currency;
4. settles locally or forwards the original webhook to the owning product.

Media Kora destination defaults to:

```text
https://media.mkety.com/api/billing/kora/webhook
```

Kora remains hidden until the account secret exists. This allows the integration to remain deployed while merchant verification is pending.

## Provider availability

### NOWPayments — primary/default

Visible first when:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

### Flutterwave hosted fiat

Visible when the hosted checkout and Standard webhook path are complete:

```text
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
```

Native-v4 verification/control uses:

```text
FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET
```

Media/shared broker additionally requires:

```text
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

Optional fixed commercial FX overrides:

```text
MKETY_PAYMENT_FX_RATES_JSON
```

### Kora availability

Visible when:

```text
KORA_SECRET_KEY
```

## Central MkSaaS production secrets

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET

FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET
FLUTTERWAVE_STANDARD_SECRET_KEY
FLUTTERWAVE_STANDARD_WEBHOOK_HASH
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
MKETY_PAYMENT_FX_RATES_JSON

KORA_SECRET_KEY
```

Optional destination overrides:

```text
MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL
MKETY_MEDIA_KORA_WEBHOOK_URL
MKETY_HOST_FLUTTERWAVE_WEBHOOK_URL
MKETY_HOST_KORA_WEBHOOK_URL
```

Provider secrets remain server-side only.

## Security rules

- Never trust a browser redirect as proof of payment.
- Never expose provider secret keys in client code.
- Never trust `source` metadata before verifying the provider event.
- Never allow provider/customer metadata to choose a forwarding destination.
- Never grant access before provider re-query and amount/currency verification.
- Never expose Flutterwave purely because partial credentials exist.
- Never record a local-currency provider payment as though that provider literally collected USD.
- Never collect raw card details in Mkety unless a deliberate PCI-compliant direct-card project is approved.
- Keep webhook processing idempotent.
- Keep NOWPayments as the primary/default option unless the commercial policy is intentionally changed.

## Remaining operational steps

Code can be merged independently of merchant verification because provider visibility is environment-driven.

To make Flutterwave hosted checkout live:

1. add the production Standard Secret Key;
2. set the dashboard webhook secret hash in `FLUTTERWAVE_STANDARD_WEBHOOK_HASH`;
3. keep the central Flutterwave dashboard webhook at `https://mkety.com/api/payments/flutterwave/webhook`;
4. configure the v4 Client ID/Secret/Webhook Secret for native-v4 verification;
5. set a strong shared `FLUTTERWAVE_CHECKOUT_BROKER_SECRET`;
6. configure `MKETY_PAYMENT_FX_RATES_JSON` for every non-USD currency Mkety wants to offer at checkout;
7. add the matching Media broker values; Media does not receive the Standard secret/hash;
8. run a real low-value test checkout in USD and each enabled collection currency before broad customer use.

To make Kora live after verification:

1. add `KORA_SECRET_KEY`;
2. configure the Kora dashboard webhook to `https://mkety.com/api/payments/kora/webhook`;
3. run a low-value hosted checkout and verify central/local settlement;
4. only then treat Kora as production-verified.
