# Mkety Shared Payments

## Purpose

Mkety owns the reusable payment-provider boundary. Individual products keep ownership of their own invoices, subscriptions, entitlements, activation rules, and customer data.

The central provider endpoints are:

- Flutterwave checkout broker: `https://mkety.com/api/payments/flutterwave/start`
- Flutterwave webhook: `https://mkety.com/api/payments/flutterwave/webhook`
- Kora webhook: `https://mkety.com/api/payments/kora/webhook`

NOWPayments remains Mkety's primary/default crypto payment path. Flutterwave and Kora are additional fiat providers and are configuration-driven.

## Mkety-owned references

New shared-account transactions should carry a Mkety-owned reference:

- Platform SaaS: `SAAS-MKS-...`
- Mkety Media: `MEDIA-MKM-...`
- Future Hosting: `HOST-MKH-...`
- Enterprise: `ENT-MKE-...`

Where a local target is a UUID, Mkety compacts it so the reference remains within Flutterwave v4's 42-character reference constraint.

Mkety Media currently has live invoice references in the form `MKM-XXXXXXXXXX`. Those references are not renamed. The shared router accepts the current `MKM-*` format only when independently verified provider metadata says `source=media`.

## Explicit metadata

Every provider request should include Mkety-owned metadata where supported:

```json
{
  "source": "media",
  "invoice_id": "invoice-id",
  "tenant_id": "tenant-id"
}
```

For Platform SaaS use `source=saas`, `checkout_id`, and `tenant_id`.
For Enterprise use `source=enterprise` and `order_id`.

Reference and metadata are checked together. Metadata cannot override a conflicting canonical reference prefix.

## Settlement rules

A browser return is never proof of payment.

Before Mkety grants value or access:

1. verify the provider webhook signature;
2. re-query the provider transaction/charge API;
3. resolve the Mkety-owned source from reference + provider metadata;
4. verify the local checkout/invoice/order exists;
5. verify provider identity, currency, and exact expected amount;
6. apply settlement idempotently in the owning product ledger.

Platform SaaS and Enterprise settlement remain inside `mksaas`.

## Mkety Media shared-account routing

Media owns its invoice/subscription/activation database. The central Mkety endpoint owns the shared provider account boundary.

For Flutterwave the dashboard webhook is:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

For a Media payment the flow is:

```text
Flutterwave
  -> mkety.com/api/payments/flutterwave/webhook
  -> verify original v4 HMAC signature
  -> re-query Flutterwave charge
  -> resolve source=media
  -> forward ORIGINAL raw body + ORIGINAL flutterwave-signature
  -> media.mkety.com/api/billing/flutterwave/webhook
  -> Media verifies the same signature again
  -> Media re-queries Flutterwave again
  -> Media verifies invoice reference/currency/amount
  -> Media settles its invoice idempotently
```

The destination is server-owned. Mkety never reads a forwarding URL from customer/provider metadata.

Default Media destination:

```text
https://media.mkety.com/api/billing/flutterwave/webhook
```

Optional override:

```text
MKETY_MEDIA_FLUTTERWAVE_WEBHOOK_URL
```

Kora can use the same shared routing pattern with:

```text
https://mkety.com/api/payments/kora/webhook
MKETY_MEDIA_KORA_WEBHOOK_URL
```

## Flutterwave v4 checkout broker

Media calls:

```text
POST https://mkety.com/api/payments/flutterwave/start
Authorization: Bearer <FLUTTERWAVE_CHECKOUT_BROKER_SECRET>
```

Handoff payload:

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

The broker validates the source/reference pairing, amount, currency, customer identity, and product-owned redirect URL.

### Important v4 checkout boundary

Flutterwave v4 OAuth credentials do not provide the old v3 method-agnostic Standard hosted checkout. A v4 charge requires a concrete payment method. Mkety therefore does not fake a generic Flutterwave checkout URL and does not collect raw card data in this broker.

Current v4 credentials enable:

- OAuth client-credentials authentication;
- central webhook verification;
- provider charge re-query;
- shared Mkety routing;
- the authenticated Media-to-MkSaaS broker contract.

The customer-facing Flutterwave button should be enabled only when Mkety implements/chooses a specific v4 payment-method UX. Card collection requires Flutterwave v4 encrypted card fields and the relevant encryption key. Until then, NOWPayments remains primary and Kora can provide hosted fiat checkout once Kora is configured.

## Provider availability

Provider options are fail-closed and environment-driven.

### NOWPayments

Shown first/default when:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

### Kora

Shown when:

```text
KORA_SECRET_KEY
```

Kora uses server-created hosted checkout. Its webhook is HMAC-SHA256 verified over the webhook `data` object and the charge is re-queried by reference before settlement.

### Flutterwave v4

Shared v4 auth/webhook boundary is enabled when:

```text
FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET
FLUTTERWAVE_CHECKOUT_BROKER_SECRET
```

The broker secret is a Mkety-only internal secret shared between central MkSaaS and approved Mkety products such as Media. It is not a Flutterwave credential.

## Media configuration

On Media:

```text
FLUTTERWAVE_CLIENT_ID
FLUTTERWAVE_CLIENT_SECRET
FLUTTERWAVE_WEBHOOK_SECRET
FLUTTERWAVE_CHECKOUT_BROKER_URL=https://mkety.com/api/payments/flutterwave/start
FLUTTERWAVE_CHECKOUT_BROKER_SECRET=<same internal Mkety secret>
```

Flutterwave dashboard webhook:

```text
https://mkety.com/api/payments/flutterwave/webhook
```

Use the same `FLUTTERWAVE_WEBHOOK_SECRET` in central MkSaaS and Media so the unchanged forwarded event can be independently authenticated twice.

## Security principles

- Never trust a browser return as payment proof.
- Never trust source metadata without verifying the provider event first.
- Never accept a webhook-forward destination from request/provider metadata.
- Never expose provider secret keys to the browser.
- Never mark a payment settled solely from a webhook payload if the provider offers a transaction-query API.
- Never silently switch a selected provider to a different provider.
- Never display a payment provider merely because partial credentials exist.
