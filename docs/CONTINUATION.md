# Mkety SaaS Continuation Log

Last updated: 2026-09-04
Branch: `docs/mkety-continuation-audit`
Base commit: `cf6ee08907efbbfd91c85ade0ca22b89ab0f219a`

## Purpose

Preserve the active Mkety SaaS development plan, record progress, and make the next continuation point obvious for any future agentic worker. This file must be updated at the end of every meaningful development session.

## Source-of-truth order

1. `agents.md` — large Mkety product/control-plane continuation blueprint.
2. `AGENTS.md` — concise repo instructions for agents.
3. `docs/README.md`.
4. `docs/MKETY_PLATFORM_BLUEPRINT.md`.
5. Relevant phase-specific docs, specs, plans, tests, and open pull requests.
6. External referenced source-of-truth repos:
   - `MketyDigital/Mkety` for current live/legacy Mkety behavior and product/payment reference.
   - `MketyDigital/mklms` for production managed-hosting billing behavior and the first enterprise product implementation.

## Confirmed repo instructions

- The repo is the Mkety foundation/control plane, initially deployable on Vercel and later portable to OCI/Coolify without redesign.
- Keep day-one infrastructure small. Do not install Flowise, Activepieces, LiteLLM, Qdrant, model runtimes, MT5/Telegram workloads, or arbitrary customer apps on the day-one OCI VM.
- Prefer standard PostgreSQL, Redis, Docker, OIDC/OAuth, REST APIs, and provider-neutral AI interfaces. Avoid permanent Supabase-only or Vercel-only backend lock-in.
- Every phase should build and test on the current Vercel deployment before any production stack migration to OCI.
- Build the upgraded platform in `MketyDigital/mksaas`.
- Treat `MketyDigital/Mkety` as the current live/legacy Mkety product and reference source. Do not change or cut over the live product until the user explicitly authorizes it.
- Treat `MketyDigital/mklms` billing as current production infrastructure for the first enterprise client product. Reuse its billing contract carefully; do not casually edit or break it.

## Preserved implementation phases

### Phase 0 — Foundation hardening

Verify tenant isolation, auth boundaries, route protection, migrations, environment validation, testing, and deployment portability.

### Phase 1 — Mkety AI Core

Centralize provider/model selection, add usage accounting hooks, and make the assistant provider-neutral. Do not require fake credentials for disabled providers.

### Phase 2 — Workspace/product model

Introduce first-class projects/resources and connect all new features to the active tenant/workspace.

### Phase 3 — Agent Builder

Add persistent agent definitions, versions, tools, knowledge references, testing, and deployment state.

### Phase 4 — App Builder

Add AI application-generation projects, files, previews, and deployment lifecycle.

### Phase 5 — Automation

Add workflow definitions and execution infrastructure. Integrate Activepieces only when the feature requires it.

### Phase 6 — Cloud and domains

Complete Cloudflare/DNAPI/custom-domain/deployment provider integrations and Coolify control-plane operations.

### Phase 7 — Billing and credits

Add authoritative product/plan records, wallet/ledger, usage events, subscriptions, invoices, settlement records, Selar checkout support, NOWPayments crypto support, and provider-specific webhook/event handling behind stable Mkety Billing interfaces.

MKSaaS must not copy/rebuild legacy NOWPayments routes. The NOWPayments path should reuse the production MkLMS billing Worker/provider contract through compatibility-preserving adapters. Selar and NOWPayments should appear to the rest of MKSaaS as provider adapters under one uniform Mkety Billing domain.

### Phase 8 — Production hardening

ZITADEL production identity integration, rate limits, secrets management, observability, backups, disaster recovery, and security review.

## Current audit snapshot

- `AGENTS.md` identifies the project as a Next.js SaaS AI template using Next.js 16, TypeScript, PostgreSQL/Drizzle, Auth.js v5, Tailwind CSS v4, and pnpm 10+.
- `agents.md` is the larger Mkety continuation blueprint. It states that `MketyDigital/mksaas` is the authoritative development repo and `MketyDigital/Mkety` remains the current live/legacy product until intentional cutover.
- `docs/README.md` says the docs directory is the single source of truth and indexes architecture, design, database, auth, permissions, API, integrations, deployment, GitHub setup, testing, and glossary documents.
- `docs/MKETY_PLATFORM_BLUEPRINT.md` defines MKSaaS as the Mkety portable SaaS control plane and lists Phases 0 through 8.
- `package.json` exposes the primary verification commands: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm db:migrate`, and Storybook scripts.
- `.github/workflows/` currently contains build, lint, mega-linter, PR review, tests, TODO, and type-check workflows.
- Open PR #1: `Add workspace-aware /team entry and remove login redirects from tenant selection`.
- Open PR #3: `docs: reuse external managed-hosting billing contract`.
- Current Actions runs query returned no workflow runs, so there is no recorded CI validation evidence yet.

## Understanding of the new system

Mkety is not just an LMS or a web-agency site. The new system is a multi-tenant AI-powered business platform/control plane where customers work inside Mkety workspaces. The platform manages identity, tenants, teams, permissions, projects, agents, knowledge, workflows, deployments, domains, usage, billing, audits, and Solution Hub/product configuration.

The customer-facing product should remain one ecosystem called Mkety. Infrastructure such as Cloudflare, OCI, Coolify, Redis, PostgreSQL, Workers, R2, payment providers, and deployment systems should stay behind Mkety-branded abstractions except in technical/admin/enterprise contexts.

Standard/shared Mkety should stay serverless-first and lightweight. Heavy or special workloads such as trading infrastructure, customer-specific apps, MT4/MT5 systems, arbitrary containers, ERP-sized deployments, or strict-latency workloads are Enterprise/dedicated engagements, not default shared-platform load.

## Billing architecture correction — 2026-09-04

The phrase "reuse the MkLMS billing system" means the MkLMS billing implementation is the current Mkety production NOWPayments billing path for the first enterprise client product, not a disposable module to edit casually.

Correct billing direction:

1. `MketyDigital/Mkety` shows the legacy/live payment concept: enterprise order creation records `payment_provider` as `nowpayments` for crypto and `selar` for local checkout, using direct NOWPayments invoice creation and a Selar checkout URL.
2. `MketyDigital/mklms` contains the production-hardened managed-hosting billing Worker contract. It centralizes NOWPayments invoice/IPN handling, uses per-installation HMAC settlement, and preserves manual states.
3. `MketyDigital/mksaas` should build a uniform Mkety Billing domain around products, plans, subscriptions, invoices, wallet/credits, usage, ledger entries, provider events, and settlement state.
4. Selar and NOWPayments should become provider adapters behind one Mkety Billing interface, not two unrelated payment implementations spread across the app.
5. The NOWPayments adapter must consume or remain compatible with the MkLMS production billing Worker contract.
6. Existing MkLMS production customers must not be forced to change provider credential names, installation IDs, settlement endpoints, callback semantics, or shared-secret behavior.
7. Any future Worker changes must be backward compatible, staged, and validated against MkLMS production requirements before rollout.
8. Do not commit secrets. Use GitHub Actions/environment secret names only, with staging before production.

## External managed-hosting billing dependency

Before any MKSaaS billing work:

1. Read `MketyDigital/mksaas/agents.md`.
2. Read `MketyDigital/Mkety`, especially legacy payment/product references.
3. Read `MketyDigital/mklms/docs/deployment/external-managed-hosting-billing.md`.
4. Read `MketyDigital/mklms/docs/superpowers/plans/2026-08-31-external-managed-hosting-billing-implementation.md`.
5. Preserve these constraints:
   - central Cloudflare Worker creates NOWPayments invoices and verifies IPNs;
   - provider secrets intentionally use `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`;
   - customer installation callbacks use per-installation HMAC shared secrets;
   - Worker must not store customer database credentials;
   - IPN verification fails closed;
   - only `payment_status=finished` can trigger automatic `PAID` settlement;
   - manual `PENDING`, `PAID`, and `WAIVED` controls remain available;
   - future MKSaaS tenant storage may replace or feed the Worker customer JSON registry without breaking deployed MkLMS settlement endpoints.

## Secrets and staging policy

Do not ask for or commit secret values. Use GitHub Actions secrets/environments by name only.

Recommended environment separation:

- `staging`: default integration/testing target.
- `production`: protected environment; deploy only after full verification and review.

Likely secret names to confirm against actual implementation before use:

- `STAGING_DATABASE_URL`
- `STAGING_AUTH_SECRET`
- `STAGING_OPENAI_API_KEY`
- `STAGING_ANTHROPIC_API_KEY`
- `STAGING_AWS_ACCESS_KEY_ID`
- `STAGING_AWS_SECRET_ACCESS_KEY`
- `STAGING_AWS_REGION`
- `STAGING_AWS_S3_BUCKET`
- `STAGING_BILLING_WORKER_URL`
- `STAGING_MKETY_BILLING_CUSTOMERS_JSON`
- `STAGING_SELAR_WEBHOOK_SECRET`
- `STAGING_SELAR_CHECKOUT_BASE_URL`
- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`
- deployment-provider token names, chosen after deployment target is confirmed, e.g. `VERCEL_TOKEN`, `RAILWAY_TOKEN`, `FLY_API_TOKEN`, or Coolify/OCI equivalents.

## Progress log

### 2026-09-04

- Confirmed repository: `MketyDigital/mksaas`.
- Confirmed `AGENTS.md` and docs source-of-truth structure.
- Confirmed Mkety platform blueprint and preserved all implementation phases.
- Confirmed open working branches and PRs.
- Confirmed referenced MkLMS managed-hosting billing documentation and implementation plan.
- Added this continuation log as the first repo-owned progress/next-step tracker.
- Confirmed lowercase `agents.md` exists and is the larger product/control-plane continuation blueprint.
- Confirmed legacy repo `MketyDigital/Mkety` exists and remains live/reference-only.
- Confirmed legacy enterprise payment route uses `nowpayments` for crypto and `selar` for local checkout.
- Corrected billing interpretation: MkLMS billing is current production billing infrastructure for the first enterprise product and must be reused/kept compatible, not casually edited.
- Updated `AGENTS.md` and this continuation log on `docs/mkety-continuation-audit`.

## Next continuation point

1. Open or update the PR for `docs/mkety-continuation-audit` so the corrected architecture record can be reviewed.
2. Review and decide merge order for open PRs:
   - PR #1: team/workspace routing.
   - PR #3: external billing contract note. This should be reconciled with the corrected billing wording before merge.
3. Inspect the latest branch diffs for:
   - `mkety-phase-1-ai-core-foundation`
   - `feature/workspace-custom-domain`
   - `workspace-team-routing`
   - `chore/update-nextjs-to-v16`
   - `chore/consolidate-postgres-driver`
   - `chore/add-engines-field`
4. Run or trigger validation for the safe base: `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build`.
5. Create a Phase 0 hardening checklist from the docs and existing code: tenant isolation, auth boundaries, route protection, migration safety, environment validation, CI/staging deploy.
6. For Phase 7 planning, design Mkety Billing as a uniform provider-adapter domain for Selar and NOWPayments, with NOWPayments compatible with the MkLMS production Worker contract.
7. Continue development from Phase 0 unless a reviewed open branch already satisfies a Phase 0 task. Do not start Phase 1+ implementation until Phase 0 verification is recorded here.

## Continuation rule

At the end of every future session, update this file with:

- completed work;
- verification commands and outcomes;
- changed files/PRs/commits;
- blockers or missing secrets/infrastructure;
- the exact next continuation point.
