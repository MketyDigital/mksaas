# Account-bound inline checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make public pricing and authenticated checkout reliably reach the existing Mkety-hosted payment experiences for all configured providers.

**Architecture:** Preserve account-first signup, server-owned Billing checkout records, provider adapters and verified settlement. Centralize provider readiness/order, normalize checkout return paths to the canonical app route, and reuse the existing NOWPayments, Flutterwave Inline and Kora embedded pages.

**Tech Stack:** Next.js 16 App Router via Vinext, TypeScript, React, Jest, Drizzle Billing services.

**Spec:** `docs/superpowers/specs/2026-10-02-account-bound-inline-checkout-design.md`

## Global Constraints

- NOWPayments is first/default only when API and IPN credentials are configured.
- Flutterwave v3 Inline is second when the app-to-broker secret and at least one operator/admin-stored currency quote are configured. Standard API, webhook hash and Inline public key belong to the central broker.
- Kora is shown only when both public and secret keys are configured.
- Client-supplied price, payment return URLs, provider callbacks and widget events never grant access.
- Only verified, exact-amount/currency, idempotent settlement activates a subscription or entitlement.
- Public pricing preserves the plan and term through signup/login and routes to the authenticated workspace checkout.
- Do not change any Assist branch or Assist-only product code.
- Do not perform production migration, secret mutation, deployment or live customer charge in this plan.

## Review Focus

- Partial provider configuration: a missing optional provider must not hide another configured provider; Task 1 tests each credential combination.
- Legacy `/t/{tenant}` versus canonical `/app/{tenant}` return paths: preserve valid tenant checkout returns while rejecting cross-tenant or external destinations; Task 2 tests both aliases and hostile inputs.
- Browser return or provider-widget success without webhook settlement: access must remain inactive; Task 4 runs the existing settlement-boundary tests and adds a return-state regression if missing.
- Flutterwave method restriction: Dashboard-enabled rails must not be narrowed by an application `payment_options` allow-list; Task 3 asserts the outbound Standard API body.
- Flutterwave runtime boundary: product app workers require the broker secret plus operator-stored FX rates; the central broker owns its Standard API, webhook hash and Inline public key.
- Flutterwave currency without a configured quote: the method must not be advertised as ready for that currency; Task 1 adds a readiness/currency regression.

---

### Task 1: Centralize provider readiness and order

**Files:**

- Create: `src/features/payments/provider-availability.ts`
- Create: `src/features/payments/provider-availability.test.ts`
- Modify: `src/app/app/[tenant]/billing/checkout/page.tsx`
- Modify: `src/app/api/tenants/[tenant]/billing/checkout/route.ts`
- Modify: `src/app/api/tenants/[tenant]/enterprise-ai/checkout/route.ts`
- Modify: `src/app/ops/[tenant]/platform-control/page.tsx`
- Modify: `src/app/ops/[tenant]/platform-control/[module]/page.tsx`
- Modify: `src/app/ops/[tenant]/platform-control/enterprise-payments/page.tsx`
- Modify: `src/features/payments/components/PaymentSettingsForm.tsx`
- Modify: existing payment readiness displays only where they need to use the same helper

**Interfaces:**

- Define `MketyCheckoutProvider = 'nowpayments' | 'flutterwave' | 'kora'` and `PaymentProviderOption = { provider: MketyCheckoutProvider; label: string; detail: string }` in the new module.
- Produces `getMketyPaymentProviderStatuses(input)` for ordered generic ready/incomplete dashboard statuses and `getAvailableMketyPaymentProviders(input): PaymentProviderOption[]` for customer checkout. Both consume the same input; neither returns credential values. `input` contains `nowpayments: { apiKey?: string; ipnSecret?: string }`, `flutterwave: { brokerSecret?: string; collectionCurrencies: readonly string[]; hasConfiguredCurrencyQuote?: boolean }`, and `kora: { publicKey?: string; secretKey?: string }`. Product checkout checks the shared broker secret and admin-stored quote; the central broker checks its Standard API, webhook hash and Inline public key.
- Provider order is the fixed tuple `nowpayments`, `flutterwave`, `kora`, filtered by complete provider configuration.
- Flutterwave is complete only when the app-to-broker secret is present, an operator-stored quote exists, and the selected collection currency is in `collectionCurrencies`. Generate that list from the server-owned admin FX settings; the central payment broker remains responsible for its own provider credentials.

- [x] **Step 1: Write the failing provider-availability tests** for all three ready providers in fixed order; NOWPayments only; Flutterwave only; Kora only; incomplete optional-provider credentials; no configured provider; and Flutterwave with/without an operator-stored quote (including implicit USD); dashboard status for each provider without exposing secrets.
- [x] **Step 2: Run `corepack pnpm exec jest src/features/payments/provider-availability.test.ts --runInBand`** and confirm the new module/API is missing.
- [x] **Step 3: Implement the pure provider resolver** in `src/features/payments/provider-availability.ts`; do not read `process.env` inside the pure resolver.
- [x] **Step 4: Update billing and Enterprise AI checkout pages and APIs** to use the same resolver for rendering and request-time provider validation. Preserve user-selected Flutterwave currency and server-owned FX quoting.
- [x] **Step 5: Run the focused resolver and checkout-route tests** and confirm ready providers render in the expected order while incomplete providers return the existing unavailable response.
- [x] **Step 6: Commit** as `fix: align checkout provider readiness`.

### Task 2: Normalize safe checkout return paths

**Files:**

- Create: `src/features/payments/return-path.ts`
- Create: `src/features/payments/return-path.test.ts`
- Modify: `src/app/api/tenants/[tenant]/billing/checkout/route.ts`
- Modify: `src/app/payments/flutterwave/inline/page.tsx`
- Modify: `src/app/payments/kora/embedded/page.tsx`
- Modify: `src/features/billing/gateways/kora.test.ts`
- Modify or create route contract tests for both provider launcher pages

**Interfaces:**

- Produces `buildTenantPaymentReturnPath(input: { tenantSlug: string; surface: 'billing' | 'enterprise-ai'; planKey?: string; termKey?: string; state?: 'returned' | 'cancelled' }): string` using `/app/{tenant}/billing/checkout` or `/app/{tenant}/enterprise-ai`.
- Produces `normalizeTenantPaymentReturnPath(value: string, tenantSlug: string): string | null`; only those two `/app/{tenant}/...` routes and their exact `/t/{tenant}/...` aliases are accepted, with aliases normalized to `/app`.

- [x] **Step 1: Write failing tests** for canonical `/app` paths, same-tenant `/t` normalization, preservation of safe query parameters, and rejection of external URLs, protocol-relative URLs, malformed tenant slugs and another tenant's path.
- [x] **Step 2: Run the focused tests** and confirm the alias currently fails the launcher contract.
- [x] **Step 3: Implement the return-path helper** with URL parsing against a fixed inert origin and exact tenant/path checks.
- [x] **Step 4: Generate canonical `/app` returns from the SaaS checkout API** and use the shared validator in Flutterwave and Kora launcher pages.
- [x] **Step 5: Run the helper, Kora adapter, Flutterwave adapter and route tests**; confirm valid aliases reach the app checkout and invalid values remain not-found.
- [x] **Step 6: Commit** as `fix: normalize payment checkout returns`.

### Task 3: Restore unrestricted configured Flutterwave methods

**Files:**

- Modify: `src/features/payments/flutterwave-standard.ts`
- Modify: `src/features/payments/flutterwave-standard.test.ts`
- Modify: `src/features/payments/flutterwave-payment-methods.test.ts` only if a missing currency contract is exposed

**Interfaces:**

- Preserve `createFlutterwaveHostedCheckout(input): Promise<string>` and the existing Standard API contract.
- Do not send the `payment_options` property. Keep the server-generated payload hash, source metadata, redirect allow-list and NGN bank-transfer expiry behavior.

- [x] **Step 1: Keep the existing failing regression** that asserts the hosted checkout request has no `payment_options`; add a focused assertion that the request still includes the validated amount, currency and reference.
- [x] **Step 2: Run `corepack pnpm exec jest src/features/payments/flutterwave-standard.test.ts --runInBand`** and confirm the current request contains `card,account`.
- [x] **Step 3: Remove only the `payment_options` allow-list** from `createFlutterwaveHostedCheckout`.
- [x] **Step 4: Run the focused Flutterwave tests** and confirm the Standard request remains signed and contains no private secret.
- [x] **Step 5: Commit** as `fix: respect Flutterwave dashboard payment methods`.

### Task 4: Verify public-to-app checkout journey and fail-closed settlement

**Files:**

- Create or extend: `src/features/billing/account-first-checkout-contract.test.ts`
- Test: existing public pricing content and route contracts
- Test: existing self-service checkout and settlement tests
- Modify: `src/features/platform-content/components/public/MketyPricingPlans.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx` or `src/app/(auth)/select-tenant/page.tsx` only where a test proves the handoff loses plan or term

**Interfaces:**

- Public self-service CTA continues to pass exact `plan` and selected `term` into signup/login.
- Account/tenant selection lands at `/app/{tenant}/billing/checkout` with those values unchanged.
- The existing Mkety provider pages remain responsible for their provider-owned embedded surfaces and secure hosted fallback.

- [x] **Step 1: Add or extend a route-flow contract test** for public pricing → signup → tenant selection → canonical app checkout, asserting the plan and term survive every transition.
- [x] **Step 2: Run that focused contract test** and confirm a missing hop/parameter fails before changing production code.
- [x] **Step 3: Preserve the existing public pricing CTA contract**: `/signup?plan={plan}&term={term}`; new-account auth returns through `/select-tenant`; tenant selection lands on `/app/{tenant}/billing/checkout?plan={plan}&term={term}`. Change only the exact route that the failing test identifies.
- [x] **Step 4: Run the existing return-state and settlement tests** and assert browser returns, cancellations and provider widget callbacks do not activate billing; only verified settlement does.
- [x] **Step 5: Run public pricing, signup/login/tenant routing, self-service checkout, provider launcher and Billing settlement tests.**
- [x] **Step 6: Commit** as `fix: complete account-bound checkout journey`.

### Task 5: Exact-branch verification and review

**Files:**

- No production code unless a check identifies a concrete regression.
- Update the checkout spec/handoff only with exact local and remote evidence.

- [x] **Step 1: Run `corepack pnpm test`.** Expected: all suites pass; report any unrelated main-branch failures by name.
- [x] **Step 2: Run `corepack pnpm type-check` and `corepack pnpm lint`.** Expected: no type errors or lint errors; existing warnings are reported without claiming zero-warning lint.
- [x] **Step 3: Run `corepack pnpm build`, `corepack pnpm exec vinext check`, and `corepack pnpm db:check:migrations` under pnpm 10.28.1.** Expected: build succeeds; record the existing Vinext webpack diagnostic precisely. If the migration script again hits the environment's tsx IPC `EPERM`, retry it with `node --experimental-strip-types scripts/check-migration-baseline.ts` and record the exact result.
- [x] **Step 4: Review `git diff --check`, confirm no changed paths under `customer-apps/assist`, and inspect the final branch diff.**
- [x] **Step 5: Commit** any documentation evidence separately. Do not deploy or enable production customer flags from this plan.


## Exact-branch verification record

- Branch: `codex/mksaas-completion-20261002`, based on `main` at `127aae32b9ce21cb2e52e94b9b21ee7218b1d6ec`.
- `corepack pnpm test`: 266 suites passed, 1 skipped; 1,265 tests passed, 1 skipped.
- `corepack pnpm type-check`: passed.
- `corepack pnpm lint`: 0 errors, 19 warnings (existing `<img>`, import-order and accessible-label warnings).
- `corepack pnpm build`: passed; Vinext reports the existing partial webpack config support and gray-matter direct-eval diagnostic.
- `corepack pnpm exec vinext check`: 92% compatibility; webpack config remains the single reported issue, with CDN font and App Router strict-mode partial support.
- `node --experimental-strip-types scripts/check-migration-baseline.ts`: passed; Drizzle SQL order, journal and latest snapshot aligned.
- `git diff --check`: passed on the final working tree.
- Final reviewer pass: no blocking issues; the checkout APIs' currency rejection and return-currency behavior lack route-level tests. The currency resolver and return-path contracts are covered directly.
- No changed paths under `customer-apps/assist`; no Assist branch checkout or modifications.
- No production deployment, live charge, secret mutation, or customer acceptance was performed.
