## 2026-09-28 final central-AI / live-gate repository certification

Certified implementation SHA: `de0cc9c27cb5d6b10b5c3561dbb365573584e53f`.

Exact-head evidence:
- CI `36463882071` — SUCCESS.
- Migration Baseline `36463882626` — SUCCESS.
- Mkety AI Workspace Foundation Smoke `36463882405` — SUCCESS.
- Mkety Platform Core Workspaces Smoke `36463882573` — SUCCESS.
- Mkety Cloudflare vinext Smoke `36463882696` — SUCCESS.
- Mkety Public Candidate Deploy `36463882316` — SUCCESS.
- Production App Host Diagnostic `36463882391` — SUCCESS as a read-only diagnostic; it proves the current production defect, not a repair.
- Live Gate Readiness Diagnostic `36463882183` — SUCCESS.
- DomainNameAPI Direct OT&E Diagnostic `36463882234` — SUCCESS as a credential-readiness diagnostic; no preview DomainNameAPI credentials are currently configured.

The public candidate now performs the complete connected acceptance sequence:
1. applies the base Drizzle migrations before legacy Mkety content migrations;
2. verifies the connected staging database;
3. deploys an isolated candidate Worker with the real Workers AI binding and non-production AI Gateway;
4. creates a self-cleaning ephemeral Enterprise AI tenant/API key/credits/budget fixture;
5. temporarily enables customer inference in staging only;
6. performs a real managed Workers AI request;
7. verifies immutable rate-card selection, provider usage/cost evidence, credit/budget reservation and settlement, and idempotent replay;
8. restores the previous staging AI runtime policy and deletes the ephemeral fixture;
9. completes public-route/copy, Enterprise payment-safety and Public Mkety AI memory/privacy/commercial-grounding smokes.

The real commercial inference/accounting gate is therefore CLOSED on this implementation SHA.

Acceptance evidence from Public Candidate run `36463882316`:
- request `3c764161-8c05-4d5c-99a7-e4dc1505c91e`;
- `mkety-economy` -> `@cf/google/gemma-4-26b-a4b-it` via `workers-ai`;
- 24 input tokens / 8 output tokens / 0 cached input tokens;
- 3 credits reserved / 2 credits settled;
- provider cost 6 micro-USD / minimum revenue floor 21 micro-USD;
- one budget reservation settled;
- exact idempotent replay blocked without provider redispatch.

Managed-model benchmark remains closed by run `36425084523`:
- `mkety-economy` -> Gemma 4;
- `mkety-smart` -> GLM-5.3 Flash;
- Qwen remains disabled reserve.
Migration `0027_ai_managed_model_selection.sql` encodes this selection.

app.mkety.com:
- live diagnostics prove production is currently misconfigured: no Worker Custom Domain, a proxied CNAME target of `mkety.com/app`, and HTTP 530 on `/` and `/app`;
- repository-side repair is isolated in draft PR #160 from current `main`;
- PR #160 is green in full CI and vinext;
- its manual production workflow deploys a dedicated `mkety-app-host` Worker, preserves the public `mkety.com`/`www.mkety.com` Worker, binds existing production Hyperdrive, adds app callback/logout URIs to ZITADEL non-destructively, backs up/restores app DNS, attaches only `app.mkety.com`, verifies `/ -> /app -> /login -> auth.mkety.com`, then disables workers.dev/preview exposure.
No production app-host mutation has been executed yet.

Still intentionally deferred real external gates:
- DomainNameAPI real OT&E quote/lifecycle: code and workflows are complete, but preview GitHub Environment currently has no `DOMAINNAMEAPI_USERNAME` or `DOMAINNAMEAPI_API_TOKEN`;
- real customer white-label hostname acceptance: requires an actual controlled customer hostname;
- production app.mkety.com repair execution: manual PR #160 workflow only after choosing to perform the production mutation;
- production Enterprise AI promotion: `customerInferenceEnabled` remains OFF and must stay OFF until the remaining external evidence is recorded.

## 2026-09-28 final repository certification and live-release tooling

Certified implementation head: `106390643a63ad4ecaa7bbaa0f4edc10a976c72f`.

Exact-head evidence:
- CI run `36445378970` — SUCCESS: Build, Test, Lint and Type-check all passed.
- Migration Baseline `36445379145` — SUCCESS.
- Mkety AI Workspace Foundation Smoke `36445378931` — SUCCESS.
- Mkety Platform Core Workspaces Smoke `36445378968` — SUCCESS.
- Mkety Cloudflare vinext Smoke `36445379557` — SUCCESS.
- Mkety Content DB Smoke `36445379296` — SUCCESS.
- Mkety Public Candidate Deploy `36445379381` — SUCCESS, including tests/type/lint/vinext, connected DB application, payment-gateway checks, isolated Worker build/deploy, public-route/copy smoke, payment safety and Public Mkety AI memory/privacy/commercial-grounding smoke.

The previous Public AI candidate failure was a false-positive acceptance rule that treated legitimate product names such as Mail Growth as a retired Platform plan. Candidate and production acceptance now reject only retired `Growth|Pro|Business` plan/tier/workspace phrases; the corrected integrated candidate passed.

Repository-side release tooling is now complete:
- `.github/workflows/mkety-ai-commercial-acceptance.yml` / `scripts/accept-mkety-ai-commercial.ts`: one tiny non-production managed request with direct DB verification of immutable rate-card selection, credit/budget holds and settlement, normalized usage, provider-cost evidence, and idempotency.
- `.github/workflows/mkety-domainnameapi-ote-acceptance.yml` / `scripts/accept-domainnameapi-ote.ts`: reads the active encrypted database DomainNameAPI connection, refuses non-OT&E operation, verifies availability transport, and optionally performs OT&E registration + renewal lifecycle acceptance.
- `.github/workflows/mkety-enterprise-ai-white-label-domain-acceptance.yml` / `scripts/accept-enterprise-ai-white-label-domain.ts`: read-only real-host acceptance for CNAME, HTTPS tenant proof, database tenant ownership, configured white-label login identity and wrong-tenant-path isolation.
- `.github/workflows/mkety-enterprise-ai-inference-promotion.yml` / `scripts/promote-enterprise-ai-inference.ts`: separate production operator enable/disable path. Enablement requires benchmark, commercial, domain and registrar evidence plus managed-route/rate/prepaid readiness. The application UI remains disable-only.

Production `customerInferenceEnabled` remains OFF. PR #159 must remain draft until the two remaining external real-environment acceptances are run and recorded: DomainNameAPI OT&E/lifecycle acceptance and a real customer white-label hostname acceptance. The managed commercial/accounting acceptance is already closed by run `36463882316`. Only after the external evidence is recorded may the guarded production promotion workflow be used.

## 2026-09-28 central AI runtime and dynamic-configuration authority

This section supersedes earlier statements below that describe Workspace AI, Enterprise BYOK, provider selection, or registrar integration as still separate/unimplemented.

- Mkety AI is one shared central transport/control layer with strict caller and credential isolation. Public AI, authenticated Workspace chat, managed Agent Builder/Automation execution, knowledge embeddings, the Enterprise AI product, and the Enterprise AI API consume that shared layer rather than maintaining independent provider transports.
- Managed Mkety inference remains Workers AI: `mkety-economy` resolves through the database model alias/route tables (currently Gemma 4), while `mkety-smart` resolves through those same tables (currently GLM-5.3 Flash). Routing is task-class based, not round-robin. Qwen 3.8 27B remains a benchmarked reserve. Because managed execution resolves active aliases/routes at request time, an approved model swap does not require an application rebuild.
- The shared external-provider adapter catalog is OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Cloudflare AI and AWS Bedrock. Public AI uses isolated Mkety-owned system connections; tenant Workspace/Enterprise BYOK uses tenant/project-scoped connections. A BYOK failure never silently falls back to Mkety-paid inference.
- Enterprise API BYOK execution is implemented through explicit `provider_connection_id`. Customer-provider token spend belongs to the customer provider account and is recorded separately from Mkety managed inference; Mkety does not manufacture managed-token charges for that call.
- Public AI routing, enablement, primary/fallback order and per-provider model selection are database-backed in Platform Control. Public AI provider credentials are encrypted database system connections. The old environment-based Public AI provider configuration is migration fallback only and is not the operational source of truth.
- Customer BYOK credentials and Mkety system-provider credentials are encrypted at rest and are never returned after save. Routine rotation does not require build/redeploy.
- Only bootstrap/root or infrastructure secrets belong in Worker/server secret storage. The shared connection-encryption root is `MKETY_CONNECTION_SECRET_ENCRYPTION_KEY`; the older `MKETY_AI_BYOK_ENCRYPTION_KEY` name is migration compatibility only. Mutable provider credentials, endpoints, model choices, routing, fallback order and reseller settings do not belong in deployment-time environment configuration.
- Domain registration is a system-wide Mkety service. DomainNameAPI is the concrete reseller adapter behind the shared domain-reseller abstraction; Enterprise AI, Deploy and future products consume it rather than owning registrar credentials.
- DomainNameAPI reseller credentials are encrypted in the database. OT&E/production mode, API endpoint override, nameservers and WHOIS privacy are database-backed Platform Control settings. Routine reseller credential rotation or configuration changes require no application redeploy.
- A guarded DomainNameAPI OT&E workflow exists for read-only transport/authentication verification. Production registrar mutations remain gated until OT&E lifecycle acceptance is recorded.
- Production Enterprise customer inference remains OFF. The shared runtime itself is not globally disabled by that Enterprise kill switch; the Enterprise commercial/API boundary enforces `customerInferenceEnabled` so Public/Workspace/internal isolated consumers are not incorrectly disabled.

Remaining release evidence is external/live rather than architectural: DomainNameAPI OT&E/lifecycle verification with the real reseller account, a real customer white-label hostname/login isolation test, the separate app.mkety.com production repair execution, and explicit production Enterprise inference promotion. Exact-head repository certification and the tiny managed commercial/accounting acceptance are already closed.



## 2026-09-28 managed-model benchmark decision

- Guarded paid benchmark rerun `36425084523` succeeded on commit `0b3fb85c78443cb471caeef7b66ac397535b607a` through isolated AI Gateway `mkety-ai-benchmark` using standard/postpaid Workers AI billing.
- Corrected benchmark evidence: Gemma 4 passed 8/10, GLM-5.3 Flash 9/10, Qwen 3.8 27B 9/10; provider errors were zero for all three.
- Managed launch selection is now Gemma 4 as the primary/economy model and GLM-5.3 Flash as the smart/complex model. Qwen remains a benchmarked reserve, not a default route.
- Routing is task-class based rather than round-robin: economy/general work -> Gemma; smart/complex work -> GLM-5.3 Flash; heavy work starts on GLM-5.3 Flash and may later escalate to full GLM-5.3 after a separate benchmark/integration decision.
- Public Mkety AI already has concrete adapters for OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Cloudflare AI and AWS Bedrock. This is a separate public-runtime provider configuration boundary.
- Enterprise BYOK currently has entitlement, provider-connection schema and route abstractions, but the commercial Enterprise execution path still invokes managed Workers AI only. Do not claim tenant BYOK execution is complete until provider adapters/secret-resolution are wired into that path.
- The ordinary authenticated Workspace chat still uses its older environment-wide OpenAI-compatible provider layer (OpenAI/Groq/OpenRouter/custom); it is not yet unified with Enterprise BYOK/model routing.
- Production `customerInferenceEnabled` remains OFF. The next live gate is tiny non-production commercial inference/accounting acceptance through the real Mkety Enterprise API path.
# 2026-09-28 continuation audit follow-up

A continuation audit started from PR #159 docs-only head `8dfa0d61296177e6ca59e8ff77a732cdfc579984`.

Verified after the original handoff:
- Public Candidate Deploy run `36415088152` completed successfully, including tests, type-check, lint, vinext compatibility, content DB application/smoke, isolated Worker deploy, public-route smoke, payment-safety smoke and Public Mkety AI privacy/memory smoke.
- PR #159 remains open, mergeable and draft.
- The completion branch was 0 commits behind `main` when this continuation audit began.
- Documentation authority was reconciled across `AGENTS.md`, `docs/README.md`, the AI runtime architecture, commercial/security spec, Enterprise capability map and the active superpowers plan. The launch channel contract now matches the implementation, and the second managed model remains benchmark-selected rather than documentation-selected.

The remaining blockers are live/external gates only: the guarded paid managed-model benchmark, a tiny real Workers AI + AI Gateway commercial-accounting acceptance, a real customer-domain white-label/isolation acceptance, concrete registrar/reseller adapter verification, and explicit guarded production promotion. Production `customerInferenceEnabled` remains OFF.

Use PR #159 itself for the latest docs-only branch head. The immutable implementation certification anchor remains `6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`.

# Mkety completion handoff — 2026-09-28

## Requested

Complete Enterprise Mkety AI as the separately entitled business product, then harden `app.mkety.com`, Mkety Mail, billing/product navigation, Admin/Ops controls and customer-domain/white-label flows. Preserve existing security, entitlement, payment-settlement and provider-secret boundaries. Document and verify the result for a clean next-session continuation.

## Already present

Before this completion pass, `main` already contained the Enterprise AI runtime foundation: tenant isolation, PBAC/entitlements, API keys, model catalog/routing, credit reservations, layered budgets, versioned rate cards, commercial admission, fail-closed runtime policy, provider-neutral execution contracts, Workers AI adapter groundwork and non-production benchmark infrastructure. Mkety Mail also already contained substantial backend/product surfaces.

## Changed

### Enterprise AI

- Completed the reconciled business console on PR #159.
- Added true entitlement-gated white-label branding: customer product name, logos, favicon, colors, support/legal links and customer login presentation.
- Kept customer hostnames mapped to the same tenant/workspace rather than creating duplicate identity/billing systems.
- Added managed `<subdomain>.mkety.app` provisioning.
- Added customer-owned hostnames through Cloudflare for SaaS with one-CNAME onboarding.
- Ported the Trading repo's safe live-route verification fallback: Cloudflare hostname+SSL active remains the strict path; if provider SSL state lags, Mkety may mark the hostname verified only when a live HTTPS proof endpoint returns the exact expected tenant identity.
- Kept product-session handoff tokens one-time and destination-host-bound.
- Expanded day-one channel vocabulary to Website, Telegram, WhatsApp, Instagram Direct, Facebook Messenger, Slack, Discord, LinkedIn Page Community, Microsoft Teams outbound workflow/webhook and custom webhook/API.
- Added Discord Ed25519 Interaction verification, deferred responses, background AI execution and outbound bot delivery.
- Added approval-gated LinkedIn Page Community webhook challenge/HMAC handling, notification resolution, comment retrieval and organization replies. Do not claim unrestricted LinkedIn DMs.
- Preserved provider-message idempotency.
- Kept managed inference behind entitlement, model/route policy, immutable rate-card selection, credit reservation and all applicable budgets.
- Kept actual provider cost separate from customer charge and retained the internal pricing floor logic.
- Kept ambiguous post-dispatch failures and local-settlement failures in `reconciliation_required`.
- Production `customerInferenceEnabled` remains OFF.

### app.mkety.com

- Request-cached server auth/session and tenant lookups.
- Request-cached effective entitlements.
- Workspace-card filtering from one entitlement snapshot instead of re-resolving entitlements per card.
- Parallel dashboard metrics.
- Replaced the sparse legacy tenant dashboard with an entitlement-aware product hub.
- Added correct tenant links for Projects, Billing, Usage & Credits, Mail, Enterprise AI, Media and Enterprise.
- Added a real Billing index showing all current Platform/Mail-family subscriptions, verified settlement history, billing ledger activity and self-service checkout.
- Added Plan & Billing and Usage & Credits to tenant navigation; Mail/Enterprise AI appear only when entitled.
- Repaired missing Admin Analytics, Departments and Settings -> Features routes.
- Repaired the stale Integration Jobs -> `/admin/processing` link.
- Added route-contract tests for Admin, Mail, Billing, Enterprise AI and product-host handoff routes.

### Mkety Mail

- Added persistent customer Mail navigation across overview, inbox, shared inboxes, domains, mailboxes, contacts, templates, Customer Updates, developer tools, analytics, apps and automation.
- First-time Mail setup now routes through domain verification before mailbox creation.
- `mail.mkety.com` multi-tenant entitlement checks are resolved in parallel.
- Existing Mail Ops safety boundary is preserved: safe workspace/domain operational state remains editable; provider secrets, verified-settlement authority, immutable billing history and unsafe quota/accounting bypasses remain protected.

### Admin/Ops

Platform Control continues to expose explicit editable/protected scopes for:
- public site/docs;
- app experience;
- plans/entitlements;
- billing ledger;
- payments;
- Mail operations;
- Enterprise AI operations;
- deployments/domains;
- domain/routing review;
- auth gateway visibility;
- security/audit.

No provider secrets were exposed or moved into browser-editable settings.

## Files/modules affected

Primary areas:
- `src/features/ai-runtime/**`
- `src/app/api/v1/ai/**`
- `src/app/(tenant)/t/[tenant]/enterprise-ai/**`
- `src/app/(tenant)/t/[tenant]/page.tsx`
- `src/app/(tenant)/t/[tenant]/billing/**`
- `src/app/(tenant)/t/[tenant]/mail/**`
- `src/app/(tenant)/t/[tenant]/admin/**`
- `src/shared/lib/auth.ts`
- `src/shared/lib/tenant.ts`
- `src/features/entitlements/server/**`
- `src/shared/components/layout/**`
- `src/proxy.ts`
- canonical docs under `docs/`

## Database/environment changes

The completion branch includes the previously reconciled additive Enterprise AI/business-console migrations and commercial/runtime schema work already documented in the PR. No secret values are stored in source. Existing Cloudflare/Coolify/DB credentials remain repository/runtime secrets. This session did not read or expose secret values.

Domain verification uses the existing Cloudflare for SaaS path plus the new tenant-bound live HTTPS proof fallback. The registrar/domain-reseller layer remains provider-neutral; the already-configured registrar account still needs its concrete provider adapter identified and verified before customer domain checkout is enabled.

## Tests/typecheck/build

Exact completion head:

`6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`

PR:

#159 — `feat: complete Enterprise AI, Platform dashboard, Mail and product controls`

Exact-head verification:

- CI — SUCCESS — run `36415088209`
  - Build — success
  - Type-check — success
  - Test — success
  - Lint — success
- Migration Baseline — SUCCESS — run `36415088127`
- Mkety Platform Core Workspaces Smoke — SUCCESS — run `36415088120`
- Mkety Cloudflare vinext Smoke — SUCCESS — run `36415088190`
- Mkety Content DB Smoke — SUCCESS — run `36415088033`
- Public Candidate Deploy — SUCCESS — run `36415088152`.

Branch relation at handoff:
- branch is ahead of current `main` by 167 commits;
- branch is behind `main` by 0 commits.

## Deployment/runtime verification

Repository-side and non-production build/smoke verification listed above is green.

The following are intentionally NOT yet production-certified:

1. paid guarded Workers AI model benchmark;
2. tiny live Workers AI + AI Gateway request proving real provider usage, cost and exact commercial settlement;
3. a real customer-owned hostname proving DNS/HTTPS, tenant-bound live route, branded login and tenant isolation;
4. concrete registrar/reseller adapter binding and checkout test;
5. guarded production promotion of `customerInferenceEnabled`.

Do not infer production readiness for those external gates from green CI.

## Current status

**IMPLEMENTED + REPOSITORY-VERIFIED**

PR #159 remains **DRAFT** intentionally because the paid/live external acceptance gates above are not yet recorded.

Current authoritative continuation branch:
`feat/enterprise-ai-complete-platform-20260928`

Certified implementation head:
`6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`

The PR may have newer docs-only continuation commits; use PR #159 for the current branch head.

Current `main` base used by PR #159:
`8f42835f7973d5c319e60a8bb6d4979208fc8d8a`

## Known blockers/risks

- Do not enable production Enterprise AI inference until the manual paid benchmark and tiny live accounting acceptance pass.
- Do not claim Cloudflare certificate state is active merely because Mkety live-route proof succeeds. The fallback proves correct HTTPS routing to the tenant; Cloudflare's own SSL status remains provider metadata.
- LinkedIn Page Community requires LinkedIn developer approval/permissions; do not market it as unrestricted LinkedIn DM automation.
- Microsoft Teams inbound is not implemented with Bot Framework identity verification; current Teams support is outbound workflow/webhook.
- Registrar checkout is not production-ready until the actual configured reseller/provider is bound to the adapter and tested.
- PR #147 is the only other open PR currently visible. It is historical Mail/public release-certification work and must not be merged as a substitute for #159.
- Stale AI PRs #145, #154, #157 and #158 are historical/superseded and must not be merged.
- Public Candidate Deploy run `36415088152` later completed successfully.

## Exact next steps

1. Re-read this file plus `docs/CURRENT_WORKSTREAM_STATUS.md`, `docs/MKETY_DEVELOPMENT_CONTINUATION.md`, `AGENTS.md` and PR #159 before making changes.
2. Run the existing manual capped Workers AI benchmark through `.github/workflows/mkety-ai-model-benchmark.yml` using its explicit paid-inference confirmation guard. Record model, quality, latency and actual Cloudflare cost evidence.
3. Select/confirm the second managed model from benchmark evidence; do not choose by documentation alone.
4. Run one tiny non-production Workers AI + AI Gateway inference through the real commercial path and verify:
   - entitlement/model/route admission;
   - immutable rate-card selection;
   - credit and budget holds;
   - normalized provider token usage;
   - actual provider cost;
   - exact customer charge;
   - release of unused reservation;
   - idempotency/replay;
   - reconciliation behavior.
5. Test one real customer-owned hostname end to end:
   - one CNAME;
   - HTTPS works;
   - tenant-bound live-route proof;
   - customer-domain login/handoff;
   - full white-label presentation;
   - no cross-tenant access.
6. Identify the configured registrar/reseller provider, implement/bind its server-side adapter and test search/purchase/provisioning without exposing credentials.
7. Only after steps 2-6 pass, update docs with evidence, move PR #159 out of draft, merge through normal protections, and perform guarded non-production/production promotion as appropriate.
8. Keep `customerInferenceEnabled` OFF in production until the production acceptance gate explicitly passes.
9. After Enterprise AI promotion, continue with any remaining performance/UX polish on `app.mkety.com` and Mail only from the new `main`; do not revive stale branches.

## Gate-tooling audit follow-up

Repository audit of the remaining live gates confirmed:

- `.github/workflows/mkety-ai-model-benchmark.yml` is the intended guarded paid benchmark path. It requires the explicit `RUN_SMALL_PAID_BENCHMARK` confirmation and an isolated non-production AI Gateway using standard/postpaid Workers AI billing.
- Platform Control intentionally cannot enable customer inference. `updateAiRuntimePolicy` preserves the existing enable state on ordinary limit edits, `disableEnterpriseAiInference` can fail closed immediately, and the contract test explicitly forbids an `enableEnterpriseAiInference` application action. Final enablement therefore remains a separate audited release/operator promotion after every live gate passes.
- No concrete registrar/reseller provider adapter is present in source. The provider-neutral `DomainResellerAdapter` throws until a real server-side adapter is configured, and no provider-specific registrar integration was identifiable during the repository audit.
- There is no dedicated one-click workflow for the tiny end-to-end commercial inference acceptance. That acceptance must use a deliberately prepared non-production tenant/API key/model route/rate card/credits/budgets and preserve DB plus AI Gateway/provider evidence. Do not weaken the production fail-closed switch just to make this test easier.
- The real customer-domain acceptance cannot be synthesized from repository state; it requires an actual controlled hostname/CNAME and must prove HTTPS, tenant-bound route identity, branded login and cross-tenant isolation.

These are release gates, not reasons to add unsafe self-service activation controls.

## Open PR state at handoff

- #159 — active authoritative completion PR — DRAFT.
- #147 — historical Mail/public certification PR; treat as historical unless deliberately reconciled.
- #145/#154/#157/#158 — stale/superseded AI work; do not merge.

## Handoff rule

If a next-session agent changes any runtime, migration, deployment, production or workstream state, it must update:
- this dated handoff if still relevant;
- `docs/CURRENT_WORKSTREAM_STATUS.md`;
- `docs/MKETY_DEVELOPMENT_CONTINUATION.md`;
before ending the session.
