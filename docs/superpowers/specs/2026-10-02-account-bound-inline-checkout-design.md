# Account-bound inline checkout design

**Date:** 2026-10-02
**Repository:** `MketyDigital/mksaas`
**Base:** `main` at `127aae32b9ce21cb2e52e94b9b21ee7218b1d6ec`
**Working branch:** `codex/mksaas-completion-20261002`

## Goal

Make the public pricing purchase journey and authenticated app checkout reliably reach the same account-bound payment experience. Keep the existing signup/login-first boundary and server-owned billing catalog. On supported Mkety checkout pages, customers should be able to start an embedded payment without losing their selected plan or billing term.

## Current evidence

- Public `/pricing` renders published plan cards. Self-service calls go to `/signup?plan=...&term=...`, then account selection, then the authenticated workspace checkout.
- The app checkout creates server-owned billing records and currently displays one submit button per configured provider. Provider checkout widgets are launched on separate Mkety routes.
- NOWPayments checkout creation returns an invoice identifier and a Mkety embedded invoice route; Flutterwave v3 and Kora also have Mkety-hosted checkout routes.
- The SaaS checkout API constructs `/t/{tenant}/billing/checkout` return paths. The public app proxy accepts `/t/{tenant}` aliases and rewrites them to `/app/{tenant}`, but the Flutterwave and Kora launcher return-path validators accept only `/app/{tenant}/...`. This makes the generated aliases inconsistent with the launcher contract.
- The hosted Flutterwave request currently sends `payment_options=card,account`; the shared-payments design and existing regression test require Flutterwave Dashboard settings to remain authoritative without a per-checkout allow-list.
- Provider readiness is evaluated separately in the app checkout, APIs and dashboards. App runtimes authenticate to the central Flutterwave broker; the broker owns Standard API, webhook and Inline credentials. Platform Control FX rates are database settings rather than environment variables.
- Flutterwave's Standard API, webhook hash and public key belong to the central payment broker. Customer app checkouts use the broker secret, while operator-managed collection currency rates and markup are persisted in the Platform Control Payments module.

## Selected approach

Use one shared account-bound checkout experience and keep the server checkout and settlement boundary. Public pricing remains a plan-selection and account-entry surface; it preserves plan and term through signup/login and forwards the customer to the workspace checkout. Payment remains tied to a verified workspace membership. The app checkout owns provider selection and rendering, so an unauthenticated visitor cannot create an unowned subscription.

Keep provider adapters responsible for creating and verifying provider transactions. Add a reusable checkout UI that starts a server checkout, then renders the supported provider surface inside the Mkety checkout context:

- NOWPayments is the first/default option when API and IPN credentials are configured. Embed the provider invoice widget and retain a hosted secure fallback.
- Flutterwave v3 is second when the app-to-broker credential is configured and at least one operator-managed collection-currency quote is stored. The central broker owns its Standard API key, webhook hash and Inline public key. Use the Inline checkout experience and do not send a method allow-list; currency-specific rates and provider-side account eligibility continue to govern available methods.
- Kora appears only when both its public and secret keys are configured. Use the provider-controlled embedded checkout.

Provider readiness and ordering must come from one server-owned capability result shared by checkout page rendering, request-time checkout validation, and operator dashboard readiness displays in Platform Control and Enterprise Payments. Flutterwave readiness consumes the app broker secret and normalized operator-stored FX rates; central-only Flutterwave credentials are checked by the central broker when it creates checkout. Only currencies with a stored FX rate are advertised, even though the USD identity quote is supported by the quote utility. The dashboard may show generic ready/incomplete status for every provider, but must never expose credential values. A missing optional provider must not disable another ready provider. A visible provider must still fail closed if configuration changes between page render and submission.

## Checkout and settlement flow

1. A visitor chooses a plan and prepaid term on public pricing.
2. Signup/login and workspace selection preserve those values and route to `/app/{tenant}/billing/checkout`.
3. The server validates membership and resolves the canonical plan, term, amount, currency and provider capability. Client-supplied prices are ignored.
4. The customer selects a configured provider. The browser asks the existing checkout API to create a pending checkout; the server returns only the provider data needed to render that provider's widget.
5. The widget runs within the Mkety checkout context. Closing or returning from it only changes the displayed checkout state.
6. Provider webhook verification, server-side transaction/charge verification, exact reference/amount/currency matching and idempotent Billing settlement remain the only route to an active subscription or entitlement.
7. Return/cancel navigation uses a single canonical allow-listed app route. Legacy `/t/{tenant}` aliases may be accepted only after validating the tenant and normalizing to `/app/{tenant}`.

## Failure behavior

- If no provider is configured, show an explicit unavailable state and a support route; do not render a dead payment button.
- If one provider is incomplete or its request fails, retain the other configured methods and show a retryable provider-specific message.
- A provider return, client callback, widget success event or browser query parameter never grants access.
- An ambiguous provider outcome keeps the checkout pending for webhook reconciliation; retry must not create a second settlement for the same checkout.
- Never return provider secrets, webhook keys, cost data or internal payment policy to the browser.

## Scope

Included:

- Public pricing plan/term handoff into authenticated checkout.
- Shared embedded provider UI for self-service workspace and Mail plans, plus existing Enterprise AI funding checkout where the same Billing adapters apply.
- Unified provider readiness/order across checkout and operator dashboards, redirect-path validation and error/loading/empty states.
- Regression coverage for public handoff, provider capability visibility, operator readiness status, embedding, route normalization and verified-settlement boundaries.

Excluded:

- Guest checkout or payment before account/workspace creation.
- Changes to plan prices, subscription lifecycle, Mail or Enterprise AI entitlements, or billing ledger semantics.
- Enabling Mail external-client service or Enterprise AI customer inference.
- Production migration, secret mutation, deployment, live customer charge or customer messaging.
- Changes on any Assist branch or Assist-only product code.

## Verification

- Focused red/green tests for provider readiness, page/API agreement, canonical return paths, Flutterwave method behavior and provider rendering.
- Full repository Jest tests, type-check, lint, Vinext build, migration baseline checks and targeted route/build acceptance.
- Read-only browser or local route checks for public pricing → signup/login → workspace → checkout, and for each configured provider state. Live settlement must remain unclaimed unless a controlled approved transaction is actually performed.

## Self-review

- Prices and access remain server-authoritative; browser returns remain non-entitling.
- Provider capabilities are optional and independently gated; NOWPayments remains first, Flutterwave second, Kora conditional.
- Account-first behavior is preserved, and the public pricing CTA does not create an unowned payment.
- The `/t` alias is handled as a routing compatibility layer, not as a new source of tenant authority.
- The design reuses the existing adapters, Billing records, webhooks and settlement services; no new ledger or migration is planned unless implementation reveals a concrete need.
