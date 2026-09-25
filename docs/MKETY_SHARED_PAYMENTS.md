# Mkety Shared Payments

## Purpose

Mkety owns the payment-routing boundary. Product applications should not infer ownership from a provider account or webhook URL.

The central provider webhooks are:

- `https://mkety.com/api/payments/flutterwave/webhook`
- `https://mkety.com/api/payments/kora/webhook`

NOWPayments remains the primary crypto payment path and keeps its existing verified settlement routes.

## Mkety-owned references

Every newly integrated central payment should use a Mkety-owned source prefix:

- Platform SaaS: `SAAS-MKS-...`
- Mkety Media: `MEDIA-MKM-...`
- Future Hosting: `HOST-MKH-...`
- Enterprise: `ENT-MKE-...`

When the local target is a UUID, Mkety compacts the UUID into the reference so the reference remains within Flutterwave's 42-character constraint and can be deterministically recovered.

References identify the owning Mkety product. They do not by themselves prove that a payment succeeded.

## Explicit metadata

Provider requests should also include Mkety-owned metadata when the provider supports metadata:

```json
{
  "source": "media",
  "invoice_id": "invoice-id",
  "tenant_id": "tenant-id"
}
```

For SaaS the equivalent fields are `source=saas`, `checkout_id`, and `tenant_id`.
For Enterprise the equivalent field is `source=enterprise` plus `order_id`.

The central webhook uses a verified Mkety reference as the routing boundary and uses provider-returned metadata only for the target identifiers required by external product ledgers.

## Settlement rules

A browser redirect is never proof of payment.

Before value or access is delivered, Mkety must:

1. verify the provider webhook signature;
2. re-query the provider's transaction/charge API;
3. verify the Mkety-owned reference;
4. verify provider identity for the local checkout/order;
5. verify exact expected currency and amount;
6. apply settlement idempotently to the owning ledger.

For Platform Billing and Enterprise orders, settlement is applied inside `mksaas`.

For independently deployed products such as Mkety Media, the central webhook sends a normalized settlement event to a server-owned URL configured by environment. That event is HMAC-SHA256 signed with a Mkety-only shared secret. The destination URL is never read from provider metadata.

## External product handoff

Mkety Media can later point Flutterwave and Kora notifications at the central Mkety webhook while retaining its own invoice/subscription database.

Recommended Media creation contract:

- reference: `MEDIA-MKM-<unique-token>`
- metadata: `source=media`, `invoice_id=<media invoice id>`, `tenant_id=<media tenant id>`
- provider notification URL: the corresponding central Mkety provider webhook.

Central Mkety runtime configuration:

```text
MKETY_MEDIA_PAYMENT_SETTLEMENT_URL=https://media.mkety.com/api/billing/mkety-settlement
MKETY_MEDIA_PAYMENT_SETTLEMENT_SECRET=<at least 32 random characters>
```

The Media receiver must independently verify `X-Mkety-Payment-Signature`, check the target invoice and amount/currency against its own database, enforce event idempotency, and only then call its local settlement function.

The Media repository is not modified by this implementation.

## Provider availability

Payment choices are fail-closed and configuration-driven.

- NOWPayments appears first/default when its API key and IPN secret are configured.
- Kora appears when `KORA_SECRET_KEY` is configured.
- Flutterwave v4 webhook/auth verification is enabled when all of:
  - `FLUTTERWAVE_CLIENT_ID`
  - `FLUTTERWAVE_CLIENT_SECRET`
  - `FLUTTERWAVE_WEBHOOK_SECRET`
  are configured.

Flutterwave v4 does not expose the old v3 method-agnostic Standard checkout through the v4 OAuth credentials. A v4 charge requires a concrete payment method/customer flow. Therefore Mkety must not display a generic Flutterwave button merely because the v4 credentials exist. Add the customer-facing Flutterwave method only together with the chosen v4 payment-method UX.

## Kora

Kora hosted checkout can be created server-side and redirects the customer to Kora. The webhook is HMAC verified and the transaction is re-queried by reference before settlement.

## Flutterwave v4

Mkety uses the v4 OAuth2 client-credentials boundary and verifies `flutterwave-signature` over the raw webhook body. A webhook charge is re-queried before settlement. References must remain 6-42 characters and use only Flutterwave-supported characters.
