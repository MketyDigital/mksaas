# Mkety Repository Structure

This is Mkety's active product repository, not the original SaaS starter template. Current project truth and in-flight work live in [`CURRENT_WORKSTREAM_STATUS.md`](./CURRENT_WORKSTREAM_STATUS.md); the approved detailed designs and implementation sequences live in [`superpowers/specs/`](./superpowers/specs/) and [`superpowers/plans/`](./superpowers/plans/).

## Product and runtime boundaries

| Surface | Repository location | Purpose and boundary |
|---|---|---|
| Public Mkety website | `src/app/(public)` and related public routes/components | Public company and product experience on `mkety.com`. Its production cutover is complete; routine changes do not require another cutover. |
| Authenticated Platform | `src/app/app`, `src/app/ops`, `src/features/` | Workspace, projects, AI, Deploy, Billing, Mail, Media, Enterprise products, and Platform Control. Canonical app host: `app.mkety.com`. |
| Mkety customer apps | `workers/mkety-app-router`, `src/features/deploy`, `src/app/api/internal/deploy` | Isolated customer dispatch on `*.mkety.app`; never execute customer code inside the authenticated Platform Worker. Current implementation is partial; see the active hosting plan before claiming service readiness. |
| Assist standalone product | `customer-apps/assist` | Separate production Worker, D1 database, controls, customer records, provider credentials, and MKredit ledger. Share product contracts where specified; do not import Platform credentials or data runtime. |
| Product workers | `workers/` | Dedicated Cloudflare Workers for AI delivery, Mail lifecycle functions, and customer app routing. Each worker has its own `wrangler.jsonc` and deployment requirements. |

`mkety.app` is the platform-provided customer app/preview domain. Its apex is a branded Mkety Apps entry point; it must not point visitors to a third-party `pages.dev` or `vercel.app` domain. Verified customer deployments use single-label hosts under `*.mkety.app`. Live DNS, TLS, Workers for Platforms namespace, and customer runtime acceptance are separate from local code validation.

## Main source tree

- `src/app/` — Next.js App Router pages, route handlers, server actions, public/API/authenticated entry points.
- `src/features/` — product capabilities organized by domain: `ai-runtime`, `public-assistant`, `assistant`, `automation`, `billing`, `deploy`, `domains`, `enterprise-checkout`, `mail`, `media`, `payments`, `projects`, `workspaces`, and supporting capabilities.
- `src/shared/db/schema/` — Drizzle schema. Add additive migrations under `src/shared/db/migrations/` and keep the SQL file, `meta/_journal.json`, and latest snapshot in sync.
- `src/shared/db/request.ts` — request-scoped database connection and AsyncLocalStorage context. Request-bound server reads/writes should use this boundary where required by the runtime.
- `customer-apps/` — independently deployable customer-facing products. Their runtimes and ledgers remain distinct unless a specific shared contract is documented.
- `workers/` — standalone Cloudflare Workers and their deployment configuration.
- `docs/` — current architecture, operations, workstream status, product contracts, and handoffs. Read current status before relying on historical release handoffs.

## Central AI contract

Public AI, Workspace AI, and centrally managed AI share Mkety's provider/model catalog, encrypted platform provider connections, and Workers AI binding. Public and Workspace routing and enablement are independent. Enterprise AI kill switches and paid-customer gates do not control either one. Assist keeps its own provider configuration, runtime, data, and ledger while using the versioned provider/model contract.

## Payments contract

Platform Billing and Enterprise checkout use the shared Mkety payment boundary. Assist owns a separate production payment runtime and MKredit ledger. All NOWPayments flows follow [`NOWPAYMENTS_INTEGRATION_PLAYBOOK.md`](./NOWPAYMENTS_INTEGRATION_PLAYBOOK.md), preserving each product's order and settlement boundaries.

## Domain map

- `mkety.com` — public company/product website.
- `app.mkety.com` — authenticated Mkety Platform.
- `api.mkety.com` — Platform/public API boundary.
- `ai.mkety.com` — Enterprise AI product experience when its customer gates are enabled.
- `mkety.app` — Mkety Apps apex entry point.
- `*.mkety.app` — isolated customer previews and managed applications.
- Customer custom domains — attached only through the approved hostname and tenant-ownership flow.

## Working rules

1. Read `AGENTS.md`, `docs/CURRENT_WORKSTREAM_STATUS.md`, and the active feature plan before editing.
2. Preserve the established product/runtime/data/ledger boundary; test against the boundary rather than inferring it from directory names.
3. Do not repeat the completed public-site cutover for routine edits.
4. Treat candidate/proof Workers as proof only; do not present them as customer apps.
5. Keep secrets server-only, scope database access to the intended request/tenant, and fail closed for unknown ownership or deployment state.
6. Run focused tests first, then the relevant feature suites, TypeScript, and migration baseline. Report live provider, DNS, or production acceptance separately from local test evidence.
