# Mkety AI Runtime & Gateway Foundation — Implementation Plan

Date: 2026-09-27

This plan implements the design in `docs/MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`. It is subordinate to `AGENTS.md` and the current commercial source of truth.

## Goal

Create a safe first foundation for the central multi-tenant Mkety AI service that powers Mkety first-party AI, AI Workspace, the standalone developer API and shared Enterprise AI configurations while supporting Cloudflare Workers AI, BYOK and approved private/self-hosted providers.

## First implementation slice

Keep the first slice deliberately narrow. It must not provision customer domains, mutate Cloudflare AI Gateway secrets, create paid inference, or reroute the existing production Agent Builder.

### Data model

Add new additive migrations for:

- AI API keys;
- AI model catalog;
- AI model aliases;
- AI routes/policies;
- AI provider-connection metadata/secret references;
- AI request/run records;
- AI budget records.

Do not store plaintext customer/provider secrets.

### API-key service

Implement:

- `mk_ai_live_` and optional `mk_ai_test_` key generation;
- SHA-256/HMAC-backed one-way storage consistent with the security level used by current Mkety API-key services;
- show once;
- tenant/project ownership;
- revoke;
- expiry;
- scopes;
- last-used timestamp;
- safe prefix display;
- audit context.

### Model catalog

Model catalog must be server-owned and capability-based.

Minimum capability flags:

- text;
- vision;
- embeddings;
- tools;
- reasoning;
- structured output;
- context/output limits.

No provider call occurs merely because a row exists.

### Runtime contract

Create a provider-neutral request/result contract with:

- tenantId;
- projectId;
- apiKeyId or first-party actor context;
- model alias/native requested model;
- messages/input;
- max output;
- tools/structured-output declarations;
- metadata/idempotency key;
- normalized usage;
- normalized finish/error state.

### Initial endpoints

Implement without paid-provider enablement first:

- `GET /api/v1/ai/models`;
- `POST /api/v1/ai/chat/completions`.

The route should be shaped for the external `api.mkety.com/v1/ai` host rewrite while remaining testable as an application route.

Before any real inference provider is enabled, the endpoint may return a controlled provider-unavailable error after authentication, entitlement, model and budget validation.

### Entitlements

Add capability-oriented entitlements rather than tying the whole product to individual providers.

Candidate keys:

- `ai.api`;
- `ai.byok`;
- `ai.private_model`;
- `ai.enterprise_instance`;
- `ai.channel.website`;
- `ai.channel.telegram`.

Existing provider-specific entitlement keys remain until a deliberate migration removes/replaces them.

### Usage

Retain existing immutable meters and introduce new ones only with tests.

Potential additions:

- `ai.request`;
- `ai.tokens.cached_input`;
- `ai.embedding.tokens`;
- `ai.image.input`;
- `ai.image.output`;
- `ai.audio.input_seconds`;
- `ai.audio.output_seconds`.

Provider cost is accounting metadata/a dedicated cost record, not a fake usage quantity.

### Budget authorization

Before managed inference:

- resolve tenant/project;
- resolve entitlement;
- resolve model/route;
- enforce request/key/project/tenant limits;
- verify sufficient prepaid/credit authorization under the final commercial design;
- reject before upstream call when not authorized.

A later provider adapter must not bypass this service.

## Team / PBAC slice

Before exposing tenant administration for the AI product:

- reuse existing tenant memberships/invitations and database-resolved PBAC;
- add AI-specific permission keys;
- add role bundles only as convenience defaults;
- test that builders, developers, knowledge managers, channel managers, billing admins and read-only analysts cannot cross their granted boundaries;
- do not build a second AI-only membership system.

## Commercial / usage slice

The detailed policy is in `docs/MKETY_AI_PRODUCT_COMMERCIAL_SECURITY_SPEC.md`.

Implement in stages:

- recurring plan allowance using the existing Usage/Credits primitives;
- effective-dated AI rate cards;
- normalized provider-cost records separated from customer charge;
- purchased top-up credits as an explicit extension to current Credits;
- hard-stop default for self-service managed inference;
- optional customer-authorized top-up;
- BYOK continuation where policy permits;
- controlled postpaid overage only for contracted/approved customers;
- usage warning thresholds;
- Enterprise demo grants with hard expiry/quota;
- payment settlement only through the shared NOWPayments/Flutterwave v3/Kora boundary.

Do not implement expiring multi-bucket credits by mutating the current single projected balance. Extend the ledger/bucket model deliberately with migrations and tests.

## Cloudflare slice after foundation

Once the foundation is green:

1. create the Workers AI adapter;
2. route it through Cloudflare AI Gateway using standard Workers AI billing, not Unified Billing;
3. configure a non-production gateway;
4. seed `@cf/google/gemma-4-26b-a4b-it` and `@cf/qwen/qwen3.8-27b` after re-verifying current pricing/capabilities;
5. explicitly prevent reliance on Cloudflare-managed third-party frontier credentials/Unified Billing;
6. run tiny controlled inference acceptance;
7. verify normalized usage and actual Cloudflare cost;
8. keep production enablement off until explicitly promoted.

## BYOK slice

- add provider-connection create/test/revoke operations;
- secrets go into the chosen secure secret mechanism, with only references persisted in Mkety DB;
- enforce BYOK-only no-wholesale/no-Mkety-paid-fallback behavior;
- prove a failed/missing BYOK credential cannot consume a Mkety-owned upstream account;
- meter Mkety platform features separately from customer provider cost.

## Existing AI Workspace migration

Do not change `src/features/ai/lib/provider.ts` to a remote runtime in the first DB/API slice.

After the Mkety AI runtime has production-like tests:

1. add a first-party internal runtime client;
2. test parity for streaming and non-streaming agent calls;
3. preserve Knowledge and Tools;
4. preserve Automation's current tool-disabled contract;
5. compare usage;
6. migrate testAgent;
7. migrate runAgent;
8. migrate published/automation consumers;
9. remove direct provider paths only after parity and rollback evidence.

## Shared Enterprise SaaS/PaaS slice

After the runtime/API is stable:

- tenant-scoped enterprise configuration CRUD/versioning on the shared central runtime;
- no one-Worker-per-customer provisioning by default;
- attach published agent;
- website channel;
- Telegram channel;
- managed `*.mkety.app` hostname;
- custom hostname request/provisioning through the existing Deploy/domain architecture;
- per-instance route/BYOK/private model policy;
- human escalation;
- conversation/run analytics;
- audit.

## Acceptance requirements

Before enabling any paid Mkety-managed inference:

- key auth fail-closed;
- revoked/expired keys rejected;
- tenant/project isolation;
- model not allowed rejected;
- entitlement absent rejected;
- budget absent/exhausted rejected;
- max token/body limits enforced;
- provider timeout/failure sanitized;
- no secret printed or stored in run logs;
- usage idempotency;
- upstream success + local accounting failure has an explicit repair path that does not unknowingly duplicate upstream spend;
- BYOK cannot silently fall back to a Mkety credential;
- production model prices/capabilities revalidated.

## Non-goals for the first implementation slice

- no production DNS mutation;
- no customer custom-hostname provisioning;
- no paid Cloudflare AI calls;
- no dedicated GPU provisioning;
- no replacement of Public Mkety AI's public-only trust boundary;
- no change to Trading execution authority;
- no bulk social integrations;
- no production reroute of existing Agent Builder.


## Research/design progress — 2026-09-27

Completed:

- authority audit across mksaas, Trading and mklms;
- clarified central shared runtime vs dedicated Enterprise infrastructure;
- researched current Workers AI, AI Gateway, BYOK, dynamic routing, spend limits, caching, guardrails, DLP, logging/analytics, OpenTelemetry and custom providers;
- reconciled existing Mkety tenant PBAC;
- reconciled existing shared payment boundary;
- reconciled Billing -> Entitlements -> Usage/Credits;
- documented commercial families, overages, top-ups, demo behavior, security, limits, caching, reliability, observability, conversation/handoff, knowledge/RAG and Enterprise roadmap;
- created `docs/MKETY_AI_PRODUCT_COMMERCIAL_SECURITY_SPEC.md`.

Current next step:

**AI-01 code foundation** — AI PBAC permissions, additive AI schemas, hashed AI API keys, model catalog/aliases, route/rate/budget records, provider-neutral runtime contract, budget authorization seam, models endpoint, chat-completions endpoint using a fake/non-billable adapter in tests, and isolation/security tests.

After AI-01 is green, proceed to non-production Workers AI + AI Gateway integration. Do not enable paid production inference as part of AI-01.

**Execution-order gate:** this AI implementation does not start until the currently active Mkety Mail production-completion workstream is finished, verified, and its follow-up PR sequence is reconciled. AI design/documentation may continue on this feature branch, but code implementation waits behind that operational gate.

Provider scope is locked for initial implementation:

- Workers AI hosted Gemma 4;
- Workers AI hosted Qwen 3.8 27B;
- customer BYOK for third-party frontier providers;
- private/self-hosted HTTPS model endpoint later;
- no Cloudflare Unified Billing frontier-model resale path.

Existing Public Mkety AI and AI Workspace are migration targets/first-party clients, not greenfield products to redesign. Preserve current pricing and behavior until deliberate commercial/product changes are approved.


## Progress update — 2026-09-27 late session

AI planning is now commercially reconciled with current `main`:

- current Public Mkety AI implementation/trust boundary reviewed;
- current AI Workspace behavior and $16.99/month commercial contract reviewed;
- current self-service 1/3/6/12-month billing terms preserved;
- initial managed provider scope locked to Workers AI Gemma 4 + Qwen 3.8 27B;
- Cloudflare Unified Billing/frontier-model resale explicitly excluded;
- third-party frontier providers remain BYOK;
- private OCI/AWS/Azure/etc. model endpoint remains future-compatible;
- exact current Workers AI unit costs documented;
- provisional ~65% pre-overhead gross-margin floor documented as a 3x planning reference;
- Enterprise remains the major net-new product layer.

Operational gate checked against current repository state:

- `main` remains `ac674ea97abdfdb4f853e72b0ff93b30a6f10614`;
- PR #142 remains open/mergeable and its Typecheck, Lint, CI, Build, Tests and PR Validation checks are green;
- its only failed check is the known repository-wide MegaLinter baseline;
- PRs #140/#141/#139 remain open in the expected state;
- PR #142 diff is limited to the Mail production workflow shell-portability repair.

**Current blocker before Mail can continue:** the Cloudflare API token permissions must be changed in Cloudflare. No connected Cloudflare management capability is available in this session, and the token value/permissions must not be exposed or guessed. Per the Mail handoff, do not merge #142 or start the guarded Mail production release until that token permission step is completed/confirmed.


## Mail gate update — 2026-09-27 23:25 UTC

Mail production completion was advanced and verified through the guarded workflow before AI implementation:

- PR #142 merged;
- current Mail proof logic includes merged PR #143;
- exact current production trigger reached authorization successfully;
- exact-SHA CI/Typecheck/Lint/Tests/Build passed after resolving GitHub concurrency cancellation;
- Migration Baseline proof passed;
- Cloudflare vinext Smoke proof passed;
- production database migration/deploy verification passed;
- ephemeral migration host cleanup passed;
- Cloudflare account credential verification passed;
- Mail infrastructure permission preflight failed safely at the first infrastructure permission check:
  - **R2 permission check: HTTP 403**
  - required permission: **Workers R2 Storage Write**
- Hyperdrive resolution, app deploy, R2/Queues provisioning, Mail Worker deploy, secrets, domains and production smoke were therefore correctly skipped.

Latest guarded Mail run observed: workflow run #11 (36358054268), exact head 32416bb09f32fc8b7157083647b7203f0cebbc0a.

AI implementation remains gated until the Cloudflare repository token is updated and the Mail production workflow completes green. Do not bypass the permission preflight.


## Execution gate update — Mail production blocker

Mkety AI implementation remains gated behind Mail production completion.

Latest authoritative Mail release evidence:

- Mail production workflow run: `36358566312`;
- exact release authorization: passed;
- production PostgreSQL migration: passed;
- Cloudflare account credential verification: passed;
- R2 permission preflight: **failed HTTP 403**;
- missing required permission: **Workers R2 Storage Write** on the repository `CLOUDFLARE_API_TOKEN`;
- all later Mail infrastructure/deployment/smoke steps were skipped.

Mail release-workflow safety fixes are completed and merged on main:

- #142 shell-portable proof walk;
- #143 safe migration-baseline proof inheritance;
- #144 serialized production runs + final main-head revalidation.

**Do not start AI-01 code implementation until the Cloudflare token permission is corrected, the guarded Mail production release succeeds, and Mail production functional acceptance is completed.**

AI architecture/commercial/provider planning remains complete enough to start immediately once this gate clears.


## Product packaging clarification — 2026-09-28

Enterprise Mkety AI is a separate paid product/workspace/add-on, not an automatic extension of the normal AI Workspace subscription.

Implementation implications:

- preserve the existing normal AI Workspace subscription and experience;
- add a separate Enterprise AI product entitlement (for example `ai.enterprise` / `workspace.ai.enterprise`);
- attach Enterprise-specific plan/version, allowance, limits and overage policy;
- surface Enterprise AI in the central Mkety product/catalog/billing experience;
- opening Enterprise AI routes the tenant into the Enterprise console at `ai.mkety.com`;
- reuse central tenant identity, membership/PBAC, Billing, Entitlements, Usage/Credits and Payments;
- do not create duplicate users, teams or a second billing/payment system;
- model, channel, custom-domain, security, SLA and private-runtime controls remain Enterprise-only unless separately entitled;
- BYOK and managed usage must be metered under the Enterprise product's commercial policy;
- hard-stop/prepaid/postpaid/BYOK-continuation overage modes must be explicit per tenant;
- limits are enforced as the strictest of entitlement, plan, tenant budget, customer safety setting and infrastructure/provider ceiling;
- Enterprise payment settlement remains through NOWPayments / Flutterwave v3 / Kora shared payment authority.

The intended pattern matches the future Media integration:

```text
Central Mkety tenant
  -> enable/purchase product add-on
  -> entitlement activates
  -> focused product console/runtime becomes available
```

Media can therefore remain at `media.mkety.com` with isolated media runtime/storage while becoming accessible as a centrally enabled Mkety product. Enterprise AI should follow the same commercial/product composition principle even though its inference runtime is centrally shared by default.

## Operational progress — 2026-09-28

Mail production completion and repository cleanup have now reached:

- Mail production workflow green after Cloudflare token permission correction;
- R2 bucket and Mail queues provisioned;
- all four Mail Workers deployed;
- runtime secrets attached;
- Mail/application domains attached;
- production Mail smoke passed;
- PR #140 merged;
- PR #141 merged;
- PR #139 closed as superseded;
- current main after SolutionHub merge: `7dc7884ebb28d96daa7820c51d37dfae183bf4b0`.

The AI implementation gate is now reduced to final exact-main validation/promotion checks. After those are green, begin AI-01 immediately.
