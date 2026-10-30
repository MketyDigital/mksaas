# Mkety NOWPayments Product Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Apply the approved NOWPayments currency-choice, invoice, verification, persistence, and idempotent settlement contract to every NOWPayments checkout in this repository.

**Architecture:** Keep provider integration and UI flow appropriate to each product boundary: main Mkety Billing/Enterprise use the shared Platform payment service; standalone Assist keeps its own customer/order/credit ledger and Worker boundary. Share the playbook and tested behavior without merging ledgers or silently moving credentials.

**Tech Stack:** TypeScript, Next.js/Vinext, Cloudflare Workers, Drizzle/PostgreSQL, D1 migrations, Jest and Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md`  
**Current playbook:** `docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md` (Assist links to it from `customer-apps/assist/docs/nowpayments-integration-playbook.md`)

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

- [x] **Step 1: Copy the approved general contract** into `docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md`; retain Assist-specific decisions in a clearly labeled subsection.
- [x] **Step 2: Keep the Assist playbook path as a link** to the shared checklist while preserving product-specific Assist decisions.
- [x] **Step 3: Reconcile shared-payments wording** so provider transport/verification can be shared where designed, while Assist's own account, credit ledger and settlement ownership remain explicit.
- [x] **Step 4: Add the document to the current docs index** and verify links.

### Task 2: Add tested shared currency normalization and defaulting

**Files:**
- Create: `src/features/payments/nowpayments-currencies.ts`
- Create: `src/features/payments/nowpayments-currencies.test.ts`
- Create: `src/app/api/payments/nowpayments/currencies/route.ts`

**Interfaces:**
- Produces: `normalizeNowPaymentsCurrencies(payload: unknown): string[]`, `defaultNowPaymentsCurrency(currencies: string[]): string | null`, and a no-store safe endpoint returning `{ currencies, defaultCurrency, source }`.

- [x] **Step 1: Test** array payloads, malformed entries, duplicates, network-specific tickers, preferred defaults, and empty provider results.
- [x] **Step 2: Run** the focused tests after recording the missing helper as the initial failure.
- [x] **Step 3: Implement** the provider-backed currency list using server-only `NOWPAYMENTS_API_KEY` and a safe provider-unavailable response with no secret leakage.
- [x] **Step 4: Test** unavailable provider response and `no-store` endpoint behavior; explicit five-second timeout is used where the runtime supports `AbortSignal.timeout`.

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

- [x] **Step 1: Add failing tests** proving selected currency is normalized, server-revalidated, and passed as `pay_currency` for the active Platform checkout paths; assert canonical USD and fixed-rate/customer-paid-fee fields stay intact. Assist was checked read-only and remains standalone.
- [x] **Step 2: Run** focused billing and Enterprise adapter Jest suites.
- [x] **Step 3: Add customer selectors** to Billing and Enterprise AI checkout; preserve their unavailable-provider fallback. Assist was not edited because it is production and outside this change boundary.
- [x] **Step 4: Revalidate in the server adapters** immediately before invoice creation; reject a stale/forged ticker and never trust a client amount/reference.
- [x] **Step 5: Run** focused Billing and Enterprise adapter Jest suites; see current workstream status for exact counts.

### Task 4: Make Enterprise payment links selectable at the customer paypoint

**Files:**
- Modify: `src/features/enterprise-checkout/server/admin-actions.ts`
- Modify: `src/features/enterprise-checkout/server/service.ts`
- Modify: `src/features/enterprise-checkout/server/repository.ts`
- Modify: `src/features/enterprise-checkout/components/AdminEnterprisePaymentLinkForm.tsx`
- Create: `src/app/payment/enterprise/checkout/page.tsx`
- Create: `src/app/api/payments/enterprise/nowpayments/start/route.ts`
- Modify: `src/shared/db/schema/platform-enterprise-orders.ts`
- Create: `src/shared/db/migrations/0047_enterprise_nowpayments_checkout_token.sql`
- Modify: `src/shared/db/migrations/meta/_journal.json`
- Create: `src/shared/db/migrations/meta/0047_snapshot.json`

**Interfaces:**
- Produces: an opaque, expiring, single-order customer payment capability; a payment-page request accepts only a selected current NOWPayments currency and never exposes customer/order data by guessable ID alone.

- [x] **Step 1: Test** token generation/expiry, order scope, one-time invoice claim, and selected ticker revalidation.
- [x] **Step 2: Issue a payment-page capability** when Ops creates a NOWPayments link; store only a hash/expiry and keep exact amount/provider order state server-side.
- [x] **Step 3: Create the provider invoice only after the customer selects a network**; keep the provider order reference canonical and invoice ID separate.
- [x] **Step 4: Preserve Flutterwave/Kora link behavior and existing Enterprise fulfillment gates.**
- [x] **Step 5: Run** Enterprise service/action/provider tests and the migration baseline.

### Task 5: Align Assist to the shared contract without merging its ledger

**Files:**
- Modify: `customer-apps/assist/docs/nowpayments-integration-playbook.md`
- Modify: `customer-apps/assist/src/payments/nowpayments.ts`
- Modify: `customer-apps/assist/src/index.ts`
- Modify: `customer-apps/assist/src/ui.ts`
- Modify: `customer-apps/assist/scripts/nowpayments-checkout.test.mjs`
- Modify: `customer-apps/assist/migrations/0050_nowpayments_invoice_payment_identity.sql` only if audit finds a confirmed defect; otherwise preserve it unchanged.

- [x] **Step 1: Verify** Assist offers provider currencies and TON/TRC20/fallback defaults; its existing currency and invoice tests cover those paths.
- [x] **Step 2: Verify** server-side currency allow-listing, invoice/payment ID separation, exact quote, webhook verification, and Ops-only partial approval. A later read-only checkout of Assist source identified a currency comparison already corrected by the Assist-owned update; the user confirms the fix is complete. Assist remained untouched in this workstream.
- [x] **Step 3: Do not add a migration or backfill**; migration 0050 already preserves the known invoice/payment ID meanings and no missing persisted field was found.
- [ ] **Step 4: Run** `cd customer-apps/assist && npm run check:all && npm run type-check`. `check:all` passes 205 tests plus operator UI/security/production contracts; `type-check` cannot start because `@cloudflare/workers-types` is not installed in this checkout.

### Task 6: Persist network/provider evidence and validate every NOWPayments entry point

**Files:**
- Modify: `src/shared/db/schema/billing-checkouts.ts`
- Modify: `src/shared/db/schema/billing-settlements.ts`
- Modify: `src/shared/db/schema/platform-enterprise-orders.ts`
- Create: `src/shared/db/migrations/0048_nowpayments_network_evidence.sql`
- Modify: `src/shared/db/migrations/meta/_journal.json`
- Create: `src/shared/db/migrations/meta/0048_snapshot.json`
- Modify: `src/shared/db/schema/billing.test.ts`
- Modify: `src/features/enterprise-checkout/server/service.test.ts`

- [x] **Step 1: Add migration tests** for nullable selected/observed network evidence fields and preservation of existing orders/checkouts/settlements.
- [x] **Step 2: Add nullable additive ticker fields** without changing canonical amount/currency fields or rewriting old history.
- [x] **Step 3: Update Ops/customer history projections** to show payment ID and network where appropriate without leaking credentials/raw sensitive provider payload. Tenant Billing history now shows its stored payment ID and selected network.
- [x] **Step 4: Test** `waiting`, `confirming`, `sending`, `partially_paid`, failed, expired, finished, amount mismatch, currency mismatch, duplicate settlement, and one-time settlement across the Platform adapter and settlement service.
- [ ] **Step 5: Run** focused Jest suites, migration baseline, root typecheck/build, and Assist checks. Focused payment suites, migration baseline, root typecheck, and Assist `check:all` pass; Next build cannot load the checkout's SWC native binding, and Assist typecheck is blocked by missing `@cloudflare/workers-types`.

### Task 7: Final payment evidence and rollout gate

**Files:**
- Modify: `docs/NOWPAYMENTS_INTEGRATION_PLAYBOOK.md`
- Modify: `docs/MKETY_SHARED_PAYMENTS.md`
- Modify: current workstream status after exact test/runtime evidence exists.

- [ ] **Step 1: Run** main Platform candidate and product-specific test gates on the exact SHA.
- [ ] **Step 2: Verify** no payment is created during CI; use a low-value provider transaction only in a separately authorized payment smoke.
- [ ] **Step 3: Record** exact SHA, focused test results, migration status, and product-by-product coverage; do not claim production behavior until a fresh runtime check passes.
