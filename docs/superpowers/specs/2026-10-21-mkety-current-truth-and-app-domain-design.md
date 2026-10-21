# Mkety Current State, Release, and Customer App Domain Design

**Status:** Draft for review  
**Prepared:** 2026-10-21  
**Repository reviewed:** `MketyDigital/mksaas`  
**Reviewed main SHA:** `cb88321d0d9a4037449a69ae1e3b6487e8f81b6e`

## Problem

The repository has advanced well beyond several of its front-door guides. Its current source includes the public Mkety site, the authenticated Platform at `app.mkety.com`, workspace capabilities, customer application code, and independently deployed products. Some guidance still describes the initial public cutover, the original SaaS template, or product modules as if they were current implementation plans.

The current `docs/CURRENT_WORKSTREAM_STATUS.md` cannot be read as UTF-8 through GitHub's file API. The source-of-truth index and deployment guidance therefore do not provide a reliable, concise answer to: what exists now, what is historical, and how to release a routine code change.

The `mkety.app` architecture note currently describes its apex as an informational landing page. The product requirement is broader: `mkety.app` is the customer-facing base hosting domain for deployed apps and previews, comparable in role to platform-provided hostnames such as `pages.dev` or `vercel.app`.

## Goals

1. Give future agents and developers one current, readable source of truth.
2. Preserve historical cutover and handoff evidence while clearly labeling it historical.
3. Describe the actual boundary between the public site, the core Platform, its individual workspaces, and standalone products.
4. Make routine production releases independent of initial domain cutover and routing changes.
5. Define and implement the `mkety.app` hosting namespace for customer previews and deployments, with its apex attached to Mkety's own hosting edge.

## Current facts the implementation must preserve

- The public `mkety.com` cutover is completed history. Routine edits must not invoke `CUTOVER MKETY PUBLIC`, attach custom domains again, or mutate DNS/Worker Routes.
- The initial-cutover runbook and workflow remain useful evidence for a future genuine routing/ownership migration, but they must not be presented as the normal code-release path.
- `mkety-public-candidate-deploy.yml` is an isolated candidate deployment. `mkety-public-production-cutover.yml` is a guarded routing/cutover workflow.
- `mkety-mail-production.yml` and `mkety-ai-production.yml` are product-scoped production workflows. They can deploy shared Platform workers as part of their own verified releases, but they do not define a general release path for arbitrary public-site or Platform changes.
- `mkety-app-host-production-repair.yml` is a repair workflow, not the ordinary app release workflow.
- `app.mkety.com` is the authenticated Platform host. Do not merge it conceptually with `mkety.com` or the customer deployment namespace.
- Workspace capabilities are part of the Mkety Platform product. Do not describe every workspace as a separate standalone product.
- Independently deployable customer products, including `customer-apps/assist`, retain their own explicit runtime, data, and release boundaries. Shared services are used only through documented APIs/events.
- The current `main` SHA is a repository code fact, not proof that the same SHA is deployed to production. State live deployment evidence only when a fresh deployment or runtime check supports it.

## Product and code map

The current architecture guide and project structure documentation should be rebuilt from the repository as it exists, not copied forward from the starter template.

- `src/app/`: route and API composition for the main Mkety web application.
- `src/features/`: business capabilities and workspace modules, including AI, Automation, Deploy, Domains, Mail, projects, usage, billing, and workspaces.
- `src/shared/`: shared infrastructure used within the main Mkety application.
- `workers/`: independently deployable edge workers and asynchronous product services.
- `customer-apps/`: isolated customer-facing applications with their own runtime and data boundaries.
- Additional products are standalone only where their runtime/release boundary is real; the index must point to evidence rather than infer independence from UI labels.

The documentation must distinguish current implementation, partial/foundation work, and future plans. Dated handoffs and plans remain immutable historical snapshots unless a specific factual error requires a clearly documented correction.

## Routine release design

Add a documented and guarded ordinary production release path for eligible main Platform/public-site code changes. The workflow design must:

- deploy an explicitly verified exact `main` SHA;
- require successful applicable CI/build/runtime gates and a successful isolated candidate where the surface has one;
- deploy code to the existing production Worker target(s) only after target names and binding expectations are verified from current configuration;
- preserve existing Worker Custom Domains, DNS, Worker Routes, secrets, and unrelated product bindings;
- run non-mutating post-deploy route/auth smoke checks appropriate to the changed app surface;
- fail closed on SHA drift, missing required proofs, or mismatched production targets;
- make no DNS, custom-domain, or Worker Route mutations.

Product-specific workflows remain product-specific. The cutover workflow remains available only for a real routing/domain ownership migration and is prominently labeled as such. A normal code release must never ask for or require the cutover phrase.

Do not claim a routine deployment path exists until the workflow is implemented, verified on an isolated or otherwise safe target, and documented with exact trigger and evidence behavior.

## `mkety.app` hosting design

### Product contract

- `mkety.app` is the platform-provided base domain for customer-built applications and previews.
- The apex hostname `mkety.app` must be attached to a Mkety-controlled hosting entry point, comparable in role to a provider's default application hostname. It must not point to a third-party `pages.dev` or `vercel.app` destination.
- Preview and managed production hostnames use reserved subdomains under `*.mkety.app`, each mapped through an authenticated, ownership-aware deployment record to the correct customer build/runtime.
- Customer-owned custom domains remain a separate verified attachment flow managed by the Deploy workspace.
- `mkety.app` and `*.mkety.app` remain separate from the public company site at `mkety.com` and the authenticated management application at `app.mkety.com`.

### Apex behavior

The apex must terminate at Mkety's platform hosting edge/router. It is the canonical base endpoint for the customer app-hosting service. When visited without a deployment hostname, it returns a small branded service response that explains that Mkety hosts customer applications/previews and links to `https://mkety.com` and `https://app.mkety.com`. It must not redirect to the marketing site as a substitute for an app-hosting endpoint, execute customer code at the apex, or reveal internal deployment details.

### Deployment hostname behavior

- The Deploy workspace allocates collision-safe, non-reserved hostnames and associates them with a specific deployment record and owner.
- Preview URLs identify an immutable deployment/version; production aliases may move only through the authenticated deployment promotion flow.
- The edge resolver rejects unknown, suspended, expired, or unauthorized hostname mappings safely; it must not fall back to another customer's app.
- Hostname allocation, preview access policy, caching, TLS, deployment version, and ownership checks are explicit parts of the Deploy contract.
- Reserve infrastructure labels, including `www`, `api`, `admin`, `auth`, `status`, `support`, `docs`, `mail`, `preview`, `system`, `origin`, and `internal`.

### Infrastructure and safe rollout

The implementation must establish the serving Worker/router and its deployment lookup contract before attaching production hostnames. Verify Cloudflare zone ownership, apex and wildcard DNS behavior, TLS coverage, Worker hostname routing, and route isolation through read-only inspection and isolated tests first. Attach the apex and wildcard routing only in a separately reviewed, explicitly authorized production rollout with rollback evidence. This repository cleanup must not silently change live DNS, custom domains, or routes.

## Documentation changes proposed

1. Replace the unreadable current status file with a short UTF-8 current snapshot and clear verification timestamps.
2. Make `docs/README.md` the concise document index, with explicit current-authority precedence and clear historical labels for dated handoffs/plans.
3. Append a current authority/architecture override to `AGENTS.md` after its protected historical section, preserving its existing protected text.
4. Replace the starter-template `docs/PROJECT_STRUCTURE.md` with a code-checked map of the current tree and product boundaries.
5. Update `docs/DEPLOYMENT.md` with candidate, routine release, product-specific release, repair, and one-time routing migration paths.
6. Mark `docs/MKETY_PUBLIC_CUTOVER_RUNBOOK.md` as a historical one-time cutover record; link to the ordinary release guide.
7. Update `docs/MKETY_DOMAIN_ARCHITECTURE.md` so the `mkety.app` apex is the Mkety-controlled hosting endpoint, and document the wildcard customer preview/deployment contract.
8. Add dated current-state/continuation guidance without deleting prior evidence or presenting stale snapshots as current.

## NOWPayments product integration coverage

The repository also contains the product-level playbook at `customer-apps/assist/docs/nowpayments-integration-playbook.md`. Its behavior is part of this cleanup and should become discoverable as shared Mkety guidance, because main Mkety Billing, Enterprise checkout, Enterprise AI checkout, and Assist expose NOWPayments paths.

Apply these checkout requirements consistently where NOWPayments is offered:

- Keep each product's stored fiat amount and its own order, customer, credit, and settlement ledger authoritative.
- Fetch active currencies from the authenticated NOWPayments API and expose supported network-specific choices; default to `USDTTON`, fall back to `USDTTRC20`, then the first active currency.
- Validate any selected currency again on the server before invoice creation. Preserve a safe hosted-provider fallback if the currency list is unavailable.
- Keep the invoice priced in canonical fiat; use fixed-rate quotes and customer-paid fees; show the provider's quote/fee before payment where the Mkety-owned payment step allows it.
- Persist invoice ID separately from payment ID and keep network/status/actual-paid-fiat evidence available for the owning product's payment history and Ops.
- Accept only verified, exact order/reference/amount/currency matches; automatically settle only provider terminal success `finished`; preserve existing explicit Ops-only partial-payment rules; make grants idempotent.
- Shared provider credentials, invoice transport, and provider verification stay behind the Mkety payment boundary where the current product architecture supports it. Each product still settles through its owning ledger.

Promote the playbook to shared documentation under `docs/`, keep the existing Assist path as a link to it, and reconcile any conflicting wording in `docs/MKETY_SHARED_PAYMENTS.md`. Audit all NOWPayments checkout entry points in the repository and close behavior gaps without changing product pricing, product ownership, entitlement policy, or unrelated providers.

## Non-goals and safety boundaries

- Do not repeat the completed public-site cutover for routine edits.
- Do not perform a production deployment or change DNS, Cloudflare routes, custom domains, or production secrets as part of documentation/spec work.
- Do not claim customer deployments are production-ready until routing, ownership isolation, TLS, release/promotion, and rollback are implemented and verified.
- Do not replace Cloudflare + OCI with Vercel or assume a third-party hosting hostname.
- Do not migrate workspace features into standalone apps or collapse independently deployed products into the main Platform.
- Do not delete old deployment/handoff evidence.

## Acceptance criteria

- A new contributor can identify current code ownership, workspace versus standalone boundaries, live/candidate/historical status, and the correct routine release path from the first documentation entry point.
- No current guidance calls for `CUTOVER MKETY PUBLIC` for an ordinary code change.
- No current documentation presents the starter-template route tree or completed cutover as future work.
- `mkety.app` is documented as the Mkety-controlled base endpoint for customer app hosting, with apex, wildcard, ownership, and custom-domain boundaries explicit.
- The implementation plan includes code/tests for app-host routing and DNS/TLS prerequisites, while keeping production domain attachment outside routine code release.
- Every statement that something is deployed or production-ready has a dated, exact-SHA or live-runtime evidence source; otherwise it is labeled as code-present, partial, or planned.
