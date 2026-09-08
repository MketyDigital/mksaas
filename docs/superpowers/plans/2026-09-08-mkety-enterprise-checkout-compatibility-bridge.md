# Mkety Enterprise Checkout Compatibility Bridge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep enterprise project payments working entirely on the new Cloudflare-hosted `mkety.com` while preserving the planned Mkety Billing architecture and the Auth -> Webhooks -> Billing promotion order.

**Architecture:** Add a public-site-owned enterprise checkout compatibility bridge with its own intake/order table, provider-neutral checkout contract, NOWPayments and Selar adapters, verified NOWPayments webhook handling, Mkety public checkout/status pages, and Cloudflare secret wiring. The bridge uses the legacy payment environment variable names temporarily but does not depend on the legacy Vercel runtime and never grants tenant subscriptions, entitlements, credits, wallet funds, or provisioning.

**Tech Stack:** Next.js/vinext on Cloudflare Workers, TypeScript, Drizzle/PostgreSQL in `saas_template`, Web Crypto API, Jest, GitHub Actions, Wrangler, NOWPayments hosted invoice API, Selar hosted checkout URL.

**Spec:** `docs/superpowers/specs/2026-09-08-mkety-enterprise-checkout-compatibility-bridge-design.md`

## Global Constraints

- `AGENTS.md` remains immutable architectural authority.
- Work only on `feat/mkety-public-site-production` and the public-site production plan until `mkety.com` is verified in production.
- Do not merge/promote Billing PR #21 ahead of Auth -> Webhooks.
- Reuse exactly `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, and `SELAR_ENTERPRISE_CHECKOUT_URL` for this compatibility period.
- No Vercel deployment or legacy runtime dependency in the new public checkout path.
- Canonical provider callbacks must use `https://mkety.com`.
- Money is server-authoritative integer minor units; launch currency is USD only.
- Browser return/success never proves payment.
- NOWPayments webhook verification fails closed when the secret/signature is absent or invalid.
- Only a verified final NOWPayments success state may mark an order confirmed.
- The bridge must not activate subscriptions, entitlements, credits, wallet funds, tenant access, or infrastructure provisioning.
- Preserve the existing Public Mkety AI architecture and its deployment gates.
- Preserve unrelated Cloudflare routes, especially `learn.starpipsforex.com/* -> mklms`.
- Use TDD: targeted RED test before implementation, GREEN proof afterward.

---

### Task 1: Enterprise order schema and migration

**Files:**
- Create: `src/shared/db/schema/platform-enterprise-orders.ts`
- Modify: `src/shared/db/schema/index.ts`
- Create: `migrations/0004_platform_enterprise_orders.sql` (use next available public-branch migration number if the exact number is occupied)
- Modify: repository explicit migration runner used by `.github/workflows/mkety-content-db-smoke.yml`
- Modify: DB smoke script used by the public-site workflow
- Test: `src/shared/db/schema/platform-enterprise-orders.test.ts`

**Interfaces:**
- Produces `platformEnterpriseOrders` Drizzle table.
- Order IDs are Mkety-generated text IDs such as `MKETY-ENT-<uuid-or-stable-random-suffix>`.
- Money is `amountMinor: bigint`/Postgres bigint and `currency='USD'`.
- Provider enum values are `nowpayments | selar`.
- Checkout states: `created | redirected | awaiting_confirmation | completed | failed | cancelled`.
- Payment states: `pending | confirmed | failed`.

- [ ] **Step 1: Write the failing schema test**

```ts
import { platformEnterpriseOrders } from './platform-enterprise-orders';

describe('platformEnterpriseOrders', () => {
  it('stores enterprise intake without tenant billing grants', () => {
    expect(platformEnterpriseOrders).toBeDefined();
    const columns = Object.keys(platformEnterpriseOrders);
    expect(columns).not.toContain('tenantId');
    expect(columns).not.toContain('subscriptionId');
    expect(columns).not.toContain('entitlementId');
    expect(columns).not.toContain('walletId');
  });
});
```

- [ ] **Step 2: Run the focused test and record RED**

Run: `pnpm test -- src/shared/db/schema/platform-enterprise-orders.test.ts`

Expected: FAIL because the schema module/table does not exist.

- [ ] **Step 3: Implement the schema and idempotent SQL migration**

Required columns:

```ts
id
customerName
companyName
email
phone
country
scopeId
projectName
projectDescription
amountMinor
currency
paymentProvider
checkoutStatus
paymentStatus
providerCheckoutReference
providerPaymentReference
idempotencyKey
metadata
createdAt
updatedAt
confirmedAt
```

Add unique index on `idempotencyKey`, indexes on `email`, `paymentStatus`, `paymentProvider`, and `createdAt`. Do not add tenant/account foreign keys.

- [ ] **Step 4: Wire migration + DB smoke**

The migration runner must execute the new SQL idempotently. DB smoke must `SELECT`/open `saas_template.platform_enterprise_orders` and fail if it is absent.

- [ ] **Step 5: Run focused test + DB-safe static checks**

Run: `pnpm test -- src/shared/db/schema/platform-enterprise-orders.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema migrations scripts .github/workflows/mkety-content-db-smoke.yml
git commit -m "feat: add enterprise checkout intake schema"
```

---

### Task 2: Enterprise checkout domain validation and money conversion

**Files:**
- Create: `src/features/enterprise-checkout/domain.ts`
- Create: `src/features/enterprise-checkout/domain.test.ts`

**Interfaces:**
- Produces `EnterprisePaymentProvider = 'nowpayments' | 'selar'`.
- Produces `EnterpriseCheckoutRequest`, `EnterpriseCheckoutResult`, `parseEnterpriseCheckoutInput()`, and `parseUsdAmountToMinorUnits()`.
- Server launch bounds: minimum USD 10.00; maximum USD 1,000,000.00.

- [ ] **Step 1: Write RED tests**

```ts
expect(parseUsdAmountToMinorUnits('199')).toBe(19900n);
expect(parseUsdAmountToMinorUnits('199.99')).toBe(19999n);
expect(() => parseUsdAmountToMinorUnits('9.99')).toThrow();
expect(() => parseUsdAmountToMinorUnits('1000000.01')).toThrow();
expect(() => parseEnterpriseCheckoutInput({ provider: 'stripe' })).toThrow();
```

Also test required name/company/email/project name, valid email, USD-only currency, bounded description lengths, and provider enum.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- src/features/enterprise-checkout/domain.test.ts`

Expected: FAIL because the module/functions do not exist.

- [ ] **Step 3: Implement strict parser**

Do not use floating-point multiplication for persisted amounts. Parse the decimal string into dollars/cents and return bigint minor units.

- [ ] **Step 4: Run GREEN**

Run: `pnpm test -- src/features/enterprise-checkout/domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/enterprise-checkout/domain.ts src/features/enterprise-checkout/domain.test.ts
git commit -m "feat: validate enterprise checkout requests"
```

---

### Task 3: Provider-neutral adapters using legacy-compatible environment variables

**Files:**
- Create: `src/features/enterprise-checkout/providers/types.ts`
- Create: `src/features/enterprise-checkout/providers/nowpayments.ts`
- Create: `src/features/enterprise-checkout/providers/selar.ts`
- Create: `src/features/enterprise-checkout/providers/registry.ts`
- Create: `src/features/enterprise-checkout/providers/nowpayments.test.ts`
- Create: `src/features/enterprise-checkout/providers/selar.test.ts`
- Modify: `src/shared/lib/env.ts`
- Modify: `.env.example`

**Interfaces:**

```ts
export interface EnterpriseCheckoutProviderAdapter {
  provider: EnterprisePaymentProvider;
  createCheckout(input: ProviderCheckoutInput): Promise<ProviderCheckoutResult>;
}
```

NOWPayments consumes `NOWPAYMENTS_API_KEY`; Selar consumes `SELAR_ENTERPRISE_CHECKOUT_URL`. Webhook verification consumes `NOWPAYMENTS_IPN_SECRET` but is implemented in Task 5.

- [ ] **Step 1: Write NOWPayments RED tests**

Assert invoice request includes:

```ts
price_amount: '199.99'
price_currency: 'usd'
order_id: '<Mkety order id>'
ipn_callback_url: 'https://mkety.com/api/webhooks/enterprise/nowpayments'
success_url: 'https://mkety.com/payment/enterprise/success?orderId=<encoded>'
cancel_url: 'https://mkety.com/payment/enterprise/cancelled?orderId=<encoded>'
```

Assert missing `NOWPAYMENTS_API_KEY` fails safely without issuing fetch.

- [ ] **Step 2: Write Selar RED tests**

Assert missing/invalid `SELAR_ENTERPRISE_CHECKOUT_URL` fails safely; valid URL gets encoded order/customer parameters and returns `awaiting_confirmation`; never returns `completed`.

- [ ] **Step 3: Run RED**

Run: `pnpm test -- src/features/enterprise-checkout/providers`

Expected: FAIL because adapters do not exist.

- [ ] **Step 4: Implement provider contracts/adapters**

Use `fetch` directly for NOWPayments to remain Workers-compatible. Return only normalized provider checkout reference/redirect URL/status; do not expose raw provider payload to browser callers.

- [ ] **Step 5: Register env fields**

Add the three legacy-compatible names to server env validation/documentation without exposing them through client env.

- [ ] **Step 6: Run GREEN**

Run: `pnpm test -- src/features/enterprise-checkout/providers`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/enterprise-checkout/providers src/shared/lib/env.ts .env.example
git commit -m "feat: add enterprise payment provider adapters"
```

---

### Task 4: Order repository, idempotent checkout service, and create API

**Files:**
- Create: `src/features/enterprise-checkout/server/repository.ts`
- Create: `src/features/enterprise-checkout/server/service.ts`
- Create: `src/features/enterprise-checkout/server/service.test.ts`
- Create: `src/app/api/payments/enterprise/create/route.ts`
- Create: `src/app/api/payments/enterprise/create/route.test.ts`

**Interfaces:**
- `createEnterpriseCheckout(input, requestContext)` validates, generates/uses idempotency key, creates order first, invokes selected provider adapter, updates checkout reference/status, and returns a safe `EnterpriseCheckoutResult`.
- Same idempotency key + same normalized request returns the existing checkout result and does not create a duplicate order/provider invoice.
- Same idempotency key + materially different request fails conflict-safe.

- [ ] **Step 1: Write service RED tests**

Test order-before-provider-call, idempotent replay, provider failure retains auditable order, Selar remains awaiting confirmation, and no subscription/wallet side effects exist.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- src/features/enterprise-checkout/server/service.test.ts`

Expected: FAIL because repository/service do not exist.

- [ ] **Step 3: Implement repository and service**

Repository reads/writes only `platformEnterpriseOrders`. Store safe metadata only; never store provider API keys/secrets.

- [ ] **Step 4: Write API RED tests**

Test POST JSON validation, same-origin checks, supported provider only, generated/accepted idempotency header, safe 4xx/5xx errors, and no raw provider error in response.

- [ ] **Step 5: Implement `POST /api/payments/enterprise/create`**

Return:

```ts
{
  success: true,
  orderId,
  provider,
  redirectUrl,
  status: 'checkout_created' | 'awaiting_confirmation'
}
```

Do not return secrets/raw provider payloads.

- [ ] **Step 6: Run GREEN**

Run: `pnpm test -- src/features/enterprise-checkout/server src/app/api/payments/enterprise/create/route.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/enterprise-checkout/server src/app/api/payments/enterprise/create
git commit -m "feat: create enterprise checkout service"
```

---

### Task 5: Fail-closed NOWPayments webhook and enterprise status API

**Files:**
- Create: `src/features/enterprise-checkout/providers/nowpayments-webhook.ts`
- Create: `src/features/enterprise-checkout/providers/nowpayments-webhook.test.ts`
- Create: `src/app/api/webhooks/enterprise/nowpayments/route.ts`
- Create: `src/app/api/webhooks/enterprise/nowpayments/route.test.ts`
- Create: `src/app/api/payments/enterprise/status/route.ts`

**Interfaces:**
- `verifyNowPaymentsWebhook(rawBody, signature, secret)` returns parsed verified event or throws.
- `applyVerifiedNowPaymentsEvent(event)` performs monotonic/idempotent state update.
- Confirm only provider `payment_status === 'finished'`.
- `GET /api/payments/enterprise/status?orderId=...` returns safe public status fields only.

- [ ] **Step 1: Write RED webhook tests**

Test missing secret, missing signature, invalid signature, valid HMAC, non-final pending/confirming status, final `finished`, duplicate delivery, failed/expired status, and inability for a later lower-confidence event to overwrite confirmed state.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- src/features/enterprise-checkout/providers/nowpayments-webhook.test.ts`

Expected: FAIL.

- [ ] **Step 3: Implement WebCrypto SHA-512 HMAC verification**

Use raw body bytes and constant-time comparison implemented without Node-only `crypto` dependency. Parse JSON only after verification.

- [ ] **Step 4: Implement webhook route**

Require `x-nowpayments-sig`; return 400 for invalid signature, safe 5xx for server configuration failure, 200 for accepted idempotent delivery.

- [ ] **Step 5: Implement safe status endpoint**

Return order ID, checkout status, payment status, provider, amount/currency, project name, timestamps; omit email/phone/provider raw data/secrets.

- [ ] **Step 6: Run GREEN**

Run: `pnpm test -- src/features/enterprise-checkout/providers/nowpayments-webhook.test.ts src/app/api/webhooks/enterprise/nowpayments/route.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/enterprise-checkout/providers/nowpayments-webhook* src/app/api/webhooks/enterprise src/app/api/payments/enterprise/status
git commit -m "feat: verify enterprise payment webhooks"
```

---

### Task 6: Mkety enterprise checkout and payment-status UI

**Files:**
- Create: `src/features/enterprise-checkout/components/EnterpriseCheckoutForm.tsx`
- Create: `src/app/enterprise/checkout/page.tsx`
- Create: `src/app/payment/enterprise/pending/page.tsx`
- Create: `src/app/payment/enterprise/success/page.tsx`
- Create: `src/app/payment/enterprise/cancelled/page.tsx`
- Modify: enterprise public page/default CTA content or dedicated enterprise route renderer
- Modify: `src/features/platform-content/public-routes.ts` if route-contract coverage needs checkout/status exclusions/inclusion
- Test: `src/features/enterprise-checkout/components/EnterpriseCheckoutForm.test.tsx`

**Interfaces:**
- Public CTA from `/enterprise` routes to `/enterprise/checkout`.
- Form posts only customer/project/amount/provider; it cannot set payment status.
- Provider options: Crypto / NOWPayments and Card/Local / Selar.
- Success page says payment return received/verification pending until status API says `confirmed`.

- [ ] **Step 1: Write RED UI tests**

Assert CTA exists, form required fields, provider options, no model/tenant/billing controls, redirect response handling, and no unverified success copy.

- [ ] **Step 2: Run RED**

Run: `pnpm test -- src/features/enterprise-checkout/components/EnterpriseCheckoutForm.test.tsx`

Expected: FAIL.

- [ ] **Step 3: Implement Mkety-styled checkout page/form**

Use the new public shell/design system. Do not copy legacy purple/Vercel-era styling. Suggested scopes may be informational but amount remains the agreed quote amount entered by customer/server-validated.

- [ ] **Step 4: Implement pending/success/cancelled pages**

Success/pending pages query the safe status API and distinguish `confirmed` from `awaiting confirmation`. Cancelled page never changes server payment state merely because it is visited.

- [ ] **Step 5: Run GREEN**

Run focused UI tests plus public route tests.

- [ ] **Step 6: Commit**

```bash
git add src/features/enterprise-checkout/components src/app/enterprise src/app/payment/enterprise src/features/platform-content
git commit -m "feat: add Mkety enterprise checkout experience"
```

---

### Task 7: Cloudflare candidate/payment-secret wiring and non-charging checkout smoke

**Files:**
- Modify: `.github/workflows/mkety-public-candidate-deploy.yml`
- Modify: `.github/workflows/mkety-production-preflight.yml` only if additional read-only validation is necessary
- Create or Modify: production deployment workflow prepared for PUBLIC-15
- Modify: `docs/MKETY_PUBLIC_CUTOVER_RUNBOOK.md`

**Interfaces:**
- Candidate/production support the three legacy-compatible payment env names.
- Secret values must never be echoed.
- Candidate smoke must not submit a real paid transaction.

- [ ] **Step 1: Add static workflow tests/guards if the repo has workflow contract tests**

Assert workflow references:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
SELAR_ENTERPRISE_CHECKOUT_URL
```

and does not reference Vercel deployment commands.

- [ ] **Step 2: Update candidate validation**

Require at least one usable enterprise provider for production readiness. NOWPayments live verification requires both API key and IPN secret. Selar requires checkout URL.

- [ ] **Step 3: Inject configured payment secrets into candidate Worker**

Use Wrangler secret/config mechanisms without printing values. Do not borrow credentials from unrelated apps.

- [ ] **Step 4: Add safe candidate smoke**

Safe checks:
- enterprise checkout page returns 200.
- invalid checkout payload returns 4xx.
- status lookup for nonexistent order returns safe 404/empty result.
- webhook with missing/invalid signature is rejected.
- if Selar is configured, create a low-risk hosted checkout URL request without completing payment and assert Mkety order creation + hosted redirect domain.
- for NOWPayments, do not create a charge/invoice solely for CI unless provider documentation guarantees a non-charging sandbox/test endpoint configured by secret; otherwise validate adapter contract through tests and webhook fail-closed behavior in candidate.

- [ ] **Step 5: Update runbook**

Add payment-secret prerequisite, enterprise checkout smoke, webhook endpoint, rollback notes, and explicit statement that production uses Cloudflare Worker rather than Vercel.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows docs/MKETY_PUBLIC_CUTOVER_RUNBOOK.md
git commit -m "ci: verify enterprise checkout on Cloudflare candidate"
```

---

### Task 8: Full verification, public-site acceptance, and production cutover gate

**Files:**
- Modify only files required by defects found during verification.
- Modify: `docs/MKETY_DEVELOPMENT_CONTINUATION.md` after verified deployment.

**Interfaces:**
- This task closes PUBLIC-14 and PUBLIC-15 only after both Public Mkety AI and enterprise checkout candidate gates pass.

- [ ] **Step 1: Run targeted enterprise suite**

Run:

```bash
pnpm test -- src/features/enterprise-checkout src/app/api/payments/enterprise src/app/api/webhooks/enterprise
```

Expected: PASS.

- [ ] **Step 2: Run complete repository quality gate**

Run:

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm vinext:check
```

Expected: tests/typecheck/build/vinext PASS; lint has no errors/new blocking findings.

- [ ] **Step 3: Run connected Mkety DB migration/smoke**

Expected: existing public CMS/Public-AI tables and `platform_enterprise_orders` all pass.

- [ ] **Step 4: Run Cloudflare candidate**

Must pass:
- public route crawl.
- Public Mkety AI real-provider smoke, memory restore, New Chat isolation.
- enterprise checkout/status/webhook safe smoke.
- no Vercel dependency.

If dedicated Public-AI staging secrets remain absent, record PUBLIC-14 as BLOCKED and do not mutate production.

- [ ] **Step 5: Re-run read-only production preflight**

Confirm root/www DNS remain proxied and unrelated `learn.starpipsforex.com/* -> mklms` route remains untouched.

- [ ] **Step 6: Execute guarded PUBLIC-15 production deployment only after every gate above is green**

Deploy the verified server Worker SHA to Cloudflare, attach production DB/Public-AI/payment secrets, bind:

```text
mkety.com/*
www.mkety.com/*
```

Do not deploy via Vercel. Preserve proxied A records unless the reviewed workflow proves a route-specific change is necessary.

- [ ] **Step 7: Production smoke**

Verify:
- `https://mkety.com/` 200.
- `https://www.mkety.com/...` canonical 308 to root preserving path/query.
- public pages/pricing/docs/legal/contact.
- Public Mkety AI real response + cross-visit memory.
- `/enterprise` CTA and `/enterprise/checkout`.
- invalid enterprise API payload safe failure.
- webhook rejects missing signature.
- no legacy Vercel page is served for root/www.
- unrelated `learn.starpipsforex.com` behavior unchanged.

- [ ] **Step 8: Update handoff and resume platform sequence**

Record production Worker/version/SHA, route bindings, DB smoke, AI/provider evidence, payment compatibility env names, enterprise checkout state, rollback snapshot, and vinext auth warning in `docs/MKETY_DEVELOPMENT_CONTINUATION.md`.

Resume Platform work only afterward in this order:

```text
Auth #16
-> Webhooks #15
-> Billing #21
-> Entitlements #22
-> Usage/Credits #23
-> Wallet
```

- [ ] **Step 9: Commit handoff**

```bash
git add docs/MKETY_DEVELOPMENT_CONTINUATION.md
git commit -m "docs: hand off verified Mkety public production"
```
