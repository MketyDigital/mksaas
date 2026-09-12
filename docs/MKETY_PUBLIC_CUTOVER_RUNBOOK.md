# Mkety Public Website Production Cutover Runbook

> `AGENTS.md` remains the architectural authority. `docs/MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md` governs the current public commercial/product/domain contract. This runbook governs operational promotion of the verified public website to `mkety.com`.

## Purpose

Promote the exact verified Mkety public candidate to production without mixing public-site work with unfinished `app.mkety.com` work or unrelated infrastructure.

## Hard gates before production mutation

Production cutover is blocked until all of the following are true:

1. The public-site feature branch has a recorded exact candidate SHA.
2. Tests, typecheck, blocking lint, build, vinext compatibility and connected Mkety DB smoke are green for that SHA.
3. The isolated `mkety-public-candidate` Worker is deployed successfully.
4. Every canonical public route returns HTTP 200 from the candidate.
5. Published homepage, public pages, pricing and every public docs article pass the production-copy/privacy sweep.
6. No public content contains template branding, development/WIP/staging/candidate/debug wording, internal repositories/GitHub/source references, private origin hostnames, or internal implementation details.
7. Connected published pricing contains only Starter, AI Workspace, Automation Workspace, Deploy Workspace, Mkety One and Enterprise with the approved prices/features/descriptions/CTAs.
8. Academy handoffs use `https://academy.mkety.com`; Trading handoffs use `https://trade.mkety.com` and remain Custom / Enterprise.
9. Public Mkety AI is visible and uses a dedicated public runtime boundary.
10. At least one dedicated `MKETY_PUBLIC_*` AI provider is configured and returns a real grounded answer.
11. Public AI same-browser memory, restored history and New Chat isolation pass.
12. Public AI correctly states the canonical public commercial matrix and Academy/Trading domains, does not present removed plans, and refuses private repository/source disclosure.
13. BOTH Enterprise payment gateways are configured and safely verified: NOWPayments and Selar.
14. Enterprise checkout remains non-entitling/non-provisioning until verified provider confirmation.
15. Read-only production preflight records current `mkety.com`/`www.mkety.com` DNS and Worker route state and preserves unrelated routes, especially `learn.starpipsforex.com/* -> mklms`.
16. No production DNS/route mutation is performed from an unverified commit.

## Required Public Mkety AI secrets

Required:

- `MKETY_PUBLIC_AI_VISITOR_SECRET` — random secret, minimum 32 characters.
- At least one fully configured dedicated public provider credential set.

Supported provider credential sets remain code-controlled. Visitors do not select providers or models.

## Required Enterprise payment configuration

Public production requires BOTH gateways.

NOWPayments:

```text
NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET
```

Selar:

```text
SELAR_ENTERPRISE_CHECKOUT_URL
```

`SELAR_ENTERPRISE_CHECKOUT_URL` must be HTTPS.

Candidate verification must remain non-charging:

- NOWPayments: exercise configured Worker webhook verification/fail-closed behavior and adapter tests; do not create a real provider invoice solely for CI.
- Selar: create/reuse a synthetic hosted checkout order, validate the redirect host, and prove payment remains pending/unconfirmed.
- Never grant subscriptions, entitlements, credits, wallet funds, tenant access or infrastructure from browser return/success.

## Public commercial acceptance

Canonical public entries:

```text
Starter               $5.99 / month
AI Workspace          $16.99 / month
Automation Workspace  $16.99 / month
Deploy Workspace      $9.99 / month
Mkety One             $49 / month
Enterprise            Custom
```

Removed/obsolete plan names must not appear as current public options:

```text
Growth
Pro
Business
```

Academy and Trading prices found in older main-site implementation are not authoritative and must not be copied into the public site/docs/AI.

## Pre-cutover snapshot

Before mutation, record:

- accessible Cloudflare zone;
- root `mkety.com` DNS/proxy state;
- `www.mkety.com` DNS/proxy state;
- existing Worker route patterns/scripts;
- current public response behavior;
- candidate Worker URL and exact candidate SHA;
- unrelated route evidence including `learn.starpipsforex.com/* -> mklms`.

Do not log Cloudflare tokens, database URLs, AI credentials, payment credentials, cookie signing secrets, or authorization headers.

## Production deployment sequence

1. Re-run the complete quality gate on the exact candidate SHA.
2. Re-run the isolated candidate deployment including public-content, Public AI and both-payment-gateway smoke checks.
3. Re-run read-only routing preflight and record rollback state.
4. Deploy the generated server Worker using the verified vinext server config, never an asset-only deployment.
5. Attach production `DATABASE_URL`, dedicated Public Mkety AI secrets, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, and `SELAR_ENTERPRISE_CHECKOUT_URL`.
6. Confirm Worker deployment succeeds before adding domain traffic.
7. Bind `mkety.com` to the verified production Worker using the least-invasive mechanism compatible with the current zone state.
8. Configure `www.mkety.com` to redirect canonically to `https://mkety.com`.
9. Preserve `app.mkety.com`, `api.mkety.com`, `origin.mkety.com`, `academy.mkety.com`, `trade.mkety.com`, `*.mkety.app`, `learn.starpipsforex.com/* -> mklms`, and unrelated DNS/Worker resources.
10. Verify SSL/public HTTP behavior and run the production acceptance matrix.

## Production acceptance matrix

Must pass:

- `/`
- `/platform`
- `/workspaces`
- `/solutions`
- `/academy`
- `/pricing`
- `/enterprise`
- `/about`
- `/docs`
- every linked public docs article
- `/privacy`
- `/terms`
- `/contact`
- `/sitemap.xml`
- `/robots.txt`

Also verify:

- canonical metadata origin is `https://mkety.com`;
- `www.mkety.com` redirects to canonical `mkety.com`;
- navigation and CTAs resolve correctly;
- Pricing renders the exact six approved entries and no Growth/Pro/Business;
- Academy overview includes Web & App Engineering, Trading Masterclass, Digital Funnel & Marketing, AI & Automation Lab, and Certified Digital Skills;
- Academy CTA/handoffs use `https://academy.mkety.com`;
- Trading remains Custom / Enterprise and uses `https://trade.mkety.com` where appropriate;
- no stale Academy/Trading pricing is shown;
- public docs read as finished customer documentation, not development notes;
- no GitHub/repository/private engineering wording is public;
- Public Mkety AI returns a real grounded response;
- Public AI knows the canonical six commercial entries and Academy/Trading destinations;
- Public AI does not reveal private source/repository information;
- same-browser memory survives another request;
- New Chat creates a distinct conversation;
- no tenant/private AI data is required;
- no model/provider selector is exposed;
- both Enterprise gateways are configured and candidate-verified;
- Enterprise orders remain pending until verified payment confirmation;
- no stale template branding is public;
- no public CTA routes to an internal origin hostname;
- no invented SLA/certification/contact promise appears.

## Rollback

Rollback is triggered by systemic 5xx/404 errors, broken canonical routing, database/runtime failure, public AI privacy/grounding failure, payment-safety failure, or another launch-critical acceptance failure.

1. Stop further production mutations.
2. Restore exact pre-cutover root and `www` DNS/Worker route configuration.
3. Confirm the previous public surface responds again.
4. Remove/disable only the new production binding introduced by this cutover; do not delete unrelated Workers/DNS records.
5. Leave the isolated candidate Worker intact for diagnosis unless security requires disabling it.
6. Record failed production Worker version/SHA and acceptance failure.
7. Fix and repeat exact-SHA candidate verification before another production attempt.

## Post-cutover handoff

After production is verified:

1. Update `docs/MKETY_DEVELOPMENT_CONTINUATION.md` with production SHA, Worker/version evidence, DB evidence, Public AI status and both payment-gateway status.
2. Keep `docs/MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md` current when product/pricing/domain policy changes.
3. Resume the paused Platform stack only in the established order:
   Auth #16 → Webhooks #15 → Billing #21 → Entitlements #22 → Usage/Credits #23 → Wallet → remaining Platform work.
