# Mkety Enterprise Checkout Compatibility Bridge Design

## Objective

Keep enterprise/customer-project payments working during the `mkety.com` public-site cutover while preserving the planned Mkety Billing architecture and the existing Auth -> Webhooks -> Billing promotion order.

The bridge must let the new Cloudflare-hosted `mkety.com` accept enterprise project payments without sending customers back to the legacy Vercel site and without prematurely promoting the Billing PR.

## Current State

The legacy `MketyDigital/Mkety` repository already has an enterprise checkout flow:

- `app/checkout/enterprise/page.tsx` collects enterprise project/customer data, an agreed USD amount, and a payment method.
- `app/api/payments/enterprise/create/route.ts` creates an enterprise order and routes payments to:
  - NOWPayments using `NOWPAYMENTS_API_KEY` for crypto.
  - Selar using `SELAR_ENTERPRISE_CHECKOUT_URL` for local/card checkout.
- NOWPayments webhook processing uses `NOWPAYMENTS_IPN_SECRET`.
- The legacy implementation can fall back to a pending page when provider setup is unavailable.

The new `mksaas` Billing core already defines the correct provider-neutral direction:

- Selar and NOWPayments are first-class gateway adapters.
- Browser success is not proof of payment.
- Only verified provider events may become settlement candidates.
- Billing state is database-authoritative.
- Money is represented using integer minor units.
- Gateway state must not grant entitlements directly.
- Billing promotion must remain behind Auth -> Webhooks.

Live `createCheckout()` provider integration is intentionally not yet implemented in the Billing branch, so the public-site bridge must not depend on promoting that branch.

## Architecture

### Public ownership

The new Cloudflare-hosted `mkety.com` owns the complete enterprise intake experience:

- Enterprise marketing page.
- Enterprise project/payment intake page.
- Enterprise checkout API.
- Provider redirect handling.
- NOWPayments webhook endpoint.
- Payment status/success/cancelled presentation.

Customers must not be redirected back to the legacy Vercel deployment for normal enterprise checkout operation.

### Compatibility bridge boundary

Create a public-site-owned enterprise payment module that is deliberately compatible with the future Billing architecture but does not duplicate or activate full tenant Billing.

The bridge exposes a provider-neutral server contract:

```ts
export type EnterprisePaymentProvider = 'nowpayments' | 'selar';

export interface EnterpriseCheckoutRequest {
  customer: {
    fullName: string;
    companyName: string;
    email: string;
    phone?: string;
    country?: string;
  };
  project: {
    scopeId?: string;
    name: string;
    description?: string;
  };
  amountMinor: bigint;
  currency: 'USD';
  provider: EnterprisePaymentProvider;
}

export interface EnterpriseCheckoutResult {
  orderId: string;
  provider: EnterprisePaymentProvider;
  redirectUrl: string;
  status: 'checkout_created' | 'awaiting_confirmation';
}
```

Provider adapters implement checkout initiation while the public server layer owns validation, idempotency, persistence, and safe customer responses.

### Temporary credential compatibility

For the compatibility period, reuse the legacy environment variable names exactly:

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- `SELAR_ENTERPRISE_CHECKOUT_URL`

These are injected into the new Cloudflare Worker as secrets/configuration. The public site does not depend on Vercel for checkout execution.

The bridge must not introduce new provider credential names solely for this transitional flow unless a provider technically requires an additional value.

### Canonical callback URLs

All newly created NOWPayments checkout URLs use the new public origin:

- IPN: `https://mkety.com/api/webhooks/enterprise/nowpayments`
- Success: `https://mkety.com/payment/enterprise/success?orderId=...`
- Cancel: `https://mkety.com/payment/enterprise/cancelled?orderId=...`

Do not use the legacy `app.mkety.com` fallback from the old repo for this public enterprise bridge.

## Data Model

Create a public-site-owned table named `platform_enterprise_orders` in the repo-owned Mkety schema used by the current public-site branch.

It stores only enterprise intake/payment state and is not a subscription/entitlement ledger.

Required fields:

- `id`: Mkety-generated order ID.
- customer name.
- company name.
- email.
- optional phone.
- optional country.
- optional scope identifier.
- project name.
- optional project description.
- `amount_minor`: integer/bigint amount in currency minor units.
- `currency`: ISO currency code; launch value is `USD`.
- `payment_provider`: `nowpayments | selar`.
- `checkout_status`: lifecycle such as `created | redirected | awaiting_confirmation | completed | failed | cancelled`.
- `payment_status`: provider-normalized state such as `pending | confirmed | failed`.
- provider checkout/invoice reference where available.
- provider payment reference where available.
- idempotency key.
- safe metadata JSON for provider-independent audit context.
- created/updated timestamps.
- paid/confirmed timestamp when verified.

The table must not contain tenant entitlement grants, wallet mutations, credit grants, subscription activation flags, or tenant billing-period state.

## Checkout Flow

### User experience

The `/enterprise` page exposes a clear enterprise CTA such as `Start Enterprise Project` / `Pay Agreed Quote`.

The checkout experience collects:

- Project scope/category.
- Project name/description.
- Agreed quote amount in USD.
- Full name.
- Company/organization.
- Business email.
- Optional phone.
- Optional country.
- Payment method/provider.

The frontend sends the quote amount as decimal user input, but the server converts and persists money in integer minor units. Server validation is authoritative.

No public checkout text promises automatic provisioning, subscription activation, compute allocation, SLA, or entitlement issuance after payment.

### NOWPayments

The NOWPayments adapter:

1. Creates the Mkety enterprise order first.
2. Calls the NOWPayments invoice API using `NOWPAYMENTS_API_KEY`.
3. Sends the Mkety order ID as the provider order reference.
4. Uses canonical `mkety.com` IPN/success/cancel URLs.
5. Persists the returned provider invoice/reference and redirect URL metadata.
6. Returns the hosted invoice URL to the browser.

If invoice creation fails, the order remains auditable and the user receives a safe failure/pending response. No payment is marked complete.

### NOWPayments webhook verification

The new webhook must fail closed in production:

- Require `NOWPAYMENTS_IPN_SECRET`.
- Require the provider signature header.
- Verify the signature against the raw request body before parsing/trusting provider fields.
- Use constant-time comparison where the runtime allows it.
- Reject invalid/missing signatures.
- Resolve the internal order from the Mkety order reference.
- Apply provider updates idempotently.
- Mark `payment_status=confirmed` only for the provider's accepted final successful state.
- Persist provider payment reference and confirmed timestamp.
- Never create subscriptions, entitlements, credits, or wallet entries from this bridge.

Repeated valid webhook deliveries must not double-apply state.

### Selar

Selar remains a hosted checkout compatibility path using `SELAR_ENTERPRISE_CHECKOUT_URL`.

The adapter may append the supported customer/order parameters used by the current live flow, but the browser redirect itself is not proof of payment.

Until a verified Selar provider event is connected to this bridge, Selar orders remain `awaiting_confirmation` after browser return and must not be automatically marked paid.

This matches the future Billing rule that hosted checkout success is never payment proof.

## Future Billing Convergence

This bridge is temporary in ownership, not throwaway in shape.

When the Billing branch is promoted in the established order:

`Auth -> Webhooks -> Billing -> Entitlements -> Usage/Credits -> Wallet`

enterprise checkout can migrate by adapting bridge orders into Billing checkout/settlement intake.

The bridge must not copy full Billing tables or settlement logic into the public branch. It should preserve compatible provider names, integer-money representation, verified-event semantics, and idempotency so migration is mechanical.

A completed bridge order means only:

`enterprise payment verified / project ready for fulfillment`

It does not mean:

- tenant subscription active.
- entitlement granted.
- credits issued.
- wallet funded.
- infrastructure provisioned.

## Cloudflare Deployment

The new public-site candidate and production workflows must carry the existing payment configuration into the Cloudflare Worker without exposing values in logs.

Candidate deployment requirements:

- Validate payment configuration shape without printing secrets.
- Attach `NOWPAYMENTS_API_KEY` as a Worker secret when configured.
- Attach `NOWPAYMENTS_IPN_SECRET` as a Worker secret when configured.
- Provide `SELAR_ENTERPRISE_CHECKOUT_URL` as secret or protected configuration according to the workflow's existing secret handling convention.
- Exercise checkout APIs in a non-charging/safe mode where possible.
- Do not perform a live paid transaction merely to prove deployment.

Production deployment remains gated behind the existing public-site acceptance and Public Mkety AI candidate gates.

No Vercel deployment is part of the new `mkety.com`/`www.mkety.com` release path.

## Public Domain Cutover

After all acceptance gates pass:

- Bind the verified Cloudflare Worker to `mkety.com/*`.
- Bind `www.mkety.com/*` to the same Worker.
- Application routing returns the existing canonical 308 redirect from `www.mkety.com` to `mkety.com`.
- Preserve current proxied root/www DNS records unless the Cloudflare route mechanism requires a separately reviewed change.
- Preserve unrelated Cloudflare routes, especially `learn.starpipsforex.com/* -> mklms`.
- Keep the pre-cutover production snapshot as the rollback reference.

## Security Requirements

- Server-authoritative amount parsing and minimum/maximum bounds.
- Only supported currency at launch: USD.
- Provider is selected from a closed enum.
- Idempotency key required for checkout creation or generated server-side from a stable request/order boundary.
- No provider secret reaches the browser.
- Webhook verification fails closed.
- No browser redirect marks payment complete.
- No enterprise bridge state grants tenant access.
- Sensitive provider payloads are not returned to customers.
- Error responses do not expose secrets or raw provider internals.
- Rate-limit checkout creation by an appropriate public request fingerprint/session boundary.
- Audit-safe state transitions only; never silently overwrite a confirmed payment with a lower-confidence browser state.

## Testing Requirements

Use TDD for implementation.

Required focused tests include:

- input validation.
- decimal-to-minor-unit money conversion.
- minimum amount enforcement.
- provider enum rejection.
- order persistence.
- idempotent checkout creation.
- NOWPayments invoice request construction.
- canonical `mkety.com` callback URLs.
- missing NOWPayments secret fails safely.
- missing/invalid webhook signature rejected.
- valid final NOWPayments webhook confirms order.
- non-final NOWPayments status does not confirm order.
- duplicate NOWPayments webhook is idempotent.
- Selar redirect does not mark an order paid.
- enterprise CTA/checkout route is visible on public site.
- payment success/cancelled/pending pages do not falsely claim verified payment.
- Cloudflare candidate configuration validates the legacy-compatible payment env names.

The existing repository-wide gates remain mandatory:

- tests.
- typecheck.
- lint with no new errors.
- production build.
- connected Mkety database migration/smoke.
- vinext compatibility.
- public route crawl.
- Public Mkety AI candidate smoke.
- enterprise checkout candidate smoke.
- read-only Cloudflare production preflight.

## Acceptance Criteria

The bridge is acceptable for public deployment only when:

1. A visitor can start an enterprise checkout entirely on the new `mkety.com` experience.
2. Existing NOWPayments/Selar environment names are supported on Cloudflare.
3. NOWPayments invoice creation points back to `mkety.com` callbacks.
4. Verified NOWPayments events update the new enterprise order safely and idempotently.
5. Browser redirects alone never mark payment verified.
6. The bridge cannot grant tenant subscriptions, entitlements, credits, wallets, or provisioning.
7. The data model and provider vocabulary align with the planned Billing architecture.
8. The new public site does not depend on the legacy Vercel deployment for enterprise checkout.
9. Candidate verification passes without charging a real customer.
10. Full public-site acceptance, Public Mkety AI, enterprise checkout, and Cloudflare production preflight are green before the `mkety.com`/`www` route mutation.
