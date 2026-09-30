# Customer journey and first Enterprise AI customer — 2026-09-30

This records the owner's live observations after production infrastructure promotion. It supplements `2026-09-30-production-promotion-progress.md`; do not treat automated checks as a substitute for the live role and customer matrix.

## Reported live defects and requested presentation

1. Homepage lead with useful AI integrated into the broader digital business solution, in natural human language. Show Mkety Media at `media.mkety.com` and Mkety Trading at `trade.mkety.com` as standalone products with appropriate Enterprise paths.
2. Remove public ↔ app ↔ Enterprise ↔ AI loops. A self-service buyer should reach signup/workspace selection/checkout; a separately entitled Enterprise AI customer should reach the console; an unentitled visitor should reach direct human sales. Telegram is the quickest human channel, with email as a choice. Public AI should capture voluntarily supplied contact information for follow-up, with no secret collection.
3. Fix `ai.mkety.com` download/error reports, Mail “See plans” → “Add to workspace” loop, slow/blank member and admin dashboards, partially loaded Platform Console, and other workspace/Enterprise pages. Verify signed-in member, tenant admin and Platform Control operator separately.
4. Run real first-customer Enterprise AI setup and acceptance, then intentionally enable production inference only after the commercial, domain/white-label, provider, isolation and channel/handoff gates in the runbook. Do not promise a customer activation from a successful infrastructure deploy.
5. Measure page loads in production. Use short-lived public caching only for safe published content if measurement supports it; do not cache sessions, tenant entitlements, private dashboards or commercial decisions in shared KV. Durable Objects are for coordinated state rather than ordinary page-read acceleration.

## Changes in the current code branch

- Reworded homepage and SEO toward practical AI-led digital work; added a standalone Trading section alongside existing Media and Mail presentation.
- Sent Mail workspace selection to the canonical app host. Sent unentitled Enterprise AI and new Trading sales to a direct contact choice instead of bouncing through Enterprise pages. Contact/Enterprise now offer Telegram, sales email and Mkety AI directly.
- Explicitly described optional contact details in public AI. Existing lead metadata is visible in Platform Control; a dedicated form and automated sales notification are not implemented by this change.
- Tenant layout, member dashboard, admin layout/dashboard, Enterprise AI console, and Mail/AI product choosers now use a request-scoped database lifecycle. The shared database gateway reads the active request client and falls back to its existing singleton for scripts and callers not yet wrapped.

## Verification and unresolved production acceptance

Local typecheck, focused tests and Vinext build passed. The full test run initially found two old presentation expectations; after updating them, targeted tests passed. Exact-head CI, candidate, deployment and live signed-in page timing remain required. The anonymous `ai.mkety.com` browser path reached production identity login, but no authenticated Enterprise AI tenant route was exercised from this browser. The reported authenticated error and previous text-download response remain unverified root causes; investigate production request logs and a controlled signed-in session before declaring them fixed.

Record each production page's response status, time-to-content, destination, role and tenant. Keep external Mail clients and Enterprise customer inference OFF until their separate customer-path gates pass. First-customer commercial terms, tenant identity, hostname and channel credentials must be confirmed from authoritative account records before mutation or sending an onboarding message.
