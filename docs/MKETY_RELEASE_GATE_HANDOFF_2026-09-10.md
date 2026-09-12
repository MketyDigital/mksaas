# Mkety Public Release Gate Handoff — 2026-09-10

## Scope

This is the dated operational addendum for public-site PR #24 (`feat/mkety-public-site-production`). It supplements `MKETY_DEVELOPMENT_CONTINUATION.md`; `AGENTS.md` remains the highest-priority architecture source.

## Current objective

Finish the independently releasable `mkety.com` public experience before resuming the stacked `app.mkety.com` Platform promotion path.

The Platform dependency order remains:

```text
Auth #16
  ↓
Automation Webhooks #15
  ↓
Billing #21
  ↓
Entitlements #22
  ↓
Usage/Credits #23
```

Do not flatten or merge that stack out of order.

## September 10 release-gate repairs

The PR #24 release gate was audited from fresh GitHub Actions evidence and repaired at root cause:

- Candidate route diagnostic YAML was made valid for `actionlint`.
- Candidate public-copy quarantine now scans non-script/non-style HTML rather than hidden Next.js hydration payloads, preventing false positives while retaining visible-copy enforcement.
- Checkov remains enabled; only `CKV_GHA_7` is excluded because the production cutover deliberately requires typed `workflow_dispatch` safety inputs.
- cspell was taught legitimate Mkety/tool vocabulary and British-English `practise` instead of weakening spelling checks globally.
- Lychee exclusions are limited to runtime/API command URLs that are not authored documentation hyperlinks.
- Content DB smoke now preserves its exact stdout/stderr as an artifact on every run while still failing the job through `pipefail`.
- `public.rls_auto_enable()` was identified as a `SECURITY DEFINER` event-trigger helper that inherited client EXECUTE grants. Migration `0008_harden_rls_auto_enable.sql` revokes execution from `PUBLIC`, `anon`, and `authenticated` while preserving event-trigger behavior.
- The same RLS hardening migration was applied to the connected Mkety Supabase development project and the security advisor was rerun; the exposed SECURITY DEFINER warning cleared.

## Supabase security notes

After the hardening above, remaining advisor output is intentionally not auto-fixed without domain review:

- RLS-enabled tables with no policies are informational and may represent deliberate deny-all Data API exposure for server-owned tables. Do not add broad client policies merely to silence the advisor.
- `vector` is currently installed in `public`; moving an extension can affect existing object references and requires a separate migration/compatibility review.
- Supabase Auth leaked-password protection is disabled. Mkety application auth is provider-neutral with ZITADEL as the first adapter; do not treat Supabase Auth settings as a substitute for the Mkety Auth promotion gate.

## Public-site acceptance rule

Before merging PR #24, obtain fresh success evidence for the exact final head across the repository's blocking quality/runtime workflows, including:

- tests;
- type-check;
- lint;
- build;
- CI/PR validation;
- MegaLinter;
- Cloudflare vinext smoke;
- Mkety content DB smoke;
- Public AI runtime diagnostic;
- production routing preflight;
- isolated public candidate deployment and route/runtime/payment/AI smoke.

Do not reuse evidence from a previous SHA after documentation, migration, or CI changes create a new head.

## Production cutover boundary

The repository cutover workflow deliberately requires both:

- the exact fully verified 40-character release-branch SHA; and
- the literal confirmation phrase `CUTOVER MKETY PUBLIC`.

A general implementation approval is not a substitute for that production-routing authorization. Do not mutate live `mkety.com` Worker routes unless the explicit cutover authorization is supplied and the workflow itself confirms all exact-SHA gates are green.

## Platform continuation boundary

After public-site acceptance, resume with Auth #16. Its internal code verification is not the final promotion gate. The remaining external evidence is:

1. deploy the real isolated `mkety-platform-preview` Worker;
2. record its exact workers.dev URL;
3. register `<preview-url>/api/auth/callback` and `<preview-url>/login` in ZITADEL as callback/post-logout URIs;
4. run browser smoke through login → callback → Mkety-owned session → protected route/current tenant authorization → logout;
5. re-confirm migration order before promoting Automation Webhooks #15.

Webhooks, Billing, Entitlements, and Usage/Credits must remain behind that gate and be reverified on their promoted ancestry rather than merged from stale green evidence.
