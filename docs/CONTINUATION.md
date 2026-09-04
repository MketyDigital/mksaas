# Mkety SaaS Continuation Log

Last updated: 2026-09-04
Branch: `docs/mkety-continuation-audit`
Base commit: `cf6ee08907efbbfd91c85ade0ca22b89ab0f219a`

## Purpose

Preserve the active Mkety SaaS development plan, record progress, and make the next continuation point obvious for any future agentic worker. This file must be updated at the end of every meaningful development session.

## Source-of-truth order

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/MKETY_PLATFORM_BLUEPRINT.md`
4. Relevant phase-specific docs, specs, plans, tests, and open pull requests
5. External referenced source-of-truth repos, especially `MketyDigital/mklms` for managed-hosting billing

## Confirmed repo instructions

- The repo is the Mkety foundation/control plane, initially deployable on Vercel and later portable to OCI/Coolify without redesign.
- Keep day-one infrastructure small. Do not install Flowise, Activepieces, LiteLLM, Qdrant, model runtimes, MT5/Telegram workloads, or arbitrary customer apps on the day-one OCI VM.
- Prefer standard PostgreSQL, Redis, Docker, OIDC/OAuth, REST APIs, and provider-neutral AI interfaces. Avoid permanent Supabase-only or Vercel-only backend lock-in.
- Every phase should build and test on the current Vercel deployment before any production stack migration to OCI.
- For managed-hosting billing, reuse the external billing Worker/provider contract from `MketyDigital/mklms`; do not duplicate or rebuild NOWPayments routes inside MKSaaS.

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

Add authoritative product/plan records, wallet/ledger, usage events, subscriptions, Selar, and NOWPayments webhooks. MKSaaS must consume/reuse the MkLMS external managed-hosting billing Worker contract instead of copying legacy NOWPayments code.

### Phase 8 — Production hardening

ZITADEL production identity integration, rate limits, secrets management, observability, backups, disaster recovery, and security review.

## Current audit snapshot

- `AGENTS.md` identifies the project as a Next.js SaaS AI template using Next.js 16, TypeScript, PostgreSQL/Drizzle, Auth.js v5, Tailwind CSS v4, and pnpm 10+.
- `docs/README.md` says the docs directory is the single source of truth and indexes architecture, design, database, auth, permissions, API, integrations, deployment, GitHub setup, testing, and glossary documents.
- `docs/MKETY_PLATFORM_BLUEPRINT.md` defines MKSaaS as the Mkety portable SaaS control plane and lists Phases 0 through 8.
- `package.json` exposes the primary verification commands: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm test:coverage`, `pnpm build`, `pnpm db:migrate`, and Storybook scripts.
- `.github/workflows/` currently contains build, lint, mega-linter, PR review, tests, TODO, and type-check workflows.
- Open PR #1: `Add workspace-aware /team entry and remove login redirects from tenant selection`.
- Open PR #3: `docs: reuse external managed-hosting billing contract`.
- Current Actions runs query returned no workflow runs, so there is no recorded CI validation evidence yet.

## External managed-hosting billing dependency

Before any MKSaaS billing work:

1. Read `MketyDigital/mklms/docs/deployment/external-managed-hosting-billing.md`.
2. Read `MketyDigital/mklms/docs/superpowers/plans/2026-08-31-external-managed-hosting-billing-implementation.md`.
3. Preserve these constraints:
   - central Cloudflare Worker creates NOWPayments invoices and verifies IPNs;
   - provider secrets intentionally use `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`;
   - customer installation callbacks use per-installation HMAC shared secrets;
   - Worker must not store customer database credentials;
   - IPN verification fails closed;
   - only `payment_status=finished` can trigger automatic `PAID` settlement;
   - manual `PENDING`, `PAID`, and `WAIVED` controls remain available;
   - future MKSaaS tenant storage may replace the Worker customer JSON registry without breaking deployed MkLMS settlement endpoints.

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

## Next continuation point

1. Review and decide merge order for open PRs:
   - PR #1: team/workspace routing.
   - PR #3: external billing contract note.
2. Inspect the latest branch diffs for:
   - `mkety-phase-1-ai-core-foundation`
   - `feature/workspace-custom-domain`
   - `workspace-team-routing`
   - `chore/update-nextjs-to-v16`
   - `chore/consolidate-postgres-driver`
   - `chore/add-engines-field`
3. Run or trigger validation for the safe base: `pnpm install`, `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build`.
4. Create a Phase 0 hardening checklist from the docs and existing code: tenant isolation, auth boundaries, route protection, migration safety, environment validation, CI/staging deploy.
5. Continue development from Phase 0 unless a reviewed open branch already satisfies a Phase 0 task. Do not start Phase 1+ implementation until Phase 0 verification is recorded here.

## Continuation rule

At the end of every future session, update this file with:

- completed work;
- verification commands and outcomes;
- changed files/PRs/commits;
- blockers or missing secrets/infrastructure;
- the exact next continuation point.
