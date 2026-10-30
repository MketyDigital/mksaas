# Current Repository Workstream Status

**Updated:** 2026-10-26
**Working branch:** `work/current-truth-mkety-app-nowpayments`
**Status:** local implementation and acceptance checks in progress; the Public AI repair was deployed separately, and this branch has made no additional production or DNS changes.

## Current truth

- The public `mkety.com` production cutover was completed previously. Routine edits and documentation repairs do not require another public cutover. Do not repeat or advertise `CUTOVER MKETY PUBLIC` unless an actual route/domain migration is proposed and explicitly required.
- `app.mkety.com` is the authenticated Mkety Platform. `mkety.app` is the customer app/preview domain. Its apex should provide a branded Mkety Apps entry/service endpoint, comparable in role to a Pages or Vercel base domain; customer apps use isolated, verified `*.mkety.app` hosts. Keep the platform app and customer code runtimes separate.
- Mkety central AI provider/model definitions, encrypted system provider connections, and the Workers AI binding are shared. Public AI and Workspace AI keep independent route and enablement policies and must work when Enterprise AI is off. Assist remains a separate production application/control/data/ledger boundary. Platform now has a versioned provider/model catalog; Assist is read-only in this workstream.
- Enterprise payment behavior and Assist payment behavior need product parity where specified, but Assist's production runtime and ledger stay isolated. The NowPayments integration playbook is the acceptance authority for the requested provider parity work.

## Active implementation branch

1. Repair Public AI provider lookup and routing against the central provider setup. The work includes request-scoped DB use, promoting legacy Public-only system provider connections into shared `platform` mode, accepting Azure `gpt-6-luna-1`, preserving Foundry project endpoint paths, making inactive stale model values repairable, and returning visible correlated admin-action references.
2. Implement and validate the customer-facing `mkety.app` apex/wildcard hosting path, including isolated customer deployment dispatch, hostname ownership, preview/promotion lifecycle, and runbook evidence.
3. Finish the requested NowPayments product parity and Mail acceptance while preserving standalone product boundaries.
4. Reconcile stale repository guidance and current-state docs so the completed public cutover, app/site work, standalone products, and active work are stated accurately.

See the approved design at `docs/superpowers/specs/2026-10-21-mkety-current-truth-and-app-domain-design.md` and task plans in `docs/superpowers/plans/`.

## Migration order on this branch

| Index | Migration | Scope |
|---:|---|---|
| 0044 | `public_ai_provider_connections` | Consolidate Public system credentials into shared platform connections |
| 0045 | `deployment_hostnames` | Persist tenant-owned `mkety.app` deployment hostnames |
| 0046 | `deployment_request_artifact_key` | Attach bounded, hashed customer bundles to approved Deploy requests |
| 0047 | `enterprise_nowpayments_checkout_token` | Opaque Enterprise customer payment-link capability and selected ticker |
| 0048 | `nowpayments_network_evidence` | Persist selected/observed network ticker on Billing checkouts and settlements |
| 0049 | `deployment_production_alias_promotion` | Link an approved promotion request to an immutable completed customer deployment |

Keep SQL files, Drizzle journal entries, and snapshots aligned. Do not apply production migrations from this implementation branch.

## Verified in this checkout so far

- Public AI request database wrapper now delegates to the shared request-scoped database context.
- Public AI provider save/list/resolve/disable now use central `platform` connections; migration 0044 promotes legacy Public system rows without modifying BYOK rows.
- Azure `gpt-6-luna-1`, route-scoped model validation, Foundry project endpoint preservation, and safe admin action references have focused regression coverage.
- A versioned pure provider/model catalog now supplies Platform Public AI choices. Assist source and product docs were left unchanged; Assist remains read-only in this workstream.
- Public AI model tests pass (8 tests) after extracting the catalog, and the root TypeScript check passes.
- Focused Jest suites pass (13 tests across model, dynamic-config, request context, action reference, and migration tests).
- `corepack pnpm type-check` passes.
- `node --import tsx scripts/check-migration-baseline.ts` passes.
- Public AI and central AI runtime suites pass together: 58 suites / 229 tests. The focused Deploy suite passes 10 suites / 53 tests. Focused Billing/currency tests pass 4 suites / 21 tests. Migration 0044 and hostname migration 0045 each pass a PGlite integration test.
- Earlier root build evidence was on a pre-promotion checkout; the current checkout's fresh Next build is blocked by the missing SWC native binding described below.
- Wrangler router `--dry-run` parsed the Workers for Platforms dispatch namespace config. The namespace was not queried from a live Cloudflare account.
- `mkety.app` now has bounded customer artifact intake, tenant/project/request-scoped storage, SHA-256 verification, an isolated Workers for Platforms dispatch adapter, and active preview links in Deploy history. Live TLS/DNS/namespace acceptance and rollback proof remain external release gates.
- The isolated `mkety.app` router/provider verification passes six suites / 27 tests, and Wrangler's dry-run accepts the configured dispatch namespace. These are local package checks only; no live Worker, route, or DNS change was made.
- Deploy now has a Platform Control approved production alias flow: managers request a completed preview promotion, approval moves the stable app hostname in one database transaction, and an audit event records the previous/next deployment. The preview and prior completed deployments remain available for rollback through the same approval path. Migration 0049 is additive; 25 focused tests, the migration baseline, and TypeScript checking pass. No production Worker, route, hostname mapping, DNS, or database was changed in this workstream.
- NOWPayments customer Billing history now shows the stored payment ID and network; provider account references and raw payment references remain excluded. The focused adapter/settlement/history and Enterprise checkout checks pass (7 suites / 39 tests), including currency/network mismatch, non-final statuses, and replay/one-time settlement behavior.
- Assist remains production-isolated and untouched in this workstream. The user confirms its currency verification fix is already complete; no Assist change is pending here. Its last local `check:all` passed 205 tests/contracts. Its type-check was blocked in this checkout because `@cloudflare/workers-types` was absent.
- Enterprise and central AI focused verification passes 60 suites / 232 tests, covering Public AI routing/admin, shared provider resolution, Azure Foundry paths, Workers AI, Enterprise commercial controls, payment handoff, budget/credit accounting, retries, and tenant/domain isolation. Root TypeScript checking passes. Enterprise customer inference remains OFF; no customer inference promotion was made.
- Public AI was separately deployed in successful Actions run `39988937106`; the post-deploy public chat check returned `ready` on Worker version `7f5a38df-6b02-4bd3-8168-34a78cecfaa3`. This is production evidence for that Public AI repair only; it does not verify Enterprise customer inference or Workspace AI runtime configuration.
- Mail local regression checks pass: 37 suites / 189 tests. The read-only Cloudflare diagnostic run `39485339650` passed token/binding/zone and safe log-tail checks. Actual live SMTP/ZITADEL and Mail-gateway IMAP/SMTP acceptance remains open; this runtime has no GitHub Actions workflow-dispatch capability to start the guarded acceptance workflows.
- The user dispatched ZITADEL/Mail reconcile run `40137608433` on 2026-10-24 with Mkety SMTP selected. ZITADEL auth/registration checks passed; the run stopped at SMTP configuration validation because `MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD` is absent/empty. SMTP test and provider activation were skipped. The workflow's secret inventory lists no matching Mkety SMTP secret; no Brevo fallback is allowed for Mkety and no production provider settings were changed. Next: issue the SMTP-only `info@mkety.com` credential through the authenticated Mail Ops control, add it as the repository Actions secret `MKETY_FIRST_PARTY_MAIL_SMTP_PASSWORD`, then rerun with `email_provider=mkety`, `test_provider=true`, `activate_provider=false`. This session has no Actions secret-management or Mail Ops write capability.
- On 2026-10-26, traced the first-party SMTP credential form's indefinite `Saving…` state to its server action bypassing `withServerActionDatabase`, unlike the Cloudflare-safe database boundary required for top-level Server Actions. PR [#457](https://github.com/MketyDigital/mksaas/pull/457) adds that request-scoped wrapper and a regression test. Local Mail tests pass (37 suites / 189 tests), type-check passes, and PR build/lint/Cloudflare smoke/main CI test jobs and MegaLinter passed. The PR CI dependency security audit fails on 16 lockfile advisories; latest `main` CI run `39988937101` fails that same audit, so it is a pre-existing repository gate. Not merged/deployed; verify the form after guarded release. No production settings were changed.
- Current root TypeScript checking passes. A fresh Next build is blocked before compilation because this checkout cannot load the `@swc/core` Linux native binding. No provider transaction, live migration, customer hostname, DNS, or production runtime action was performed.
- NOWPayments has a shared playbook, live currency-list endpoint, Billing/Enterprise AI selectors, and a negotiated Enterprise paypoint with hashed expiring links and one-time invoice start. Migrations 0047/0048 persist the capability and selected/observed network ticker. No provider transaction or production migration was run.
- A [read-only Cloudflare diagnostic run on 2026-10-20](https://github.com/MketyDigital/mksaas/actions/runs/39485339650) confirmed the repository token is active, both Mail Cloudflare bindings exist on `mkety-app-host`, and zone/DNS/Email Sending reads succeed. It did not perform SMTP/IMAP authentication or message delivery. Root MX was not changed.
- Earlier local gates on the pre-promotion checkout passed `corepack pnpm type-check`, `corepack pnpm build`, and the migration baseline. The full Jest run reported 329 passing suites / 1,521 passing tests and one skipped suite; two stale-contract failures were corrected and both affected suites then passed (10 tests). After the current UI/schema edits, TypeScript and the migration baseline pass; a fresh Next build is blocked by the missing SWC native binding described above.
- After reverting all local Assist-only edits, Assist `npm run check:all` passes against unchanged source: 205 tests plus operator UI, security-isolation, and production-acceptance checks. Assist TypeScript checking is still blocked locally because the declared `@cloudflare/workers-types` package is not installed in this checkout.
- Cloudflare AI Gateway/binding configuration, Workspace live provider resolution, Enterprise customer inference, `mkety.app` DNS/dispatch, payment-provider transactions, CI on the exact final commit, and Mail live send/receive acceptance remain separate verification gates.

## Operator/developer rules

- Preserve the `*.mkety.app` customer dispatch boundary and fail closed on missing/unknown/suspended host mappings.
- Never split the central provider key/model catalog or install another Workers AI binding for Public or Workspace. Keep Enterprise enablement scoped to Enterprise.
- Do not expose credentials, SQL text, raw errors, customer data, or internal deployment identifiers in admin query strings or public errors.
- Do not declare a production rollout complete from local tests, docs, or an unmerged branch. Record exact SHA, migration state, external configuration, and live acceptance separately.
