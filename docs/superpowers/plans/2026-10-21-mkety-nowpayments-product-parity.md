# Mkety NOWPayments Product Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the approved NOWPayments currency-choice, invoice, verification, persistence, and idempotent settlement contract to every NOWPayments checkout in this repository.

**Architecture:** Keep provider integration and UI flow appropriate to each product boundary: main Mkety Billing/Enterprise use the shared Platform payment service; standalone Assist keeps its own customer/order/credit ledger and Worker boundary. Share the playbook and tested behavior without merging ledgers or silently moving credentials.

**Tech Stack:** TypeScript, Next.js/Vinext, Cloudflare Workers, Drizzle/PostgreSQL, D1 migrations, Jest and Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md`  
**Current playbook:** `customer-apps/assist/docs/nowpayments-integration-playbook.md`

## Global Constraints

- Order prices remain canonical fiat; for Assist the canonical price currency is USD.
- Normalize active provider currencies; prefer `USDTTON`, then `USDTTRC20`, then the first active currency.
- Server-side invoice creation revalidates any selected ticker against a fresh provider list.
- Fixed-rate invoices charge fees to the customer; no browser-supplied price/reference may override stored order state.
- Invoice IDs and payment IDs remain distinct; each product's own ledger remains authoritative.
- Only verified exact-reference/amount/currency terminal `finished` payments auto-settle; all grants remain idempotent.
- Assist's partial-payment exception remains Ops-only and provider-requeried.

## Review Focus

- Provider currency list timeout — customer can continue through a safe provider-hosted currency selection fallback.
- Forged or delisted ticker — server rejects it before invoice creation.
- Same ticker across different networks — persist and display distinct provider codes.
- Duplicate webhook/browser return race — one settlement/credit grant only.
- Partial payment or wrong reference/amount — no automatic grant.
- Invoice ID mistaken for payment ID during migration — preserve existing known meanings and only backfill rows proven safe.
- Assist isolation — do not move Assist's customer/credit ledger into Mkety Billing.

---

### Task 1: Promote the playbook into shared Mkety guidance

**Files:**
- Create: `docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md`
- Modify: `customer-apps/assist/docs/nowpayments-integration-playbook.md`
- Modify: `docs/MKETY_SHARED_PAYMENTS.md`
- Modify: `docs/README.md`

**Interfaces:**
- Produces: one shared review checklist plus an Assist-specific pointer and boundary note.

- [ ] **Step 1: Copy the approved general contract** into `docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md`; retain Assist-specific decisions in a clearly labeled subsection.
- [ ] **Step 2: Replace the Assist file body** with a short link to the shared checklist plus Assist-only settlement/partial-payment notes.
- [ ] **Step 3: Reconcile shared-payments wording** so provider transport/verification can be shared where designed, while Assist's own account, credit ledger and settlement ownership remain explicit.
- [ ] **Step 4: Add the document to the current docs index** and verify links.

### Task 2: Add tested shared currency normalization and defaulting

**Files:**
- Create: `src/features/payments/nowpayments-currencies.ts`
- Create: `src/features/payments/nowpayments-currencies.test.ts`
- Create: `src/app/api/payments/nowpayments/currencies/route.ts`

**Interfaces:**
- Produces: `normalizeNowPaymentsCurrencies(payload: unknown): string[]`, `chooseDefaultNowPaymentsCurrency(currencies: string[]): string`, and a no-store/cached safe endpoint returning `{ currencies, defaultCurrency, source }`.

- [ ] **Step 1: Test** array/object payloads, invalid/fiat values, duplicates, network-specific tickers, preferred defaults, and empty provider results.
- [ ] **Step 2: Run** `pnpm exec jest src/features/payments/nowpayments-currencies.test.ts --runInBand`; confirm it fails.
- [ ] **Step 3: Implement** the provider-backed currency list using server-only `NOWPAYMENTS_API_KEY`, bounded caching, and a safe provider-unavailable response with no secret leakage.
- [ ] **Step 4: Test** endpoint timeout, malformed provider response, and no cache of user-specific payment data.

### Task 3: Apply currency choice to shared Mkety Billing and Enterprise AI

**Files:**
- Modify: `src/features/billing/gateways/types.ts`
- Modify: `src/features/billing/gateways/nowpayments.ts`
- Modify: `src/features/billing/gateways/nowpayments.test.ts`
- Modify: `src/app/api/tenants/[tenant]/billing/checkout/route.ts`
- Modify: `src/app/app/[tenant]/billing/checkout/page.tsx`
- Modify: `src/app/api/payments/nowpayments/start/route.ts`
- Create: `src/app/api/payments/nowpayments/start/route.test.ts`
- Modify: `src/features/ai-runtime/components/EnterpriseAiCheckoutForm.tsx`
- Modify: `src/app/api/tenants/[tenant]/enterprise-ai/checkout/route.ts`
- Modify: `src/features/enterprise-checkout/providers/nowpayments.ts`
- Modify: `src/features/enterprise-checkout/providers/nowpayments.test.ts`

**Interfaces:**
- Consumes: Task 2 currency helpers.
- Produces: optional validated `payCurrency` passed only to the NOWPayments adapter; returned `providerCurrency` remains canonical fiat.

- [ ] **Step 1: Add failing tests** proving selected currency is normalized, server-revalidated, and passed as `pay_currency` for Billing, Enterprise AI, and any Assist request using the central start route; assert `price_amount`/`price_currency` stay unchanged and fixed-rate/customer-paid-fee fields are set.
- [ ] **Step 2: Run** focused billing and Enterprise adapter Jest suites; expect new assertions to fail.
- [ ] **Step 3: Add a reusable customer selector** to Billing and Enterprise AI checkout; audit the Assist broker-start route and update it only if it is still an active caller; show all active network-specific choices and safe provider-hosted fallback when the list is unavailable.
- [ ] **Step 4: Revalidate in the server adapters** immediately before invoice creation; reject a stale/forged ticker and never trust a client amount/reference.
- [ ] **Step 5: Run** `pnpm exec jest src/features/billing/gateways/nowpayments.test.ts src/features/enterprise-checkout/providers/nowpayments.test.ts --runInBand`.

### Task 4: Make Enterprise payment links selectable at the customer paypoint

**Files:**
- Modify: `src/features/enterprise-checkout/server/admin-actions.ts`
- Modify: `src/features/enterprise-checkout/server/service.ts`
- Modify: `src/features/enterprise-checkout/server/repository.ts`
- Modify: `src/features/enterprise-checkout/components/AdminEnterprisePaymentLinkForm.tsx`
- Create: `src/app/payment/enterprise/checkout/page.tsx`
- Create: `src/app/api/payments/enterprise/nowpayments/start/route.ts`
- Modify: `src/shared/db/schema/platform-enterprise-orders.ts`
- Create: `src/shared/db/migrations/0045_enterprise_nowpayments_checkout_token.sql`
- Modify: `src/shared/db/migrations/meta/_journal.json`
- Create: `src/shared/db/migrations/meta/0045_snapshot.json`

**Interfaces:**
- Produces: an opaque, expiring, single-order customer payment capability; a payment-page request accepts only a selected current NOWPayments currency and never exposes customer/order data by guessable ID alone.

- [ ] **Step 1: Test** unguessable/expiring link access, order scope, idempotent invoice creation, duplicate starts, and server currency revalidation.
- [ ] **Step 2: Issue a payment-page capability** when Ops creates the link; store only a hash/expiry and keep exact amount/provider order state server-side.
- [ ] **Step 3: Create the provider invoice only after the customer selects a network**; keep the provider order reference canonical and invoice ID separate.
- [ ] **Step 4: Preserve Flutterwave/Kora link behavior and existing Enterprise fulfillment gates.**
- [ ] **Step 5: Run** Enterprise service/action/provider tests and `pnpm db:check:migrations`.

### Task 5: Align Assist to the shared contract without merging its ledger

**Files:**
- Modify: `customer-apps/assist/docs/nowpayments-integration-playbook.md`
- Modify: `customer-apps/assist/src/payments/nowpayments.ts`
- Modify: `customer-apps/assist/src/index.ts`
- Modify: `customer-apps/assist/src/ui.ts`
- Modify: `customer-apps/assist/scripts/nowpayments-checkout.test.mjs`
- Modify: `customer-apps/assist/migrations/0050_nowpayments_invoice_payment_identity.sql` only if audit finds a confirmed defect; otherwise preserve it unchanged.

- [ ] **Step 1: Verify** Assist already offers provider currencies and TON/TRC20/fallback defaults; add only tests for uncovered playbook cases.
- [ ] **Step 2: Verify** server-side currency allow-listing, invoice/payment ID separation, exact quote, webhook verification, and Ops-only partial approval.
- [ ] **Step 3: Do not add a migration or backfill** unless a tested missing persisted field is found; preserve the known invoice/payment ID migration semantics.
- [ ] **Step 4: Run** `cd customer-apps/assist && npm run check:all && npm run type-check`.

### Task 6: Persist network/provider evidence and validate every NOWPayments entry point

**Files:**
- Modify: `src/shared/db/schema/billing-checkouts.ts`
- Modify: `src/shared/db/schema/billing-settlements.ts`
- Modify: `src/shared/db/schema/platform-enterprise-orders.ts`
- Create: `src/shared/db/migrations/0046_nowpayments_network_evidence.sql`
- Create: `src/shared/db/migrations/meta/0046_snapshot.json`
- Modify: `src/shared/db/schema/billing.test.ts`
- Modify: `src/features/enterprise-checkout/server/service.test.ts`

- [ ] **Step 1: Add failing schema tests** for network ticker, provider status, actual paid fiat, and separate invoice/payment identifiers.
- [ ] **Step 2: Add nullable additive fields** for network/provider evidence without changing canonical amount/currency fields or rewriting old history.
- [ ] **Step 3: Update Ops/customer history projections** to show payment ID and network where appropriate without leaking credentials/raw sensitive provider payload.
- [ ] **Step 4: Test** `waiting`, `confirming`, `sending`, `partially_paid`, failed, expired, finished, amount mismatch, currency mismatch, duplicate webhook, and one-time settlement.
- [ ] **Step 5: Run** focused Jest suites, `pnpm db:check:migrations`, root typecheck/build, and Assist checks.

### Task 7: Final payment evidence and rollout gate

**Files:**
- Modify: `docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md`
- Modify: `docs/MKETY_SHARED_PAYMENTS.md`
- Modify: current workstream status after exact test/runtime evidence exists.

- [ ] **Step 1: Run** main Platform candidate and product-specific test gates on the exact SHA.
- [ ] **Step 2: Verify** no payment is created during CI; use a low-value provider transaction only in a separately authorized payment smoke.
- [ ] **Step 3: Record** exact SHA, focused test results, migration status, and product-by-product coverage; do not claim production behavior until a fresh runtime check passes.
