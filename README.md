# Mkety Platform

`mksaas` is the authoritative development repository for the modern Mkety Platform and Mkety public website.

Mkety is organized around two primary products: **Platform** and **Academy**. This repository owns the Platform application, public website, shared platform services, and the architecture needed to support AI, Automation, Deploy, Workspaces, SolutionHub, Billing, administration, and enterprise/custom surfaces such as Trading.

## Runtime

The authoritative runtime is:

- Next.js 16 App Router
- vinext
- Cloudflare Workers
- TypeScript 5+
- Tailwind CSS v4
- PostgreSQL + pgvector + Drizzle ORM
- Mkety-owned Auth with a replaceable ZITADEL OIDC adapter

Production deployment is not authorized merely because a branch builds. Promotion must follow the verified Cloudflare preview and product-specific release gates documented in the repository.

## Authentication Boundary

Mkety owns application identity, sessions, tenant membership, roles, permissions, and server-side authorization. ZITADEL is the current replaceable OIDC adapter; provider claims and provider tokens are not the application authorization source of truth.

Do not reintroduce Auth.js/NextAuth, Auth0-owned application sessions, or provider-specific authorization logic into product code.

## Platform Areas

Current architecture includes:

- **AI** — agents, models/providers, knowledge, versions, runs, and publishing boundaries
- **Automation** — workflows, triggers, actions, webhooks, execution records, failures, and retries
- **Deploy** — applications/sites, environments, deployments, domains, previews, and production boundaries
- **Workspaces** — tenant/project-scoped product surfaces and shared navigation
- **SolutionHub** — reusable solutions, templates, blueprints, requests, and Academy-linked offerings
- **Billing / Plans / Pricing** — Platform-owned plans, entitlements, usage/credits, and ledger-visible state
- **Platform Administration** — public content, app experience, tenant/platform controls, and audit boundaries
- **Trading** — visible as enterprise/custom only and architecturally standalone from the self-service Platform core

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL for database-backed development

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Configure local environment:

```bash
cp .envrc.example .envrc
direnv allow
```

See `.env.example` and `docs/PROJECT_CONFIGURATION.md` for the active Mkety environment contract.

Start development:

```bash
pnpm dev
```

The default local application URL is `http://localhost:3000` unless overridden.

## Core Verification

Before promoting a meaningful change, run the relevant gates:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpx vinext check
pnpm build
pnpm run deploy --dry-run
```

Database changes must also pass:

```bash
pnpm db:check:migrations
pnpm exec drizzle-kit check
```

## Database Migration Namespaces

Mkety currently has two explicit migration paths:

```bash
pnpm db:migrate
pnpm db:migrate:mkety-content
```

`pnpm db:migrate` applies the Drizzle application migrations under `src/shared/db/migrations`.

`pnpm db:migrate:mkety-content` applies the independent Mkety public-content/app-experience SQL under root `migrations/`.

Do not assume one command covers both namespaces. See `docs/MKETY_MIGRATION_BASELINE.md` and `docs/MKETY_PUBLIC_CMS_ROLLOUT_CHECKLIST.md` before shared or production database rollout.

## Useful Commands

| Command | Purpose |
| ------- | ------- |
| `pnpm dev` | Start the authoritative vinext development runtime |
| `pnpm build` | Build the vinext production artifact |
| `pnpm start` | Start the built vinext application |
| `pnpm deploy` | Deploy through the vinext Cloudflare adapter |
| `pnpm test` | Run Jest tests |
| `pnpm type-check` | Run strict TypeScript checking |
| `pnpm lint` | Run ESLint |
| `pnpm db:check:migrations` | Verify application migration sequence/metadata integrity |
| `pnpm db:generate` | Generate the next Drizzle migration from the verified metadata baseline |
| `pnpm db:migrate` | Apply application migrations |
| `pnpm db:migrate:mkety-content` | Apply Mkety content/app-experience SQL migrations |
| `pnpm db:seed:mkety-content` | Seed Mkety content defaults |
| `pnpm db:smoke:mkety-content` | Smoke the Mkety content data path |
| `pnpm storybook` | Start Storybook |

`dev:next` and `build:next` are framework diagnostics only. vinext is the deployment/runtime authority.

## Source of Truth

Start with:

- `AGENTS.md` — master Mkety ecosystem/product blueprint
- `docs/README.md` — documentation index
- `docs/AUTHENTICATION.md` — current application Auth implementation
- `docs/MKETY_AUTH_SOURCE_OF_TRUTH.md` — Auth ownership and provider boundaries
- `docs/DEPLOYMENT.md` — Cloudflare/vinext deployment rules
- `docs/MKETY_MIGRATION_BASELINE.md` — database migration authority and forward-generation rules
- `docs/MKETY_BILLING_ARCHITECTURE.md` — billing integration boundary
- `docs/MKETY_DOMAIN_ARCHITECTURE.md` — domain ownership/routing rules

Historical implementation plans under `docs/superpowers/` explain how specific slices were built, but the active architecture documents above take precedence when old implementation assumptions conflict.

## Promotion Discipline

- Do not deploy production from an unverified feature branch.
- Do not bypass tenant authorization or migration guards to make a test pass.
- Do not revive superseded Auth/runtime branches into the active baseline.
- Keep Trading enterprise/custom unless the master architecture is explicitly changed.
- Preserve verified external subsystem boundaries rather than duplicating them inside Platform.

## License

See `LICENSE`.
