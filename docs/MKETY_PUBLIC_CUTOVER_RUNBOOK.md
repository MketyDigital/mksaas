# Mkety Public Website Production Cutover Runbook

> `AGENTS.md` remains the architectural authority. This runbook governs the operational promotion of the verified `mksaas` public website to `mkety.com`.

## Purpose

Promote the exact verified Mkety public candidate to production without mixing public-site work with `app.mkety.com`, tenant AI, legacy repositories, or unrelated Cloudflare resources.

## Hard gates before production mutation

Production cutover is blocked until all of the following are true:

1. The public-site feature branch has a recorded candidate SHA.
2. Tests, typecheck, blocking lint, build, vinext compatibility and connected Mkety DB smoke are green for that SHA.
3. The isolated `mkety-public-candidate` Worker is deployed successfully.
4. Every canonical public route returns HTTP 200 from the candidate.
5. Candidate HTML does not expose quarantined starter/template wording.
6. Public Mkety AI is visible on the public shell and uses a dedicated public runtime boundary.
7. At least one dedicated `MKETY_PUBLIC_*` AI provider is configured and returns a real answer on the candidate.
8. Public AI same-browser memory, restored history and New Chat isolation pass the candidate smoke.
9. The read-only Cloudflare production preflight has recorded current `mkety.com`/`www.mkety.com` DNS and Worker route state.
10. No production DNS/route mutation is performed from an unverified commit.

## Required public AI production secrets

The public assistant does not inherit tenant/Platform AI credentials.

Required:

- `MKETY_PUBLIC_AI_VISITOR_SECRET` — random secret, minimum 32 characters.
- At least one fully configured public provider credential set.

Supported provider credential sets:

- OpenAI: `MKETY_PUBLIC_OPENAI_API_KEY`
- Azure OpenAI: `MKETY_PUBLIC_AZURE_OPENAI_API_KEY`, `MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT`, `MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT`
- Gemini: `MKETY_PUBLIC_GEMINI_API_KEY`
- Vertex AI: `MKETY_PUBLIC_VERTEX_PROJECT_ID`, `MKETY_PUBLIC_VERTEX_LOCATION`, `MKETY_PUBLIC_VERTEX_ACCESS_TOKEN`
- Cloudflare Workers AI: `MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN` plus the Mkety Cloudflare account id
- AWS Bedrock: `MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID`, `MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY`, optional session token and configured region

The model registry controls approved September 2026 current model IDs. Visitors do not select providers or models.

## Pre-cutover snapshot

Before mutation, record from the read-only preflight:

- accessible Cloudflare zone;
- root `mkety.com` DNS record types/proxy state;
- `www.mkety.com` DNS record types/proxy state;
- existing Worker route patterns and scripts;
- currently live public response behavior for root and `www`;
- candidate Worker URL and candidate SHA.

Do not log Cloudflare tokens, database URLs, AI credentials, cookie signing secrets, or authorization headers.

## Production deployment sequence

1. Re-run the complete quality gate on the exact candidate SHA.
2. Re-run the isolated candidate deployment and public AI smoke on that exact SHA.
3. Deploy the generated server Worker using the verified vinext server config, never the `dist/client` asset-only config.
4. Attach `DATABASE_URL` and the dedicated Public Mkety AI runtime secrets to the production Worker.
5. Confirm production Worker deployment succeeds before adding domain traffic.
6. Bind `mkety.com` to the verified production Worker using the existing Cloudflare zone and the least invasive route/custom-domain mechanism compatible with the current zone state.
7. Configure `www.mkety.com` to redirect canonically to `https://mkety.com` rather than serving an independent Mkety application.
8. Preserve `app.mkety.com`, `api.mkety.com`, `origin.mkety.com`, `*.mkety.app`, and unrelated Cloudflare resources.
9. Verify SSL and public HTTP behavior externally.
10. Run the production acceptance matrix below.

## Production acceptance matrix

Must pass after cutover:

- `/`
- `/platform`
- `/workspaces`
- `/solutions`
- `/academy`
- `/pricing`
- `/enterprise`
- `/about`
- `/docs`
- `/privacy`
- `/terms`
- `/contact`
- `/sitemap.xml`
- `/robots.txt`

Also verify:

- canonical metadata origin is `https://mkety.com`;
- `www.mkety.com` redirects to canonical `mkety.com`;
- navigation and CTAs resolve correctly;
- dedicated Pricing page renders published plan cards;
- Trading remains presented as Custom / Enterprise where applicable;
- public Mkety AI launcher is visible;
- public AI returns a real grounded response;
- same-browser memory survives another request;
- New Chat creates a distinct conversation;
- no tenant/private AI data is required;
- no model/provider selector is exposed;
- no stale Next/Vercel/template branding is public;
- no public CTA routes to `origin.mkety.com`;
- no customer application is presented under the wrong Mkety domain;
- no invented SLA/certification/contact promise appears.

## Rollback

Rollback is triggered if production routing produces systemic 5xx/404 errors, broken canonical routing, database/runtime failure, public AI creates an unsafe/private-data boundary issue, or another launch-critical acceptance check fails.

Rollback procedure:

1. Stop further production mutations.
2. Restore the exact pre-cutover root and `www` DNS/Worker route configuration recorded by the preflight.
3. Confirm the previous legacy public surface responds again.
4. Remove/disable only the new production Worker route/custom-domain binding that was introduced by this cutover; do not delete unrelated Workers or DNS records.
5. Leave the isolated candidate Worker intact for diagnosis unless security requires disabling it.
6. Record the failed production Worker version/SHA and the failing acceptance check.
7. Fix and repeat candidate verification before another production attempt.

## Post-cutover handoff

After production is verified:

1. Update `docs/MKETY_DEVELOPMENT_CONTINUATION.md` with production SHA, Worker/version evidence, DB evidence and Public AI configuration status.
2. Record the known vinext `next-auth` compatibility warning as an `app.mkety.com` concern; do not change auth architecture during public cutover.
3. Resume the paused Platform stack only in the established order:
   Auth #16 → Webhooks #15 → Billing #21 → Entitlements #22 → Usage/Credits #23 → Wallet → remaining Platform work.
