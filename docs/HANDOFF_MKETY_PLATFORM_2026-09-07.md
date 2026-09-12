# Mkety Platform Handoff — 2026-09-07

This document is the execution handoff for the current Platform stabilization line. It records the approved sequencing, verified branch state, Billing completion evidence, external blockers, cleanup constraints, and exact next steps so work can resume without re-auditing or reviving stale architecture.

## 1. Governing sequence

The approved order remains:

1. Freeze new major feature branches.
2. Finish Auth.
3. Establish one migration/runtime baseline.
4. Rebase and secure Webhooks.
5. Clean/quarantine old branches.
6. Build Platform domains in this order:
   - Billing
   - Entitlements
   - Usage/Credits
7. Keep frontend deployable/testable throughout, but do not promote production out of order.

Do not merge or deploy a downstream PR ahead of its prerequisite simply because its internal tests are green.

## 2. Source-of-truth repositories and runtime

- `MketyDigital/mksaas` is the authoritative Platform + public-site development repository.
- `MketyDigital/mklms` is the enterprise/customer installation project and remains the reference for the external managed-hosting billing Worker/provider contract.
- Legacy live Mkety code is reference material only; do not restore superseded framework/provider coupling from it.
- Runtime authority: vinext + Cloudflare Workers.
- OpenNext is removed from the active baseline.
- Cloudflare production deployment remains disabled unless explicitly promoted.

## 3. Active PR chain

### Auth — PR #16

Branch: `feat/mkety-auth-zitadel-vinext`

Current head at handoff: `42d10cdbbd0ae51c9158539f0df2982e62c34bf1`

State: OPEN, DRAFT, mergeable.

Auth architecture is implemented and internally verified. Mkety owns users, external identity mapping, PKCE/login transaction state, opaque sessions, tenant memberships, roles, permissions, authorization helpers and routes. ZITADEL is a replaceable OIDC adapter, not the owner of Mkety authorization.

Remaining Auth promotion blockers are external configuration/smoke gates:

- GitHub secret: `CLOUDFLARE_API_TOKEN`
- GitHub variable: `CLOUDFLARE_ACCOUNT_ID`
- Preview Auth values:
  - `MKETY_AUTH_ISSUER`
  - `MKETY_AUTH_CLIENT_ID`
  - `MKETY_AUTH_CLIENT_SECRET`
  - `MKETY_AUTH_SESSION_SECRET`
- Deploy the isolated Worker `mkety-platform-preview` to workers.dev.
- Record its exact URL.
- Register `<preview-url>/api/auth/callback` in ZITADEL.
- Register `<preview-url>/login` as the post-logout URI.
- Run real browser smoke: login -> callback -> Mkety session -> protected tenant route -> logout.

Do not merge Auth before those external preview gates are complete.

### Automation Webhooks — PR #15

Branch: `feat/mkety-automation-webhook-trigger`

Current head at handoff: `fd878a62bd1dc0a121183f4fc73599d2b454b207`

State: OPEN, DRAFT, mergeable.

Webhooks contains the verified Auth baseline plus secure webhook ingress, endpoint-secret separation, HMAC over exact raw bytes, bounded payload validation, workflow readiness checks, duplicate delivery admission, encrypted persisted endpoint secrets, canonical base64url checks, shared workflow execution, manager provisioning/rotation/disable controls, and the cleaned vinext/runtime baseline.

Promotion rule:

- Auth #16 must be promoted first.
- Immediately before Webhooks promotion, re-confirm Auth ancestry and application migration order.
- Current intended migration tail is `0009_mkety_auth` -> `0010_automation_webhook_trigger`.
- Do not deploy Webhooks to production merely because its internal verification is green.

### Billing Core — PR #21

Branch: `feat/mkety-billing-core-foundation`

Base: `feat/mkety-automation-webhook-trigger`

Current cleanup head at handoff: `fdc7b5e3cda7e3cf94e2acf242f6e6265863602a`

State: OPEN, DRAFT, mergeable.

Billing is intentionally stacked on Webhooks so it cannot bypass the approved Auth -> Webhooks sequence.

## 4. Billing architecture now implemented

Mkety owns the Billing domain. Gateways are integrations only.

Implemented domain records:

- Plans
- Immutable Plan Versions
- Tenant Subscriptions
- Billing Periods
- Checkouts
- Settlements
- Append-only Ledger Entries
- Manual Adjustments
- Renewal Attempts

Core rules:

- Money is integer minor units plus normalized currency.
- JavaScript persistence mapping uses `bigint`, not floating point and not unsafe JS `number` for persisted money.
- Plans and plan versions are distinct so commercial terms can evolve without rewriting historical subscriptions.
- Subscription state is separate from provider/payment state.
- Browser checkout success is never payment proof.
- Provider events normalize into a common verified settlement command.
- Mkety DB state is authoritative for tenant, subscription, billing period, expected amount and expected currency.
- Duplicate/replayed provider events cannot double-book revenue.
- Settlement + ledger + billing-state consequences are transactional.
- Ledger history is immutable; corrections use compensating entries.
- Manual/offline financial actions require current `billing.manage` authorization, actor, reason and idempotency key.
- Gateway state never directly grants product access. Entitlements will derive access from Mkety-owned Billing state in the next domain.

## 5. Selar + NOWPayments gateway model

Both are first-class gateway adapters at schema/service level.

### Selar

- Used for hosted local/card/mobile-money checkout capability.
- Hosted checkout or browser redirect success is not settlement proof.
- Automatic renewal is capability-driven and can be provider-managed where supported by the concrete Selar payment method/account configuration.
- Verified provider event/API confirmation must normalize into the common settlement boundary before Mkety books money.

### NOWPayments

- Used for crypto checkout/recurring capability.
- Hardened rule from `mklms` is authoritative: fail closed on missing/invalid verification.
- Only final verified `finished` is eligible to become a settled payment in this milestone.
- Legacy live behavior that treated intermediate statuses such as `confirmed` or `sending` as completed was deliberately not copied.

### Recurring/renewal modes

The Mkety domain uses provider-neutral renewal modes:

- `automatic`
- `provider_managed`
- `invoice_required`
- `manual`

A monthly/yearly plan defines billing cadence; it does not imply a gateway can auto-charge. Adapter capabilities determine actual collection behavior. Unsupported recurring flows fall back to invoice/manual renewal without changing the Billing domain model.

## 6. Billing verification evidence

Authoritative immutable Billing code/config verification SHA:

`f9bf7f8d6bf1f0c366e93c6d3c6026f19ab78312`

Billing Final Verification GitHub Actions run:

`34151822857`

That exact run completed successfully and checked:

- exact immutable SHA checkout
- frozen dependency installation
- Billing targeted test suites
- exact `[tenant]` Billing route test by path
- full repository test suite
- TypeScript type-check
- ESLint with no errors
- strict migration baseline guard
- `drizzle-kit check`
- forward Drizzle generation no-op proof
- `vinext check`
- production build
- Cloudflare preview packaging/deploy dry-run only
- clean/immutable repository proof

The verified run executed on `f9bf7f8d...`; after verification, only temporary Billing verification workflow files were removed.

Current cleanup head:

`fdc7b5e3cda7e3cf94e2acf242f6e6265863602a`

The post-verification cleanup removed only:

- `.github/workflows/_billing-core-tdd.yml`
- `.github/workflows/_billing-final-verify.yml`

No Billing application/schema/migration/runtime/gateway/Auth behavior was intentionally changed after the immutable verification.

## 7. Important defects caught during Billing work

These are worth preserving in future reviews because they show where silent regressions occurred:

1. Billing PostgreSQL `BIGINT` values were initially mapped to JavaScript `number`. A regression test demonstrated `9007199254740993` rounding to `9007199254740992`. Billing money mappings were corrected to JavaScript `bigint`.
2. The first tenant Billing route TDD command silently skipped the `[tenant]` route test because Jest interpreted the path as a pattern. The gate was changed to exact-path execution before route implementation was accepted.
3. Settlement idempotency was kept database-backed rather than implemented as a vulnerable service-level read-then-write sequence.
4. Gateway amount/currency/tenant information is not trusted as Mkety business truth; the transaction derives the authoritative billing period from Mkety state first.

Do not remove these regression tests or weaken these boundaries during later Entitlements/Usage work.

## 8. Billing migration baseline

Billing is application migration `0011` after:

- `0009_mkety_auth`
- `0010_automation_webhook_trigger`
- `0011` Billing core

Drizzle metadata/journal/snapshot alignment was verified and forward generation was proven to be a no-op at the immutable Billing SHA.

Do not hand-edit migration numbering around this chain. Use the existing strict migration guard and generated metadata workflow for all future application migrations.

## 9. Billing read/API boundary

The tenant Billing summary boundary is intentionally provider-neutral and safe for frontend consumption.

It exposes Mkety-owned plan/subscription/period/renewal/recent financial summary state and exact minor-unit values serialized safely for JSON.

It does not expose provider secrets, provider customer/subscription secret material, webhook raw secrets, or raw provider payload/reference data.

Authorization is based on current Mkety session/current DB tenant membership rather than stale serialized role data.

## 10. Frontend/deployability status

The repo runtime baseline is deployable through vinext/Cloudflare packaging and production build at the verified Billing SHA.

However, real preview deployment is still blocked at the Auth layer because Cloudflare credentials and ZITADEL preview configuration are not yet present. Once Auth preview is configured, use the isolated `mkety-platform-preview` workers.dev environment to inspect/test frontend behavior while downstream Platform work continues.

Do not enable top-level production workers.dev/preview URLs or deploy production simply to obtain a test URL.

## 11. Branch cleanup / anti-mix-up rules

`docs/MKETY_BRANCH_RETIREMENT.md` is the branch-retirement ledger and remains authoritative for stale refs.

Active development lineage:

- `main`
- `feat/mkety-auth-zitadel-vinext`
- `feat/mkety-automation-webhook-trigger`
- `feat/mkety-billing-core-foundation`

Historical merged/superseded branches must not be used as architecture sources.

Divergent/quarantined refs recorded in the ledger require explicit reconciliation before deletion/reuse.

The current connector does not provide a safe remote branch-delete operation. Do not force-move branch refs to simulate deletion.

Repository metadata still contains an old boilerplate repository description. This is cosmetic repository metadata and not application architecture; clean it when safe repository-metadata write access is available, but do not let it reintroduce template assumptions into source code/docs.

## 12. Exact next steps

### Step A — Finish Auth promotion gate

1. Configure `CLOUDFLARE_API_TOKEN`.
2. Configure `CLOUDFLARE_ACCOUNT_ID`.
3. Configure ZITADEL preview values.
4. Run isolated Cloudflare preview workflow.
5. Record exact workers.dev URL.
6. Register callback/logout URIs in ZITADEL.
7. Run real browser Auth smoke.
8. Re-run final Auth verification on the promoted candidate.
9. Only then merge/promote Auth #16.

### Step B — Promote Webhooks safely

1. Refresh Webhooks against the exact promoted Auth SHA if needed.
2. Reconfirm migration sequence `0009 -> 0010`.
3. Run immutable Webhook verification again if branch content changes.
4. Promote Webhooks #15 only after Auth.

### Step C — Promote Billing safely

1. Refresh Billing against the exact promoted Webhooks SHA if needed.
2. Preserve verified Billing application behavior while resolving only genuine integration conflicts.
3. Re-run full Billing immutable verification if ancestry/content changes.
4. Confirm application migration sequence `0009 -> 0010 -> 0011`.
5. Promote Billing #21 only after Webhooks.

### Step D — Next architecture domain: Entitlements

Entitlements is the next major Platform subsystem. Do not start Usage/Credits before Entitlements has a stable source-of-truth contract.

Recommended Entitlements design direction:

- Mkety-owned, tenant-scoped entitlements.
- Inputs come from Mkety plan/subscription/grant state, not gateway state.
- Explicit product/feature capability keys.
- Support plan-derived entitlements plus audited manual/enterprise overrides.
- Fail closed on missing entitlement.
- Keep entitlement evaluation separate from Usage/Credit accounting.
- Provide a stable service boundary consumed by AI, Automate, Deploy, Workspaces, SolutionHub, Academy and later Trading/Enterprise surfaces.
- Provider/payment adapters must never be called by feature authorization checks.

Because Entitlements is architectural, use the approved Superpowers brainstorming/design gate before implementation, then write the spec and implementation plan and execute with TDD.

### Step E — Usage/Credits after Entitlements

Only after Entitlements:

- metered usage events
- credit balances/allowances
- reservation/consumption semantics
- idempotent usage ingestion
- monthly reset/top-up rules where applicable
- plan allowance linkage through Entitlements/Billing boundaries

Avoid mutable wallet-style shortcuts that bypass immutable billing/usage history.

## 13. Do-not-do list

- Do not merge Billing ahead of Webhooks/Auth.
- Do not deploy production to test frontend.
- Do not let Selar/NOWPayments decide entitlement/access state.
- Do not accept browser redirect success as payment proof.
- Do not reintroduce NextAuth/Auth.js/OpenNext application architecture.
- Do not use stale session roles as tenant authorization truth.
- Do not use floating-point/unsafe JS number arithmetic for persisted Billing money.
- Do not mutate ledger history; use compensating entries.
- Do not hand-number migrations outside the guarded Drizzle sequence.
- Do not branch new architecture work from quarantined/historical refs.
- Do not restore legacy live payment routes merely because they existed in production previously.

## 14. Primary reference documents

- `AGENTS.md`
- `docs/MKETY_BILLING_ARCHITECTURE.md`
- `docs/MKETY_BRANCH_RETIREMENT.md`
- `docs/HANDOFF_MKETY_AUTH_ZITADEL_CLOUDFLARE.md`
- `docs/superpowers/specs/2026-09-06-platform-baseline-sequencing-design.md`
- `docs/superpowers/plans/2026-09-06-platform-baseline-sequencing.md`
- `docs/superpowers/specs/2026-09-07-mkety-billing-core-foundation-design.md`
- `docs/superpowers/plans/2026-09-07-mkety-billing-core-foundation.md`
- this document: `docs/HANDOFF_MKETY_PLATFORM_2026-09-07.md`

## 15. Resume instruction for next session

Start by reading this handoff plus the Auth/Webhooks/Billing PR bodies. Do not re-derive already approved Billing architecture.

First operational objective: clear the real Auth preview blockers and make the frontend externally testable through the isolated Cloudflare preview environment.

First new architecture objective after the promotion chain is stable: design Entitlements, then implement it with the same clean-domain/TDD/migration discipline used for Billing.
