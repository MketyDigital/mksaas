# 2026-09-29 pre-Starpips platform stabilization

Current production baseline: `main` at `8ec1bf52f96a7377490fb7fc4ccd2f1bcc031bf4` (PR #172).

## 2026-09-29 stabilization implementation progress

- Draft PR #173 is the active pre-Starpips stabilization branch.
- AI Workspace and Enterprise AI are explicitly separate product entitlements and user experiences. Shared identity, PBAC, billing, credits and runtime are platform primitives only.
- Tenant navigation has been simplified into Workspace / Products / Account; Admin exposes direct Product Operations entries.
- Public/app/product host separation is being enforced for `mkety.com`, `app.mkety.com`, `mail.mkety.com`, `ai.mkety.com` and `api.mkety.com`.
- Mail pricing is moving to active immutable database billing versions; Admin changes create a new version instead of rewriting history.
- Paid entitlements now fail closed after the paid period/grace window rather than treating paused or indefinitely past-due subscriptions as active.
- Enterprise AI solution settings now have real editable system instructions, approved solution knowledge, managed model selection and global pause state.
- Enterprise AI channel connections now support binding to a tenant-owned solution instance; the managed channel runtime consumes that solution's instructions/knowledge/model/pause and includes hidden context in reservation estimates.
- Enterprise AI now persists conversations/messages and exposes a per-conversation operator inbox with human takeover, manual reply, scheduled-action cancellation, and resume-to-AI.
- Enterprise AI now supports owner-configured reply pacing (0-900 seconds) and explicit future-commitment reminders. Scheduled work is persisted in Postgres, near-term work is queue-delayed, a minute sweep recovers missed/long-term work, and delivery re-checks entitlement/channel/solution/handoff state before sending.
- Enterprise AI recurring commercial access now has tenant-specific non-public versioned contract plans, negotiated monthly pricing, included entitlements/credits, verified Billing checkout activation, and fail-closed access after paid/grace periods.
- Enterprise AI now has a real playground and customer-safe runs view; playground disables reminder/pacing side effects but still uses commercial admission.
- Mail now exposes customer portability: existing contact CSV import/export plus workspace JSON export, RFC822/EML message export, and bounded authenticated EML import through the Mail content worker. Credentials, API keys, app passwords, provider secrets and verified settlements are intentionally excluded.
- Guarded workflow `.github/workflows/mkety-ai-production.yml` now defines exact-SHA deployment for `ai.mkety.com`, `api.mkety.com/v1/ai`, the AI delivery Queue/DLQ and scheduler worker. The workflow explicitly does not enable production inference.
- Dedicated customer setup/readiness runbook: `docs/MKETY_MAIL_ENTERPRISE_AI_CUSTOMER_SETUP_RUNBOOK.md`.
- Still incomplete before first Enterprise AI customer: exact-head CI, guarded production execution/acceptance for `ai.mkety.com`, `api.mkety.com/v1/ai`, delivery Queue/DLQ/scheduler verification, and then real customer acceptance before inference promotion.
- Starpips production acceptance remains blocked until this stabilization checklist is closed.

## Current production truth

- PR #159 is merged. The Enterprise AI / Platform / Mail / Domains implementation is no longer a pending completion candidate.
- Production hardening/finalization PRs #162, #163, #164, #165, #166, #167, #168, #170, #171 and #172 are merged.
- `app.mkety.com` is served by the dedicated `mkety-app-host` Worker; root/app/login/auth routing, production Hyperdrive/runtime bindings and the Worker Custom Domain were accepted in production.
- Auxiliary workers.dev and preview URLs for the production app host are disabled.
- DomainNameAPI fixed-egress relay acceptance has passed in both Live and OT&E quote-only modes through `registrar-relay.mkety.com`; the old HTTP 401 / missing-credential blocker below is historical.
- Production Enterprise AI `customerInferenceEnabled` remains deliberately OFF. Starpips real-customer acceptance has NOT started and must not start during this stabilization workstream.
- PR #169 and historical certification PR #147 were closed as superseded on 2026-09-29.

## Active workstream

Before any Starpips production acceptance, stabilize and simplify the authenticated Mkety application so completed backend/product capabilities are actually discoverable, manageable and fast in the UI.

Scope, in order:

1. audit/refactor `app.mkety.com` information architecture, first-login/dashboard experience, tenant/workspace navigation and admin navigation;
2. keep public `mkety.com` routes public-facing and ensure authenticated/admin/workspace routes live on their intended application/product hosts rather than leaking into public-site navigation;
3. reconcile implemented backend capabilities with customer UI and Platform Control/admin UI, especially Mkety Mail, Enterprise AI, Workspaces, Billing/Usage/Credits, Domains/DNS and entitlement-aware product entry points;
4. expose safe editable configuration through Platform Control where architecture already permits it, while keeping secrets, settlement, tenant isolation and immutable accounting protected;
5. verify `ai.mkety.com` and `api.mkety.com` route/host contracts and implement missing customer-visible Enterprise AI console entry points without enabling production customer inference;
6. design the non-destructive `media.mkety.com` connector/add-on path for normal Mkety workspace customers while preserving the existing standalone Media production customer/runtime/billing boundary;
7. remove stale/duplicate app-side paths, simplify navigation, reduce avoidable repeated reads, and add route/navigation/performance contract tests;
8. compare the uploaded legacy StarAI application only for customer-facing capabilities (assistant settings, knowledge, channels, human takeover, test console, logs, etc.); do not import its separate Worker/database architecture into Mkety;
9. certify exact-head CI/build/type/lint/tests and targeted host/navigation/product-surface smokes before beginning Starpips acceptance.

## Commercial behavior to preserve

Enterprise AI supports separately entitled/contracted customers. A customer may have a recurring commercial subscription (for example $100/month) plus included/prepaid usage. Billing/entitlement state must gate the service: when a subscription or required prepaid entitlement is inactive/expired and no allowed grace/committed capacity applies, customer-facing Enterprise AI execution must fail closed while preserving data/configuration. Add-ons/extra capacity must remain additive rather than replacing the base contract.

The exact customer price is a commercial configuration decision, not a hard-coded runtime amount. Verified payment/settlement remains authoritative; browser/client claims never grant service.

---

## 2026-09-28 sequencing update

Repository merge is no longer waiting on the real customer-hostname test. The remaining DomainNameAPI authentication issue and real white-label hostname acceptance remain unresolved external acceptance items. Enterprise customer inference remains disabled until those later acceptance requirements are intentionally completed.

## 2026-09-28 post-hotfix reconciliation and exact-head verification

- PR #160 merged to main as `909c3d31a524075763c0a1c7d7985f89254e0b3a`; its guarded app.mkety.com repair workflow has not yet been executed in production.
- PR #159 was reconciled with that main through merge commit `f70a37414ac9e3494cb638274322babbdf76747e`; it is 0 behind main and mergeable.
- Exact-head CI `36475433490`, migration baseline `36475433506`, AI workspace smoke `36475433627`, Platform workspace smoke `36475433433`, vinext smoke `36475433555`, live-gate diagnostic `36475433650`, and app-host diagnostic `36475433582` all passed.
- Integrated Public Candidate run `36475433480`, attempt 3, passed the complete sequence including connected database verification, isolated Worker deployment, real managed-AI commercial/accounting acceptance, public/docs routes, Enterprise payment safety, and Public Mkety AI privacy/commercial grounding. Attempt 2 had failed only on one HTTP 000 docs-link transport timeout; the unchanged retry passed, confirming it was transient.
- DomainNameAPI live credentials are present, but the safe quote-only provider probe currently receives HTTP 401. No registrar mutation was performed. Genuine OT&E lifecycle acceptance remains external and incomplete.
- Real customer white-label hostname acceptance remains deliberately deferred until an actual controlled customer hostname is connected.
- Production Enterprise customer inference remains OFF and must stay OFF until the external promotion evidence is intentionally completed.

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
# 2026-09-28 continuation audit reconciliation

Continuation audit started from PR #159 docs-only head `8dfa0d61296177e6ca59e8ff77a732cdfc579984`.

- Certified implementation SHA remains `6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`.
- Public Candidate Deploy run `36415088152` is confirmed SUCCESS in addition to the recorded CI, migration, workspace, vinext and Content DB gates.
- PR #159 remains open, mergeable and draft. PR #147 remains historical; stale AI PRs #145/#154/#157/#158 remain superseded.
- Documentation authority has been reconciled so Discord and LinkedIn Page Community match the implemented channel registry, Teams inbound is not claimed, and GLM/Qwen remain benchmark candidates rather than a preselected second managed model.
- Remaining blockers are live/external only: paid benchmark, tiny real provider/accounting acceptance, real customer-domain white-label/isolation acceptance, registrar/reseller adapter verification, and explicit guarded production promotion.
- Production `customerInferenceEnabled` remains OFF.

Use PR #159 itself for the latest docs-only branch head; do not encode a self-referential “current head” SHA into this file.

# 2026-09-28 exact session handoff pointer

Authoritative dated handoff:
`docs/handoffs/2026-09-28-enterprise-ai-platform-mail-completion.md`

Current handoff/docs branch head at the time this pointer was written:
`fa10bce4b0a274df5eb318fbfaf51c1e3a621043`

Certified implementation SHA immediately before the docs-only handoff commit:
`6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`

Verified on that implementation SHA:
- CI run `36415088209` — success (build, type-check, tests, lint);
- Migration Baseline `36415088127` — success;
- Platform Core Workspaces Smoke `36415088120` — success;
- Cloudflare vinext Smoke `36415088190` — success;
- Content DB Smoke `36415088033` — success.

PR #159 remains draft intentionally. Production Enterprise AI inference remains fail-closed pending the manual paid model benchmark, tiny live provider/accounting acceptance, real customer-domain white-label acceptance, registrar/reseller adapter verification and guarded production promotion.

First action in the next session: read the dated handoff and current PR #159 workflow conclusions before making runtime changes.


# 2026-09-28 Platform, Mail and Enterprise AI completion update

Current completion branch: `feat/enterprise-ai-complete-platform-20260928` / PR #159.

In addition to the Enterprise AI runtime/commercial/white-label work already recorded below, the same completion branch now includes:

- Discord as a real Enterprise AI conversational channel with Ed25519 Interaction verification, deferred responses, background AI execution and outbound bot delivery.
- LinkedIn Page Community as an approval-gated connector for supported organization comments/mentions. It validates LinkedIn challenge/HMAC requests, retrieves the actual comment, and replies as the connected organization. It does not claim unrestricted LinkedIn inbox/DM access.
- Trading-style custom-domain verification fallback: strict Cloudflare for SaaS active+SSL-active remains accepted, but if provider SSL state lags, Mkety can verify a hostname only when a live HTTPS route proof reaches Mkety and returns the exact expected tenant identity.
- `app.mkety.com` hot-path optimization: request-cached auth/session, tenant lookup and effective entitlements; single-snapshot workspace filtering; concurrent dashboard metrics; reduced repeated membership/PBAC/entitlement reads.
- A new entitlement-aware tenant product dashboard with correct Projects, Billing, Usage & Credits, Mail, Enterprise AI, Media and Enterprise entry points.
- A real tenant Billing index showing all current Platform/Mail-family subscriptions, verified settlements, ledger activity and self-service checkout links. Platform and Mail subscriptions remain independently composable.
- Persistent Mkety Mail customer navigation covering overview, inbox, shared inboxes, domains, mailboxes, contacts, templates, customer updates, developer tools, analytics, apps and automation.
- Mail first-time onboarding now starts at domain verification before mailbox creation, and the `mail.mkety.com` workspace chooser resolves multi-tenant Mail access in parallel.
- Tenant user navigation now exposes Plan & Billing, Usage & Credits, Mkety Mail when entitled and Enterprise AI when entitled.
- Missing Admin routes are repaired: Analytics, Departments and Settings -> Features now have real destinations; the stale Integration Jobs -> /processing link now routes to Integrations.
- Navigation route-contract tests lock Admin, Mail, Billing, Enterprise AI and product-host handoff routes.

Release/certification rule remains unchanged:

1. exact-head CI/type/lint/tests/build/migration/vinext/core-workspace/content-db smoke must all pass;
2. production `customerInferenceEnabled` stays fail-closed until the guarded paid Workers AI benchmark and tiny live provider/accounting acceptance are explicitly run and recorded;
3. a real customer hostname must prove HTTPS, tenant-bound live-route identity and branded-login isolation before production white-label promotion;
4. registrar/domain-reseller checkout stays behind the provider-neutral adapter until the configured registrar implementation is identified and verified;
5. Mail/product/payment changes must preserve existing verified-settlement, entitlement and provider-secret boundaries.




## 2026-09-28 Enterprise AI completion workstream

Current authoritative implementation direction:

- Enterprise AI remains separately entitled from normal AI Workspace.
- PR #159 is the clean current-main reconciliation of the business console; do not merge stale PRs #145, #154, #157 or #158 as historical patches.
- White-label is a real product boundary: entitled customers may replace product name, logos, favicon, colors, support/legal links and customer login presentation.
- Customer hostnames are routing context for the same tenant/workspace, never a duplicate tenant, user store or billing system.
- Enterprise AI tenants can activate an exact managed `<subdomain>.mkety.app` hostname. Mkety provisions the Cloudflare for SaaS hostname plus the exact `mkety.app` DNS CNAME and only treats it as live after verification; white-label tenants may also attach a verified custom hostname.
- Custom hostname onboarding is designed for one customer DNS action: CNAME the selected hostname to the Mkety SaaS target; Mkety owns custom-hostname provisioning, TLS and routing.
- Product-session handoff tokens are one-time and destination-host-bound so customer domains can establish host-scoped sessions without wildcard Mkety cookies.
- Domain purchase is provider-neutral behind the Mkety domain-reseller adapter; registrar credentials remain server-side.
- Day-one channel vocabulary is Website, WhatsApp Business, Telegram, Instagram Direct, Facebook Messenger, Slack, Microsoft Teams and custom webhook/API. The registry is adapter-based so additional channels do not create another AI runtime.
- Authenticated inbound channel adapters now verify Telegram secret tokens, Slack signed requests with replay-window checks, Meta HMAC signatures for WhatsApp/Messenger/Instagram, and signed custom webhooks before any AI credits can be consumed. Microsoft Teams is outbound workflow/webhook only until Bot Framework inbound identity verification is implemented.
- Customer console exposes plan, subscription status, current period, prepaid credits, current-month AI requests and charged credits in non-technical language.
- Managed inference executes only after Enterprise entitlement, route/model policy, immutable rate-card resolution, worst-case credit reservation and every applicable budget reservation.
- Workers AI is invoked through the Worker `AI` binding with an explicit AI Gateway ID. Pre-dispatch failures release holds; any ambiguous failure after provider dispatch preserves holds and becomes `reconciliation_required` so Mkety cannot silently absorb upstream spend.
- Successful provider usage is normalized, exact customer credits are calculated from the admitted rate-card version, and credit/budget reservations are settled from actual usage.
- Provider cost is recorded separately from customer charge in micro-USD. The default commercial planning floor targets 65% gross margin plus 15% overhead reserve; public numeric pricing is not changed by this workstream.
- If upstream inference succeeds but local commercial settlement fails, the request becomes `reconciliation_required` and must not be sent upstream again.
- Production `customerInferenceEnabled` remains off until model benchmark, cost verification, exact-head CI/migration/smoke/security acceptance and guarded promotion pass.

# Mkety Current Workstream Status

**Updated:** 2026-09-28  
**Current workstream:** Enterprise Mkety AI completion — business console, white-label domains, multi-channel runtime, managed inference and exact commercial settlement  
**Current main:** `8f42835f7973d5c319e60a8bb6d4979208fc8d8a`  
**Active completion PR:** #159 — `feat/enterprise-ai-complete-platform-20260928`  
**Status:** AI runtime/commercial admission is merged on main; completion branch keeps production customer inference fail-closed until exact-head verification and guarded promotion.

## 2026-09-21 production auth recovery and public-site audit

The public site remains live on `mkety.com` and `www.mkety.com` through the existing `mkety-platform` Worker Custom Domains. A production authentication regression prevented login/signup from reaching ZITADEL because the live Worker database path was still bound to the legacy Hyperdrive route.

Verified recovery:

- isolated PgBouncer v2 local secure `SELECT 1`: pass;
- Workers VPC Service created against the PgBouncer private Docker IPv4;
- separate `mkety-production-db-v2` Hyperdrive created after VPC routing propagation;
- `SELECT 1` through the VPC-backed Hyperdrive v2: pass;
- existing `mkety-platform` public release redeployed with only the `MKETY_DB` binding changed to the verified VPC-backed Hyperdrive;
- required production Mkety Auth bindings remained present after deploy;
- live `/login` and `/signup` returned browser HTML;
- live `/api/auth/login?returnTo=/select-tenant` redirected to the configured ZITADEL origin with Authorization Code flow, PKCE `S256`, the production callback `https://mkety.com/api/auth/callback`, and a client id;
- rollback to the legacy Hyperdrive was not required.

Production auth cutover run: `35571673240`.

Repository audit findings relevant to the public milestone:

- current public routes are present for Platform, Workspaces, Solutions, Academy, Pricing, Enterprise, About, Contact, Privacy, Terms, and Mkety Docs;
- login and signup are Mkety-branded and both use the same Mkety Auth/ZITADEL flow;
- the root layout uses Mkety metadata rather than starter-template metadata;
- public docs are served from the Mkety docs route group and are protected by tests against stale template/runtime/auth claims;
- the root README was still starter-template branded and has now been replaced with current Mkety repository guidance;
- open PRs #93, #57, #78, and #20 are all materially behind current `main`; none should be merged blindly. PR #93 and #57 are superseded by current production recovery work. PR #78 is an authenticated Platform/Deployments workstream and must be reconciled separately. PR #20 is an old documentation decision branch and must be reconciled separately if still needed.

Public/auth production is now a verified baseline. Do not re-open the legacy Hyperdrive/PgBouncer repair paths unless a new production regression provides fresh evidence.

### Production ZITADEL self-registration repair

Post-auth-cutover validation found that the Mkety organization inherited a ZITADEL login policy with local authentication enabled but self-registration disabled. The production signup page therefore reached the hosted identity flow but could not create a new local user.

The repair created an organization-scoped login policy that preserves the current effective login settings and enables `allowRegister=true` without changing the instance-wide default policy.

Verification evidence:

- repair run `35572460697`: success;
- independent post-repair diagnostic run `35572489071`: success;
- effective production policy now permits self-registration, local authentication, and username/password authentication.

This means `/signup` can now use the same Mkety Auth/ZITADEL OIDC entry flow as `/login` while exposing ZITADEL's self-registration path for new users.

### Production sign-in vs registration intent repair

A live-user report showed that both Mkety `/login` and `/signup` were entering the same generic ZITADEL authorization flow. When ZITADEL remembered an older account/session, signup could therefore show the hosted account chooser instead of opening registration.

The application flow now carries an explicit Mkety auth intent end to end:

- Mkety sign-in → `intent=signin` → OIDC `prompt=login`;
- Mkety signup → `intent=signup` → OIDC `prompt=create`;
- Authorization Code + PKCE `S256`, one-time state/nonce transaction persistence, and the production callback remain unchanged.

Guarded production deployment run `35573336899` passed and independently verified both live redirect contracts against the production ZITADEL issuer. Rollback was not required.

Additional lifecycle verification established:

- disposable verified ZITADEL identities can be created through the existing production management credential;
- ZITADEL username/password session creation succeeds for those identities;
- production OIDC auth-request lookup succeeds;
- the CI management PAT intentionally cannot finalize an OIDC auth request: ZITADEL returns `403 No matching permissions found` because finalization requires the dedicated instance `IAM_LOGIN_CLIENT` / `session.link` capability;
- do **not** grant `IAM_LOGIN_CLIENT` to the general `ZITADEL_MANAGEMENT_PAT` or an application end-user merely to make CI impersonate the hosted login. ZITADEL's hosted login already operates with the appropriate login-client authority. A future deterministic callback smoke should use a separate least-privilege login-client service account/PAT if one is provisioned.

The earlier Playwright production lifecycle attempts are not evidence of a Mkety product failure: they failed inside ZITADEL's reactive hosted-login field before Mkety callback. The protocol smoke then isolated the final CI-only permission boundary above. Treat the live redirect/policy/database evidence as the production baseline unless a real browser user reports a new callback/session failure.

## 2026-09-21 public final-polish reconciliation

The public-site audit was completed against current `main`, the active release branch, historical PRs, and the production auth recovery evidence.

Final reconciliation completed:

- restored the five approved Mkety Academy hub photos to current `main` from the already-approved release blobs and restored local-first image rendering with a safe external fallback;
- confirmed the public release branch already carries the approved Academy image set and the explicit sign-in/signup OIDC intent repair;
- made the public Contact experience actionable using established Mkety-owned channels:
  - product/support: `support@mkety.com`;
  - Enterprise/partnerships: `hello@mkety.com`;
  - Telegram: `https://t.me/mketyadmin`;
  - Academy: `https://academy.mkety.com`;
- added a regression test preventing placeholder contact destinations;
- confirmed public `/docs` renders from the Mkety CMS/default documentation tree rather than the legacy starter-template docs source;
- closed historical PR #20 because its Trading-local bearer decision is superseded by the current central Mkety Auth Gateway authority;
- left PR #78 on hold because it is a separate authenticated Deployments/Cloud workstream and conflicts with current `main`.

Current public release candidate:

- release branch: `feat/mkety-public-site-production`;
- exact candidate SHA: `a44f672b0e89f6c6e0129c2d425cd1bed3b3aa44`;
- immutable certification branch: `certify/3f85da0`.

Exact-SHA certification is now complete and green for `a44f672b0e89f6c6e0129c2d425cd1bed3b3aa44`:

- Content DB Smoke — run `35586389825`;
- Public AI Runtime Diagnostic — run `35586392588`;
- Production Routing Preflight — run `35586395433`;
- Public Candidate Deploy — run `35586398082`;
- Cloudflare Preview, including real hosted ZITADEL login → Mkety session → workspace creation → protected tenant access → hosted logout — run `35586401611`.

The earlier `3f85da0...` certification attempt correctly exposed stale test expectations around explicit sign-in intent, request-scoped RBAC database access, and current onboarding copy. Those were repaired as test/smoke-contract changes without changing approved runtime behavior.

Production promotion remains behind the repository's guarded public cutover confirmation and must not be bypassed.


## 2026-09-21 branded authentication cutover

Customer-facing authentication is now Mkety-branded and stays on the Mkety domain:

- interactive login hostname: `https://auth.mkety.com`;
- Login V2 base path: `/ui/v2/login`;
- ZITADEL Cloud remains the OIDC issuer/backend at the generated `*.zitadel.cloud` instance domain; do not change issuer/token validation to `auth.mkety.com`;
- the official ZITADEL Login V2 service is self-deployed behind Mkety infrastructure with the required public-host / instance-host proxy boundary;
- `auth.mkety.com` is a trusted ZITADEL login domain;
- a dedicated machine identity with only `IAM_LOGIN_CLIENT` is used by the Login V2 runtime; the general management PAT is not embedded in the login service;
- Mkety label policy is active with Mkety logo/icon assets, Mkety colors, hidden login-name suffix, and the ZITADEL watermark disabled;
- the effective instance feature is `loginV2.required=true` with `baseUri=https://auth.mkety.com/ui/v2/login`.

Guarded production cutover run `35609958644` passed. Live verification proved:

- sign-in lands on `https://auth.mkety.com/ui/v2/login/loginname`;
- signup lands on `https://auth.mkety.com/ui/v2/login/register`;
- the rollback step was not invoked.

Important implementation note: per-application `loginVersion.loginV2.baseUri` was not sufficient because the instance already had Login V2 required at instance scope; instance-level Login V2 takes precedence. Do not remove the instance base URI unless intentionally rolling back to the ZITADEL-hosted login.

ZITADEL Cloud native custom domains remain a paid Pro capability. Mkety currently achieves a branded customer login hostname without changing the Cloud issuer by using the supported self-hosted Login V2 custom-base architecture.

## Requested outcome

Finish the `mkety.com` public site, promote the exact certified release using Cloudflare Worker Custom Domains, verify production acceptance and rollback evidence, then move immediately into authenticated `app.mkety.com` development.

## Certified public release

Exact certified application SHA:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

Immutable certification branch:

`certify/2e871fe`

Production release branch:

`feat/mkety-public-site-production`

The release branch has been verified identical to the exact certified SHA.

Production deep diagnostic `35293332821` is green on that SHA and confirmed HTTP 200 for `/robots.txt`, `/sitemap.xml`, `/api/runtime-db-diagnostic`, `/api/health`, `/platform`, and `/api/public/assistant`, with the full Cloudflare/Hyperdrive DB ladder green through `singleton-database`.

## Exact-SHA certification evidence

Quality gates on exact SHA `2e871fe5...` are green:

- tests: `35293332938`;
- type-check: `35293332928`;
- lint: `35293332824`;
- build: `35293332926`;
- CI: `35293332854`;
- Cloudflare/Vinext smoke: `35293332872`;
- MegaLinter: `35293332877`;
- production Hyperdrive deep diagnostic: `35293332821`.

Candidate launcher `35300887227` succeeded. Exact-candidate blockers are green:

- Content DB Smoke: `35300895213`;
- Public AI Runtime Diagnostic: `35300896504`;
- Production Routing Preflight: `35300897695`;
- Public Candidate Deploy: `35300898914`.

## Custom Domain cutover tooling

PR #62 merged as:

`96f558e3ef971fbcba3c0d5e58738144c6e11e53`

Its final head `f4a8a60b1e6be828018ae1e85426d123b5b45e51` passed all required PR gates:

- tests `35302223625`;
- CI `35302223743`;
- lint `35302223662`;
- type-check `35302223621`;
- build `35302223641`;
- Vinext smoke `35302223693`;
- PR validation `35302223602`;
- MegaLinter `35302223645`.

PR #62 established the production binding contract:

- `mkety.com` → `mkety-platform` Worker Custom Domain;
- `www.mkety.com` → `mkety-platform` Worker Custom Domain;
- `mkety.com/*` and `www.mkety.com/*` Worker Routes must remain absent;
- unrelated Worker Routes must remain unchanged;
- the stale alternate custom-domain promoter was removed;
- the guarded production cutover workflow remains the only hostname-mutation path.

Cloudflare's Worker Domains API is used for attachment, with pre-mutation DNS/Custom-Domain/Worker-Route snapshots and automatic rollback.

## Cutover attempt 1 — stopped before public binding

PR #60 launcher `35301780726` dispatched cutover run:

`35301787839`

Result:

- exact-SHA authorization: pass;
- private PostgreSQL preflight: pass;
- ephemeral exact-SHA migration host creation: pass;
- environment-variable injection: failed with `curl: (35) Recv failure: Connection reset by peer`;
- ephemeral host cleanup: pass;
- production cutover job: skipped.

No Worker Route or Custom Domain mutation occurred.

## Cutover attempt 2 — stopped before public binding

PR #62 merge launcher:

`35302427849`

dispatched cutover run:

`35302435842`

Result:

- exact-SHA authorization: pass;
- release branch still exactly `2e871fe5...`: pass;
- all blocking exact-candidate gates revalidated: pass;
- private PostgreSQL URL resolution/health/privacy/SSL preflight: pass;
- ephemeral exact-SHA migration host creation: pass;
- environment-variable injection: failed with HTTP `404` on `PATCH /applications/{uuid}/envs`;
- ephemeral host cleanup: pass;
- Custom Domain/live cutover job: skipped.

No production hostname, DNS, Worker Route, or Custom Domain mutation occurred.

The 404 is expected for update semantics on a brand-new Coolify application when `DATABASE_URL` does not yet exist. Coolify exposes POST to create an application env, PATCH to update one, and GET to list current envs.

## PR #64 TDD and fix

Test-only commit:

`0ea82915fbfe896e5a16675cf2c52e6588ddd212`

Valid red: combined CI `35302525314` produced:

- Build: green;
- Lint: green;
- Type-check: green;
- Test: failed;
- test summary: 1 failed / 156 passed suites; 2 failed / 728 passed tests.

The two failures were exactly:

- launcher generation still `worker-custom-domains-v1` instead of v2;
- private DB executor lacked safe list/create-or-update/verify behavior.

Implementation:

- `9c2bddb4ce637e59ce77c0b6e41815f9201a1757` — safe Coolify `DATABASE_URL` upsert;
- `ea0836d1322e316056ac66a5dfc380eb21cd9758` — rearm one-time cutover launcher as `worker-custom-domains-v2`;
- `d5214b61d81bd61f9084965ad179ce040f1f0511` — align the cutover runbook with Hyperdrive-only Worker DB access and current payment safety.

The executor now:

1. GETs current application envs;
2. PATCHes `DATABASE_URL` only if it already exists;
3. POSTs only if the key is absent;
4. after an uncertain POST response, performs a read-before-retry so it does not blindly replay a create that may already have committed;
5. verifies the key exists before deployment proceeds.

The Worker itself remains private-credential-free: production migrations use the ephemeral private-DB executor; Worker runtime uses only the `MKETY_DB` Hyperdrive binding.

NOWPayments remains the required production cutover payment check. Flutterwave v3 and Kora are optional until their complete credentials are configured; Flutterwave collection FX rates and markup are database-managed in Platform Control.

## Production/environment/DB state

As of this update:

- public production cutover is successful and externally accepted;
- no apex/www Worker Route was created by the cutover workstream;
- `mkety.com` and `www.mkety.com` are attached to `mkety-platform` as Worker Custom Domains;
- both failed ephemeral migration hosts were cleaned up;
- private PostgreSQL remained healthy, private, and SSL-enabled;
- the certified application payload remains exactly `2e871fe5...`;
- public application runtime certification remains green.

## Latest cutover attempt

Cutover run `35304048710` passed authorization, production DB migration/seed/smoke, exact-SHA quality checks, Hyperdrive resolution, Cloudflare snapshot/rollback preparation, Worker build/deploy, direct-DB secret removal, and runtime secret attachment.

The Worker preview returned HTTP 200. The pre-domain smoke then rejected `/` because its quarantine regex treated any occurrence of the word `GitHub` as internal wording. The public homepage legitimately advertises GitHub integration, so this was an over-broad smoke rule rather than a runtime failure. Custom Domain attachment was skipped; production hostnames remain unchanged.

PR #65 narrowed that check to actual internal repository references such as `github.com/MketyDigital` while continuing to block internal repository identifiers, private origin hostnames, and stale runtime/template wording. Its v3 cutover progressed further: the preview returned HTTP 200 and passed the wording sweep, but the canonical smoke falsely required `rel="canonical"` to appear before `href` in the `<link>` tag. HTML attribute order is not significant. Branch `release/fix-canonical-smoke-2e871fe` reuses the repo's existing order-independent canonical-link parser and bumps the launcher to `worker-custom-domains-v4` for one clean retry.

## Exact next steps

1. Reconcile stale draft PR #35 (`fix: make RLS helper hardening portable to private Postgres`) against current `main`; preserve intent, do not blindly merge stale code.
2. Run the full required gates on the reconciled exact head and merge only when current-main compatible.
3. Continue Entitlements #22.
4. Continue Usage/Credits #23.
5. Continue the remaining authenticated Platform/app roadmap under `app.mkety.com`.

## Feature-agent handoff rule

Every material feature/runtime/deploy/migration PR must update this status and its relevant handoff with requested outcome, previous state, changes made, status, exact verification evidence, production/environment/DB changes, blockers/risks, exact next steps, and PR/issues/run IDs. No feature may be called complete, production, verified, or merge-ready until that handoff is current.


## Custom Domain DNS conflict resolution

Cutover run `35305522201` passed production DB migration, exact-SHA quality checks, Hyperdrive resolution, Worker deployment, runtime secrets, preview smoke, canonical checks, sitemap/robots, and DB-backed preview verification. It then failed at the first Worker Custom Domain attach with Cloudflare HTTP 409.

The pre-mutation artifact from that run proves the conflict source: both `mkety.com` and `www.mkety.com` still had two proxied A records pointing to `64.29.17.1` and `216.198.79.1`. Mail and verification records (MX/TXT/CAA) are unrelated and must be preserved.

Branch `release/resolve-custom-domain-dns-conflict-2e871fe` removes only pre-existing A/AAAA origin records immediately before each Custom Domain attach, preserves all non-origin DNS records, includes `zone_name` in the attach request, surfaces Cloudflare API errors, and relies on the existing rollback snapshot to restore removed A/AAAA records if attachment or live acceptance fails. Launcher generation is `worker-custom-domains-v5`.


## Live acceptance redirect normalization

Cutover run `35306492667` successfully attached both `mkety.com` and `www.mkety.com` as Worker Custom Domains after removing only the stale apex/www A records. Live `mkety.com` readiness returned HTTP 200. The run then failed only because the acceptance script compared the raw `Location` header from the required www 308 redirect to one exact serialization.

The workflow rolled back the Custom Domains and restored the pre-cutover A records, returning traffic to the previous site. Branch `release/robust-www-redirect-acceptance-2e871fe` keeps the 308 requirement but validates the redirect target semantically as HTTPS + hostname `mkety.com` + root path + no query/hash. Launcher generation is `worker-custom-domains-v6`.


## Live Public AI acceptance alignment

Cutover run `35307191844` passed authorization, production DB migration, exact-SHA quality checks, Hyperdrive resolution, Worker deploy/secrets, preview smoke, Custom Domain attachment, live route/canonical/sitemap/robots checks, and the semantic `www.mkety.com -> https://mkety.com/` 308 redirect check. Final acceptance then failed in the Public AI assertion and automatically rolled back the newly attached Custom Domains/restored prior A records.

The production acceptance contract had drifted from the already-certified candidate contract: it required `trade.mkety.com` in a new Trading buyer answer, while candidate certification explicitly rejects direct `trade.mkety.com` handoff for new buyers and requires Enterprise-first Trading sales. Branch `release/align-live-ai-acceptance-2e871fe` makes live acceptance identical to the certified boundary: canonical plans/prices, Academy production destination, Enterprise-first Trading sales, removed-plan rejection, and private-source/internal-engineering rejection. Launcher generation is `worker-custom-domains-v7`.


## Successful public production cutover — immutable evidence

Production cutover completed successfully on 2026-09-18.

- certified application SHA: `2e871fe5ba51585886713c2cb79544e68dc20b73`;
- release branch: `feat/mkety-public-site-production`, pinned to that exact SHA;
- launcher/main merge SHA: `4811e4b22c5a457857122ed01b8910546ca658df`;
- successful production cutover run: `35309531966`;
- runtime: Cloudflare Worker `mkety-platform`;
- database runtime: `MKETY_DB` Hyperdrive via `mkety-production-db`; private production `DATABASE_URL` was used only by the isolated migration executor and is not attached to the Worker;
- public bindings: `mkety.com` and `www.mkety.com` Worker Custom Domains;
- apex/www Worker Routes: absent; unrelated Worker Routes preserved;
- `www.mkety.com`: verified HTTP 308 to canonical `https://mkety.com/`;
- public route acceptance: passed;
- canonical metadata, sitemap and robots: passed;
- NOWPayments: read-only credential check passed and invalid-signature webhook failed closed with HTTP 400;
- Public Mkety AI: live commercial grounding, Academy destination, Enterprise-first Trading sales, removed-plan rejection and private-source boundary passed;
- auth entry points remain the public Sign In / Get Started handoff into the Platform; public-site production did not require replacing Mkety/ZITADEL auth;
- rollback evidence artifacts:
  - pre-mutation artifact `10533230861` (`mkety-public-cutover-pre-mutation-2e871fe...`);
  - Custom Domain rollback artifact `10532738152` (`mkety-public-cutover-custom-domain-2e871fe...`).

The public-site cutover milestone is complete. Do not reopen public release work unless production monitoring finds a real regression. The active workstream is now authenticated Platform/app development.


## RLS helper portability reconciliation

Historical draft PR #35 is superseded by current `main`. Its intended migration behavior is already present in `migrations/0008_harden_rls_auto_enable.sql`: the optional `public.rls_auto_enable()` helper is detected with `to_regprocedure`, and Supabase-only `anon` / `authenticated` revokes are conditional so private PostgreSQL does not fail when those objects are absent.

The only still-missing part from PR #35 was its regression coverage. Branch `fix/rls-auto-enable-portable-current-main` adds `src/shared/db/rls-auto-enable-migration.test.ts` against the current implementation. No production database mutation is performed by this reconciliation branch; it only locks the already-shipped portable migration behavior with tests.

Next after this reconciliation: Entitlements #22, then Usage/Credits #23.


## Entitlements #22 current-main reconstruction

Historical draft PR #22 is 192 commits behind the post-cutover main. Its entitlement-only delta is being reconstructed on `feat/entitlements-current-main` rather than merging the stacked branch.

Preserved scope:
- canonical entitlement keys;
- versioned plan entitlements;
- tenant grant/deny overrides with expiry and actor metadata;
- deny-by-default resolver;
- authoritative `requireEntitlement` enforcement helper;
- workspace entitlement filtering;
- migration `0012` and Drizzle metadata.

Current-main adaptation:
- Entitlements database reads use `@/shared/db/cloudflare`, matching the production Worker runtime gateway.
- Workspace query integration is applied on top of the current Cloudflare-aware Platform query file.
- Usage/Credits remains out of scope and follows after Entitlements.


## Usage/Credits #23 current-main reconstruction

Historical draft PR #23 is stacked on the obsolete Entitlements branch. Its Usage/Credits-only delta is being reconstructed on `feat/usage-credits-current-main` from the merged Entitlements main.

Preserved scope:
- stable Usage/Credits meter keys and bigint credit domain;
- plan-version recurring credit allowances;
- tenant credit-account projection;
- immutable usage events;
- append-only credit ledger;
- transactional/idempotent grants, usage recording and credit consumption;
- concurrent debit protection;
- recurring grants derived from Billing plan-version/current-period state;
- workflow execution enforcement: require `workspace.workflows`, consume one `workflow.execution` credit, then execute;
- migration `0013` and Drizzle metadata.

Current-main adaptation:
- Usage/Credits database reads/writes use `@/shared/db/cloudflare`, matching the production Worker runtime;
- current schema exports are preserved while adding the four Usage/Credits schema modules;
- no wallet, purchased packs, overage billing, provider-cost accounting or payment-provider coupling is introduced.


## Entitlements and Usage/Credits verification evidence

Entitlements current-main reconstruction PR #72 passed its full required gate set and merged as `19dc6f89a0a7ee17cc7f3bc43189e2e864f5d602`.

Usage/Credits current-main reconstruction PR #73, exact head `3cf6419824ddd4f58cca38398b81d3701df3157b`, is verified green on:
- Migration Baseline `35313143927`;
- Platform Core Workspaces Smoke `35313143828`;
- Build `35313143803`;
- Typecheck `35313143605`;
- Lint `35313143726`;
- CI `35313143693`;
- Cloudflare Vinext Smoke `35313144012`;
- Pull Request Validation `35313143881`;
- full tests/coverage `35313143824`;
- MegaLinter `35313143813`;
- PR-level validation `35313142418`.

No production database mutation has been run from PR #73. The repository migration chain is now prepared through `0013_lively_magma.sql`, with Usage/Credits still separated from Wallet and from the Billing financial ledger.

Next after PR #73 merges: continue the authenticated Platform roadmap from the current post-Usage/Credits main. Wallet remains a later, separate commercial/accounting projection and must not become stored-value or a second financial ledger.


## Wallet read-model slice

After Entitlements and Usage/Credits merged, the active app workstream moved to Wallet.

Branch `feat/wallet-read-model` implements the first Wallet slice as a read-only tenant account view. It deliberately does not create a new wallet table or financial ledger.

Architecture:
- Billing remains the only monetary ledger and source of subscription/billing-period/settlement truth.
- Usage/Credits remains the separate non-monetary product-credit ledger.
- Wallet composes both read models but never treats product credits as cash.
- no withdrawals, transfers, FX, stored-value funding, payment-provider calls, or balance mutation are introduced.
- tenant Wallet route: `/t/{tenant}/wallet`.
- runtime reads use the Cloudflare database gateway.

No database migration is required for this Wallet slice.

Next: verify the exact Wallet head with tests, type-check, lint, build, Vinext, migration baseline, workspace smoke, PR validation and MegaLinter; then record immutable verification evidence before merge.


## Wallet verification evidence

Wallet PR #74 implementation head `0ffbcd7216591a2bfe4a9deeb748685a524c6858` passed:
- Build `35314114841`;
- Lint `35314114675`;
- Typecheck `35314114736`;
- CI `35314114653`;
- Cloudflare Vinext Smoke `35314114632`;
- full tests/coverage `35314114614`;
- Pull Request Validation `35314114611`;
- MegaLinter `35314114745`;
- PR-level validation `35314111695`.

The public candidate deployment job `35314114685` was correctly skipped because Wallet is authenticated app work, not a public-site release.

No database migration or production database mutation is part of this Wallet slice. Wallet remains read-only and derives monetary information from the existing Billing ledger/state while displaying Usage/Credits separately as non-cash product credits.

After Wallet merges, the next architecture workstream is Deployments/Cloud. Inspect current repository state first and implement the smallest missing foundation slice rather than recreating existing deployment code.


## Wallet pre-merge security correction

Wallet PR #74 was fully green on its initial implementation, but focused review found two correctness issues before merge:

1. the Wallet page called `auth()` without enforcing the result, while the tenant layout itself does not reject unauthenticated/non-member access;
2. the Wallet settlement list queried all tenant settlements although the UI/design describes verified/applied payment records.

The branch now:
- uses `requireTenantMembership(tenantSlug)` before any Wallet read;
- adds a reusable explicit tenant-membership guard in `src/shared/lib/permissions.ts`;
- filters Wallet settlements to Billing records with status `applied`;
- adds regression coverage locking both contracts.

Wallet remains read-only: no new table/migration, no cash/stored-value balance, no withdrawal/transfer/FX, no payment-provider call, and no second financial ledger.


## Wallet exact verification evidence

Corrected Wallet PR #74 passed its full required gate set on head `e6a49adb82c63dfa087fa42bf3585ce5f068b5e6`:

- Typecheck `35320741465`;
- full tests/coverage `35320741436`;
- Cloudflare Vinext Smoke `35320741401`;
- Lint `35320741408`;
- Build `35320741447`;
- CI `35320741527`;
- Pull Request Validation `35320741387`;
- MegaLinter `35320741378`;
- CodeQL / PR-level validation `35320738336`.

Security/correctness checks included explicit tenant-membership enforcement before Wallet reads and applied-only Billing settlement display.


## Deployments/Cloud foundation

Wallet APP-06 merged as `10abc1e269444e26f32865e2f128a6c9c69757b4`. The active app workstream is now APP-07 Deployments/Cloud.

Branch `feat/deploy-foundation-current-main` implements the smallest missing backend foundation without enabling infrastructure mutation:

- `deploy_applications` — tenant/project-scoped logical web/API/service records;
- `deploy_environments` — tenant/project/application-scoped development, preview, staging, and protected production metadata;
- `deployments` — read-oriented deployment history and release/provider references;
- migration `0014_deploy_foundation.sql` plus Drizzle journal/snapshot;
- manager/admin-only creation of application and environment metadata;
- tenant/project-scoped reads through the existing project access boundary;
- Deploy Workspace lists applications, environments, and deployment history;
- production environments are metadata-only and marked protected.

Explicitly not implemented in this slice: Cloudflare/OCI/Coolify provider calls, credentials, DNS/custom domains, public preview/production URLs, deployment triggers, production infrastructure mutation, or rollback execution.

Verification must include migration baseline / `drizzle-kit check`, full tests, type-check, lint, build, Vinext smoke, PR validation, and MegaLinter before merge.


## Deploy foundation exact verification evidence

Deployments/Cloud foundation PR #75 implementation head `ed3fdd853e606a66874bb2eef33a3e1bda10a03e` passed:

- Migration Baseline / Drizzle consistency `35322339405`;
- Platform Core Workspaces Smoke `35322339400`;
- Lint `35322339373`;
- Typecheck `35322339384`;
- Build `35322339468`;
- Cloudflare Vinext Smoke `35322339408`;
- CI `35322339444`;
- Pull Request Validation `35322339438`;
- full tests/coverage `35322339426`;
- MegaLinter `35322339425`;
- CodeQL / PR-level validation `35322338062`.

Migration `0014_deploy_foundation.sql`, its journal entry, and `0014_snapshot.json` passed the repository migration baseline and `drizzle-kit check`.

No deployment provider, DNS, custom-domain, public URL, credential, production execution, or rollback mutation is enabled by this slice. The next Deployments/Cloud batch must introduce provider execution only behind an explicit provider boundary, approvals/audit, bounded failure handling, and rollback design.


## Deploy provider-neutral execution kernel

After Deploy foundation PR #75 merged as `41b0d40d75c7889da4d6aaa522714b141dbc69b0`, the next bounded Deployments/Cloud slice is the internal execution kernel.

Branch `feat/deploy-execution-kernel` adds:
- provider-neutral deployment adapter and repository contracts;
- queued -> running -> completed/failed lifecycle orchestration;
- request-scoped Drizzle lifecycle persistence through the existing `deployments` table;
- hard rejection of protected or production environments before persistence/provider execution;
- sanitized provider failures with no raw provider error leakage;
- focused tests using an injected fake provider.

No real Cloudflare/OCI/Coolify adapter is registered. No customer-facing deploy action, provider credential, DNS/custom-domain mutation, public URL provisioning, production execution, or rollback execution is introduced.

Next after this kernel verifies/merges: implement one isolated non-production provider adapter/candidate environment with explicit credential boundaries and real external verification before exposing a customer deployment control.


## Deploy execution kernel pre-merge hardening

Focused review added two fail-closed guarantees before any real provider adapter can be introduced:

- deployment lifecycle transitions are verified atomically; provider execution does not proceed if `queued -> running` fails, and completion fails closed if `running -> completed` cannot be recorded;
- provider execution is bounded by a default 60-second timeout, with invalid timeout configuration rejected before a deployment record is created.

Provider failures and timeouts remain sanitized, protected/production environments remain non-executable, and no real Cloudflare/OCI/Coolify/DNS mutation is enabled.


## Deploy execution kernel exact verification evidence

Deploy provider-neutral execution kernel PR #76 hardened implementation head `72071d1e67fb7e658b2425eea989b55da3b4320e` passed:

- Typecheck `35368192278`;
- full tests/coverage `35368192320`;
- Lint `35368192308`;
- Platform Core Workspaces Smoke `35368192159`;
- Build `35368192344`;
- Cloudflare Vinext Smoke `35368192427`;
- CI `35368192142`;
- Pull Request Validation `35368192199`;
- MegaLinter `35368192327`;
- CodeQL / PR-level validation `35368187791`.

Pre-merge hardening verified:
- `queued -> running` and `running -> completed` transitions must persist successfully or execution fails closed;
- provider execution is bounded by a default 60-second timeout;
- invalid timeout configuration is rejected before persistence/provider execution;
- provider failures/timeouts are sanitized;
- protected and production environments remain non-executable;
- no real provider adapter, credential, DNS/custom-domain mutation, public URL provisioning, or production deployment action is included.


## Cloudflare Deploy candidate adapter

Deploy provider-neutral execution kernel PR #76 merged as `3900bd7d1efe7ac9ac5868b8dec8314c8aecb945`. The next Deployments/Cloud slice is the first real provider adapter, limited to isolated Cloudflare `workers.dev` candidates.

Branch `feat/deploy-cloudflare-candidate-adapter` adds:
- trusted server-side module artifact contract with strict module/count/source-size limits;
- candidate Worker names restricted to `mkety-deploy-candidate-*`;
- real Cloudflare Workers Script API transport;
- explicit workers.dev enablement with Preview URLs disabled;
- workers.dev URL derivation;
- exact candidate deletion;
- provider/transport tests;
- same-repository GitHub preview-environment workflow that deploys a fixture Worker, externally smokes its marker, and verifies cleanup.

Still excluded: customer-facing deployment action, arbitrary repository/source fetching, provider bindings/secrets, DNS/custom domains, `*.mkety.app`, production execution and rollback execution.


## Cloudflare Deploy candidate adapter exact verification evidence

Deployments/Cloud candidate adapter PR #77 exact implementation head `c6ba480098fd5e66c768ea0a00a92c3d7b22fad5` passed:

- isolated Cloudflare candidate deploy / external workers.dev smoke / verified cleanup `35382218226`;
- Typecheck `35382218151`;
- Lint `35382218206`;
- Build `35382218169`;
- Cloudflare Vinext Smoke `35382218248`;
- full tests/coverage `35382218166`;
- CI `35382218177`;
- Pull Request Validation `35382218143`;
- MegaLinter `35382218311`;
- CodeQL / PR-level validation `35382214335`.

The verified candidate path is intentionally isolated:
- Worker names are restricted to the `mkety-deploy-candidate-*` namespace;
- execution is blocked for protected or production environments;
- only trusted, size-bounded module artifacts are accepted;
- no Worker bindings or customer secrets are uploaded;
- workers.dev is enabled only for the candidate Worker, with Preview URLs disabled;
- no `mkety.com`, `www.mkety.com`, custom domain, DNS, route, OCI, Coolify, or production Worker mutation exists in this adapter;
- the workflow proved the candidate marker externally and then proved exact Worker deletion.

This slice still exposes no customer-facing deploy action and does not enable production execution. The next Deployments/Cloud step must add an authorized non-production invocation path and audit/approval boundary before any user-triggered provider execution is exposed.

## Public production-readiness hardening before Deploy continuation

Before continuing the next customer-triggered Deployments/Cloud slice, PR #79 (`feat/public-production-readiness`) performed a focused production-readiness audit of Mkety public, authentication, onboarding, SEO, commercial-routing, and Enterprise-payment surfaces.

Exact implementation head verified before this handoff update:

`5bae8019b2deca6630bcfb2fb14fee5a52144ed2`

PR:

`#79 — feat: harden Mkety public production experience`

Implemented and verified:
- restored the exact legacy Mkety logo through a Mkety-owned route and used it across public/auth/onboarding surfaces;
- added a real Mkety signup entry and polished sign-in, organization selection, first-workspace setup, and tenant sign-in;
- kept customer-facing authentication provider-neutral and marked private auth/onboarding/payment routes non-indexable;
- fixed public homepage mobile overflow/truncation and removed template/development language and placeholder branding;
- aligned all public Deploy wording with the currently implemented application/environment/release-configuration/deployment-history foundation, without claiming unimplemented publishing/serverless/domain execution;
- restored the Academy **At Our Hubs** visual cards using the established legacy visual reference set;
- repaired public workspace CTAs that incorrectly targeted nonexistent `/app/ai`, `/app/automation`, and `/app/deploy` routes; public workspace entry now uses the valid authenticated `/app` gateway;
- added Mkety favicon/app manifest, 1200×630 social card, Open Graph/Twitter metadata, canonical metadata, JSON-LD Organization/WebSite data, sitemap/robots hardening, and private-route indexing exclusions;
- removed residual SaaS-template landing copy;
- made the commercial-content repair migration CMS-safe so replaying the root content migrations does not overwrite admin-managed pricing rows;
- preserved Enterprise as Custom: protected administration can issue exact negotiated USD payment links while public customers cannot choose or create arbitrary Enterprise amounts;
- repaired the stale public-candidate workflow gate that had been hard-coded to historical PR #24, so current same-repository public PRs receive real isolated candidate verification without exposing staging secrets to forks.
- serialized the standalone content-DB smoke and public-candidate staging jobs with one shared concurrency group after exact-head verification exposed a real race where both jobs could delete/reseed the same staging CMS rows simultaneously.

Exact implementation-head verification:
- Typecheck `35393687292`;
- Lint `35393687288`;
- Build `35393687466`;
- Cloudflare Vinext Smoke `35393687350`;
- Platform Core Workspaces Smoke `35393687472`;
- Migration Baseline `35393687347`;
- CI `35393687252`;
- Content DB Smoke `35393687399`;
- full tests/coverage `35393687368`;
- Pull Request Validation `35393687423`;
- MegaLinter `35393687372`;
- isolated Public Candidate Deploy / external acceptance `35393687516`.

Candidate evidence from run `35393687516`:
- candidate URL: `https://mkety-public-candidate.dry-glitter-7e16.workers.dev`;
- all required public routes, sitemap, and robots returned HTTP 200 in the external smoke;
- NOWPayments API credentials were accepted by the live API without creating an invoice or payment;
- Enterprise safety smoke confirmed customer-set amounts remain blocked, invalid webhook signatures fail closed, and payment confirmation remains separate from access/entitlement grants;
- Public Mkety AI passed real-provider support, restored-memory, New Chat isolation, canonical commercial grounding, Academy destination, Enterprise-first Trading sales, and private-source boundary checks;
- the pull-request candidate workflow checked GitHub's generated PR merge ref `8b065ce3f7edd477c346234290348321cc417bc6`; the implementation branch head verified above remains `5bae8019b2deca6630bcfb2fb14fee5a52144ed2`.

### Commercial readiness finding

Enterprise negotiated payments are operational through the protected admin-issued exact-amount flow.

Fixed-price self-service checkout now lives directly in MKSaaS Billing. NOWPayments remains the primary/default crypto path; Flutterwave v3 Inline and Kora embedded checkout become available only when fully configured. All three paths create pending billing state first and activate value only after verified, idempotent settlement through the Mkety Billing/Entitlements boundary.

Payment presentation may be native to Mkety, but provider UI remains provider-controlled and Mkety does not collect raw card details.

No production DNS/custom-domain mutation, production Deploy execution, OCI/Coolify mutation, or customer infrastructure provisioning was introduced by PR #79.

### Exact next order

1. Merge PR #79 after the documentation-only successor head remains green.
2. Implement live fixed-price self-service Billing checkout by reusing the approved shared Mkety billing-service contract and preserving verified/idempotent settlement boundaries.
3. Then resume APP-07 Deployments/Cloud from the already-verified Cloudflare candidate-adapter state: add an authorized non-production customer invocation path with explicit audit/approval boundaries before any production execution work.
## Self-service Billing checkout and MKSaaS billing authority

PR #80 (`feat/self-service-billing-checkout`) makes the MKSaaS Billing domain the explicit authority for Mkety Platform self-service subscriptions and removes stale MKSaaS documentation/workflow references that incorrectly pointed implementation work toward the independent `mklms` product. `mklms` production/main is not modified by this work and remains an independently deployed Enterprise Mkety product.

The self-service commercial path now covers the fixed-price Platform plans:

- Starter — $5.99/month
- AI Workspace — $16.99/month
- Automation Workspace — $16.99/month
- Deploy Workspace — $9.99/month
- Mkety One — $49/month

The implementation keeps Enterprise negotiated payments separate.

Billing now includes a server-owned fixed-price catalog, immutable plan-version-safe seeding, paid-workspace entitlement mappings, a non-entitling `pending_payment` subscription state, authenticated tenant checkout, NOWPayments invoice creation inside MKSaaS, signed webhook verification, exact amount/currency binding to Mkety Billing records, and idempotent verified settlement through the existing Billing ledger/service boundary. Browser return/success pages remain non-entitling.

The customer path is:

`/pricing` → selected plan → signup/login → tenant selection or first-workspace creation → authenticated tenant checkout → provider invoice → verified final settlement → Billing state → Entitlements.

Staging candidate and production DB release sequences seed and smoke the canonical Billing catalog. The standalone staging DB smoke is self-contained and independently seeds both CMS content and Billing catalog before smoke checks.

After this Billing slice is merged and production-promoted, resume APP-07 Deployments/Cloud from the previously documented next step: an authorized, audited, non-production customer invocation path over the existing deploy execution kernel. Production deployment, DNS/custom-domain mutation, OCI/Coolify mutation, and rollback execution remain outside that next slice unless separately approved.
## 2026-09-22 public legal and production-copy completion

A fresh public-site audit was run against current `main` at `d5ee4b4a0d34d8fdc68effdc290c039ec56b567f`, the authoritative architecture/handoff documents, the live public-content defaults, the remaining open PR state, and the protected legacy `MketyDigital/Mkety` repository.

Branch: `fix/public-site-production-copy-20260922`.

Findings and changes:
- the current `/privacy` and `/terms` routes existed but their defaults were short baseline summaries rather than production-complete legal pages;
- the legacy production site contained materially broader Privacy/Terms coverage, including billing/refunds, Academy, Enterprise, Trading, integrations and acceptable-use language;
- legacy wording was used only as coverage reference: obsolete plan names, automatic-renewal claims, blanket no-refund language, unsupported infrastructure/domain promises, provider-specific privacy guarantees and other stale product claims were not copied;
- Privacy now covers information categories, purposes, providers/integrations, AI processing, cookies/browser storage, retention/security, user choices and privacy contact without claiming unapproved certifications or fixed retention periods;
- Terms now cover account/access security, acceptable use, AI/automation/integrations, billing/cancellation/refunds, Academy/Enterprise/Trading boundaries, intellectual property, service evolution, suspension/termination, disclaimers and contact/update handling;
- stale template/demo/Auth.js-era customer wording was removed from the English getting-started docs and retained landing components so no reusable public surface advertises Mkety as a SaaS starter/boilerplate or promises a demo that does not match the current product;
- internal `saas_template` database/schema identifiers were intentionally not renamed because they are implementation details and changing them would be a migration/runtime concern, not a public-copy cleanup.

No production database, Cloudflare route, payment, authentication, deployment-provider or DNS mutation is part of this branch.

Remaining gate before merge/production use: exact-head repository CI, public candidate/route acceptance where triggered, and review of the rendered legal pages on the candidate.


## 2026-09-22 auth, onboarding and Platform Control boundary audit

The production auth/onboarding path was rechecked while finishing the public site.

Confirmed self-service sequence:

`/pricing` -> selected fixed-price plan -> signup/sign-in -> tenant selection or first-workspace creation -> authenticated tenant checkout -> provider invoice -> verified final settlement -> Billing state -> Entitlements.

This order is intentional. Non-Enterprise customers register before payment because subscriptions, payment records and entitlements are scoped to an authenticated Mkety tenant/workspace. A browser payment return never grants access. Enterprise remains separate and uses the protected negotiated-payment flow.

Auth behavior remains Mkety-owned and provider-neutral at the application boundary:
- sign-in uses `intent=signin`;
- signup uses `intent=signup`;
- both continue through the existing Authorization Code + PKCE flow;
- selected self-service plan keys survive auth and first-workspace onboarding into tenant checkout.

Login/signup presentation was reduced to one short explanatory sentence per page; the repeated card description/security copy was removed.

Security finding and correction:
- first-workspace creation correctly makes the creator an `admin` of that customer tenant;
- tenant `admin` currently resolves to wildcard tenant permissions;
- public CMS records are global Mkety content, not customer-tenant content;
- therefore Platform Control/CMS must not be reachable merely because a customer created a workspace.

Platform Control now fails closed unless the route tenant slug exactly matches the server-side `MKETY_PLATFORM_CONTROL_TENANT_SLUG` configuration and the signed-in identity is listed in `MKETY_PLATFORM_CONTROL_OPERATOR_EMAILS`. Normal customer tenant admins remain admins of their own workspace but cannot use the global Mkety Platform Control/CMS surface.

Bootstrap procedure for the first Mkety operator account:
1. configure `MKETY_PLATFORM_CONTROL_TENANT_SLUG` to a dedicated internal slug such as `mkety-ops`;
2. configure `MKETY_PLATFORM_CONTROL_OPERATOR_EMAILS` with the approved operator identity/identities;
3. create/sign in with one of those identities through the normal production auth flow;
4. create the dedicated workspace using that exact slug;
5. the creator becomes tenant `admin` and can open `/t/<slug>/admin/platform-control`;
6. invite/add later operator identities to that dedicated workspace and grant only the required operator roles/permissions.

Do not create a hidden hard-coded admin account, bypass identity, or grant customer workspaces global CMS authority.


The control-workspace slug alone is not an authorization secret. The server also requires the authenticated actor email to be present in `MKETY_PLATFORM_ADMIN_EMAILS`. This prevents a normal customer from claiming the reserved control slug and inheriting global CMS authority.


## 2026-09-22 canonical production plan/workspace feature sweep

Public plan/workspace capability copy has been normalized to the September 22 AGENTS/commercial contract across:
- homepage workspace/default content;
- /platform and /workspaces public page defaults;
- /pricing plan cards;
- public docs workspace articles;
- Public Mkety AI grounding;
- billing-facing plan descriptions;
- CMS repair migration pricing descriptions and feature rows;
- Platform Control pricing-module wording.

Canonical customer-facing feature dimensions now include:
- Starter: published websites/pages; landing pages, portfolios, simple business sites and supported blogs/docs; supported custom domains/SSL/edge delivery; supported forms/integrations; basic analytics/project management; asset/storage and usage/credits visibility.
- AI Workspace: Agent Builder; agents/published agents; drafts/version history; model choice/test playground; knowledge/storage/retrieval; tools/actions/API; Website AI, Telegram and supported messaging; conversation/run history; usage and team access.
- Automation Workspace: visual workflow builder; webhooks/schedules; API actions/conditions/notifications/integrations; secrets; retries; execution logs/history; execution/usage visibility and team access.
- Deploy Workspace: managed edge/serverless application runtime; lightweight web app/API/portal deployment; supported custom domains/SSL; environment variables/secrets; deployment history/logs/status where available; project/application/usage visibility.
- Mkety One: Starter + AI + Automation + Deploy capabilities expressed through projects/workspaces, domains, usage/credits, teams, operational controls, support and history/analytics rather than infrastructure slices.
- Enterprise: custom implementation/managed delivery, dedicated/private infrastructure when required, containers/persistent services/networking/high-throughput needs, specialized integrations/Trading infrastructure, and custom support/commercial terms.
- Trading Workspace remains visible as Custom / Enterprise with no self-service price.

Production content DB smoke now compares every published pricing feature array exactly against the canonical defaults. This prevents a stale CMS seed or edited pricing dataset from silently passing release verification. Public pricing remains free of CPU/RAM/VPS/server-allocation claims.


## 10. Self-service prepaid billing terms — September 22, 2026

Fixed-price self-service plans support four prepaid subscription terms:

| Term | Discount | Commercial meaning |
| ---- | -------- | ------------------ |
| 1 month | 0% | canonical monthly list price |
| 3 months | 5% | prepaid subscription total |
| 6 months | 10% | prepaid subscription total |
| 12 months | 15% | prepaid subscription total |

The discount applies only to the fixed subscription price. It does not automatically discount metered usage, credits, pass-through model/provider charges, or Enterprise/custom work.

The monthly plan version remains the immutable list-price source. The selected prepaid term deterministically calculates the server-owned checkout total and sets the Billing period end to the selected number of months. Browser/query values are never trusted as prices.

The selected term must survive:
`pricing -> signup/sign-in -> tenant selection/creation -> authenticated checkout -> provider checkout`.

Enterprise and Trading Custom / Enterprise terms remain separately quoted and are not governed by this self-service discount table.


## 2026-09-23 APP-07 deployment approval boundary

APP-07 now reconciles the historical deployment-request approval intent onto the current authorized Cloudflare candidate execution kernel.

Current contract:
- project manager/admin plus active `workspace.deploy` entitlement may request a non-production candidate;
- request stores tenant/project/application/environment plus required `releaseRef` and optional `sourceRef`;
- production/protected environments are rejected when requesting and again when executing;
- Platform Control operator access plus `platform:deployments` authority may approve or reject a pending request;
- approval does not execute a provider;
- an approved request may be consumed once by a project manager while Deploy entitlement remains active;
- request claim and queued `deployments` row creation happen in one database transaction;
- the queued execution is bound to the approved environment and exact release/source refs;
- provider execution uses the existing audited deployment kernel and Mkety-controlled Cloudflare candidate provider;
- request state moves through `pending -> approved/rejected -> executing -> completed/failed`;
- `executionDeploymentId` permanently links the request to its single execution;
- production deployment, DNS mutation, custom-domain mutation, rollback, arbitrary customer source execution, OCI, and Coolify remain out of scope.

Persistence is additive in `0015_deployment_requests`. The Deployments & Domains Platform Control module is now a foundation approval surface at `/admin/platform-control/deployments-domains`.


## 2026-09-23 production public cutover complete

The Mkety public production release is live and certified.

- deployed application release SHA: `6704dc1db64b2c24572c9f674a04bb2ac680f3b0`;
- production cutover workflow run: `35858120559` — success;
- production Worker: `mkety-platform`;
- public Custom Domains: `mkety.com` and `www.mkety.com`;
- canonical `www` redirect to `https://mkety.com/`: pass;
- runtime database binding: `MKETY_DB`;
- active Hyperdrive: `mkety-production-db-v2`;
- private production database migration: pass;
- Hyperdrive DB-backed production Worker preview: pass;
- direct production `DATABASE_URL` Worker secret removed;
- Platform Control runtime identity configuration attached;
- production public-route/canonical/sitemap/robots acceptance: pass;
- NOWPayments read-only credential validation and invalid-signature fail-closed acceptance: pass;
- Public Mkety AI canonical commercial grounding, Academy destination, Enterprise-first Trading sales, memory/privacy/private-source acceptance: pass;
- isolated candidate tests/typecheck/lint/Vinext/content DB/payment/live route/Public AI acceptance: pass;
- pre-mutation rollback evidence persisted and no rollback was required.

The production release path now consistently uses `mkety-production-db-v2`; active diagnostic workflows were aligned to the same Hyperdrive authority. Historical references to `mkety-production-db` are not production authority.

The public-site phase is complete. Continue authenticated application development from current `main`, preserving the production release controls and APP-07 approval boundary.


## 2026-09-24 final public-site production closure

The final public-site closure is merged and production-promoted.

Production application release:
- certified/released SHA: `ba1510d95c9c77ff9db7e95d2a5ae728e9d19b58`;
- guarded launcher run: `35967374372` — success;
- protected production cutover run: `35968252256` — success;
- rollback-guarded live acceptance completed successfully after `mkety.com` and `www.mkety.com` were attached to the release Worker;
- production database migration completed successfully;
- production uses `MKETY_DB` through `mkety-production-db-v2`; the legacy direct database Worker secret remains removed.

Final public contract now certified in candidate and production acceptance:
- Explore Mkety tabs remain horizontally scrollable on mobile and content/card containers are viewport-constrained with overflow-safe wrapping;
- collapsed Public Mkety AI bar sits below the header, uses a transparent background, and restores the Mkety logo;
- Public AI is the primary public support/sales/contact entry, searches published docs first, can answer from public context, captures voluntary lead/contact details when enabled, has deterministic fallback, and escalates to configured Telegram/email human support;
- Platform Control can update public support/sales emails, Telegram destination, Public AI prompt extension, fallback copy, lead-capture toggle, legal links, and public page/section payloads without code changes;
- Docs sidebar and article routing are generated from the same published docs tree, rendered docs links are release-smoked, and article previous/next navigation is present;
- login/signup preserve direct signin/signup intent into branded Mkety Auth; hosted auth link settings point to Mkety Terms, Privacy, Docs, and official support rather than ZITADEL legal destinations;
- Academy uses the five approved local uploaded hub images `class1.jpg` through `class5.jpg`;
- Academy public discovery/sales starts through Mkety.com/Public AI and official human support; `academy.mkety.com` remains the ready-to-learn sign-in/access handoff;
- Academy public CMS supports course/tier card structures with independently editable tier title, description, price badge and CTA, including add/remove/reorder through the structured page payload;
- Pricing currency rendering includes USD `$` and self-service prepaid terms remain 1/3/6/12 months with the approved discount ladder;
- Trading Workspace is visibly presented as `Custom / Enterprise` on Workspaces and Pricing;
- production acceptance explicitly fails on stale Academy tiers/ready-to-learn content, missing USD pricing, missing Trading Workspace, broken rendered docs links, missing Academy images, or a homepage Academy sales bypass.

PR #100 (`fix: close final public mobile, Academy and pricing issues`) merged successfully. Its final exact head was `f689c34696e32ea25fdcf41b824b15f9b9b4ac41`; merge/release commit was `ba1510d95c9c77ff9db7e95d2a5ae728e9d19b58`.

Known non-release blocker:
- MegaLinter may remain red from the pre-existing repository-wide Checkov baseline; all functional public release gates, exact-SHA candidate checks, production migration, production preview, hostname cutover and live acceptance passed.

### Next session

Public-site work is closed unless a new production regression is observed. Resume authenticated app development from current `main`, using the existing APP-07 approval-gated Deploy foundation as the starting point. Do not reopen historical public branches or PR #78 wholesale.



## 2026-09-23 authenticated SolutionHub catalog foundation

With the public production cutover complete and APP-07 approval-gated non-production Deploy execution merged, authenticated application work resumes with SolutionHub.

Current bounded SolutionHub contract:
- the authenticated project SolutionHub route is now a real discovery/catalog surface rather than a planned-only capability map;
- code-owned catalog entries are classified as shared-platform or Enterprise/Custom;
- shared-platform examples route only into existing project-scoped AI, Automation, or Deploy workspaces;
- approved shared examples include Customer Support AI, AI Knowledge Assistant, Lead Capture Automation, Telegram Workflow, Marketing Automation, and Business Website;
- complex ERP, substantial regulated-data systems, private/dedicated runtime requirements, and Trading Automation route to Enterprise rather than pretending to be self-service;
- no one-click install, clone, provisioning, entitlement mutation, billing mutation, infrastructure allocation, or Trading execution is introduced;
- SolutionHub continues to inherit the existing authenticated tenant/project access boundary from `requireProjectAccess`;
- Automation, Deploy, and SolutionHub registry availability now reflects implemented authenticated functionality instead of stale `Planned` labels;
- Deploy customer wording remains explicitly non-production: production execution and domains are still protected.

This slice is intentionally catalog/routing-first. Any future SolutionHub install/provision capability must introduce tenant/project-scoped persistence, entitlement/billing checks, approval/audit rules, idempotent provisioning state, and rollback/recovery design before enabling mutation.

## Mkety Mail commercial product + public production reconciliation — September 28, 2026

Requested outcome:

- make Mkety Mail a real separately subscribed/add-on Mkety product with public plans, enforced usage limits, shared payment settlement, authenticated product access and operations controls;
- publish Mail and Enterprise AI as first-class public product offerings without changing the existing AI Workspace product boundary;
- keep provider/internal infrastructure telemetry restricted to Mkety admin/ops;
- verify and complete the previously prepared Mkety public-site production cutover;
- do not alter authentication/session behavior for Academy, Media, Trading or unrelated `*.mkety.com` products.

Current implementation branch:

- `feat/mkety-mail-commercial-product-20260928`
- PR #146
- based on current `main` `7dc7884ebb28d96daa7820c51d37dfae183bf4b0`.

Implemented on the branch:

- Mail Starter $4.99/month;
- Mail Growth $9.99/month;
- Mail Business $24.99/month;
- Enterprise Mail remains contract/custom;
- `workspace.mail` entitlement;
- additive subscription-family checkout so a tenant can own one Platform-family subscription plus a separate Mail-family subscription;
- Entitlements composition across qualifying active subscriptions;
- Billing remains authoritative for purchased Mail tier;
- Mail workspace initialization resolves the paid Mail plan;
- plan-aware monthly outbound and Customer Update limits;
- existing daily/domain warm-up, bounce/complaint and reputation controls remain stricter safety boundaries when applicable;
- self-service Mail fails closed at quota; launch extra capacity is plan upgrade or Enterprise, not unimplemented prepaid capacity packs;
- customer-safe Mail usage view;
- global Platform Control Mail operations module for catalog reconciliation, tenant Mail state, onboarding and domain routing/sending/DNS readiness;
- public Mail marketing page expanded with professional inbox, aliases/forwarding, shared inboxes, contacts/templates, Customer Updates, transactional API, webhooks, supported external mail-client setup, deliverability controls, trust/security, plans, Enterprise and Marketing Coming Soon;
- public pricing/Enterprise/docs/llms/Public Mkety AI knowledge updated for Mail and separate Enterprise AI;
- CMS-safe public content refresh migration;
- product catalog/operations migration;
- Mail navigation and protected Mail routes require `workspace.mail`;
- canonical `/mail/app` resolves entitled Mail workspaces;
- Mail uses a product-scoped one-time session handoff rather than a wildcard `.mkety.com` application cookie.

Mail session-handoff safety:

- no wildcard Mkety application cookie;
- no central session token is placed in a URL;
- central app verifies its own Mkety session before issuing a Mail handoff;
- handoff token is opaque, one-time and expires after 60 seconds;
- Mail atomically consumes the handoff and establishes its own host-scoped Mkety session;
- audience is fixed to Mail;
- Academy, Media, Trading and unrelated Mkety subdomains remain unchanged;
- the pattern may be generalized to another product only through a separate explicit integration.

Payment boundary:

- NOWPayments remains primary/default crypto;
- Flutterwave v3 and Kora remain supported alternatives where configured;
- Mail uses the shared Mkety Billing/payment settlement path;
- browser redirect/success pages never grant Mail entitlement;
- provider webhook/re-query verification and idempotent Billing settlement remain authoritative.

Production audit findings:

- the live `https://mkety.com` apex is still serving the legacy Mkety marketing site as of this audit;
- the protected public production workflow is `Mkety Public Production Cutover`;
- that workflow promotes only `mkety.com` and `www.mkety.com`;
- it snapshots existing Cloudflare Custom Domains, apex/www DNS and Worker Routes before mutation;
- it refuses conflicting Worker Routes/custom-domain ownership;
- rollback rules explicitly preserve unrelated Worker routes and DNS;
- therefore Mail, API, Media, Academy, Trading, autoconfig/autodiscover and unrelated subdomains are outside the public cutover mutation set;
- the required release branch `feat/mkety-public-site-production` is currently stale: 187 commits behind `main` and 0 ahead, with merge base at the historical role-fix SHA;
- this stale release branch explains why repository public work and live public production diverged.

Release plan:

1. freeze PR #146 after documentation;
2. require exact-head CI, Migration Baseline, Cloudflare Vinext, Content DB Smoke and integrated Public Candidate success;
3. merge #146 to `main` only after exact-head certification;
4. verify exact new `main`;
5. fast-forward `feat/mkety-public-site-production` to the certified new `main` because that release branch has no unique commits to preserve;
6. run exact release-branch CI and integrated Public Candidate;
7. run the guarded public production cutover with the exact certified release SHA;
8. verify production DB/content migrations and public CMS seed/reconciliation;
9. smoke the real live `mkety.com`, `www.mkety.com`, pricing, Enterprise, Trust, Infrastructure, Academy discovery, Mail, docs, llms.txt, login/signup and Public Mkety AI;
10. separately verify `mail.mkety.com` product-session handoff, Mail entitlement, onboarding and customer dashboard;
11. confirm unrelated product hosts/routes are unchanged;
12. only after live acceptance passes, return to Enterprise Mkety AI implementation.

Known non-goals for this Mail release:

- Marketing campaigns remain Coming Soon;
- prepaid Mail capacity packs remain planned, not sold;
- external IMAP/SMTP remains subject to production certification where protocol infrastructure is not yet certified;
- no wildcard Mkety auth cookie;
- no Media/Academy/Trading runtime migration;
- no Enterprise AI inference-provider production activation.


## 2026-09-28 — Enterprise Mkety AI commercial safety and operations

**Current production/main authority before this branch:** `28e28562a5c5d08d5d050e15ab4b7af8c4901777`

### Completed and merged

- PR #150 — Enterprise AI runtime foundation, merged as `9ce9a3bd3591708b2604fa9f83b18e44ef102ede`.
- PR #151 — atomic AI credit reservations, merged as `43cadf485d105ed2fd1e9f6bc1a2f81fafe7cc95`.
- PR #152 — layered AI budget reservations, merged as `28e28562a5c5d08d5d050e15ab4b7af8c4901777`.
- Normal AI Workspace remains separate from Enterprise AI.
- Paid customer inference remains disabled.
- Credit admission now supports atomic hold, exact settlement, full failure release, idempotency, tenant/project/key/request ownership checks, immutable usage/ledger history, and concurrent-overspend protection.
- Budget admission now reserves every applicable active tenant/project/API-key budget in one transaction, distinguishes hard-stop and soft budgets, and settles/releases exact reserved counters.
- `docs/MKETY_AI_ENTERPRISE_CAPABILITY_MAP.md` defines the broad cross-industry Enterprise AI solution surface while preserving shared security/commercial primitives.

### Current workstream

Build the commercial-control and no-code Mkety Ops layer before any real paid customer inference:

- effective-dated, versioned AI rate cards;
- strict prepaid-only runtime policy;
- safe request/output/reservation limits;
- Platform Control visibility and emergency disable;
- simple business-facing Enterprise AI product experience with developer controls progressively disclosed;
- commercial admission orchestration that requires both credit and budget reservations before provider invocation;
- no production model/provider activation until exact accounting, failure repair, non-production inference, and model benchmark evidence pass.

### Commercial invariants

1. No managed inference without Enterprise entitlement, valid tenant/project/key scope, active route/model, active effective rate card, available prepaid credits, and all applicable hard budgets.
2. No silent postpaid overage. Enterprise AI remains prepaid/committed-capacity only unless a future explicit architecture and commercial decision changes this rule.
3. Rate-card values used for billable usage are historical facts. Future changes create a new version rather than rewriting prior pricing.
4. Browser success/return pages, client claims, API parameters, or provider responses never grant credits, entitlements, subscriptions, or budget bypasses.
5. Holds occur before paid provider work. Successful calls settle exact actual usage; failed calls release held value.
6. Customer BYOK never silently falls back to Mkety-paid credentials.
7. Mkety Ops may edit safe business configuration without code, but protected invariants, secrets, authorization, settlement logic, and production release gates remain non-editable.

### User-experience direction

Enterprise Mkety AI is presented as a business solution rather than an infrastructure console. The default customer journey is outcome-first (for example customer support, lead follow-up, knowledge assistant, booking/operations, internal helpdesk, and custom automation). Model/provider/API/routing controls remain available to advanced users and developers without becoming the default vocabulary for small and medium businesses.

### Remaining release sequence

1. Finish and certify AI commercial-control/no-code Ops configuration.
2. Implement one commercial admission orchestrator that acquires credit and every applicable budget reservation before provider invocation and compensates/release safely on partial failure.
3. Run the existing manual-only Gemma 4 / GLM-5.3 Flash / Qwen 3.8 benchmark and retain the JSON artifact.
4. Select the second managed model from benchmark evidence.
5. Bind Workers AI in non-production only and route through the isolated AI Gateway.
6. Prove exact rate-card selection, reservation, actual-usage settlement, idempotency, provider-failure release, timeout/retry behavior, reconciliation, and crash repair.
7. Add the focused `ai.mkety.com` customer console/host routing and central `app.mkety.com` Enterprise AI entry behind the correct entitlement, preserving Public Mkety AI isolation.
8. Add streaming only after accounting invariants hold for streaming/cancellation.
9. Add BYOK after managed inference is stable and tested.
10. Promote production/customer inference only after exact-head CI, migration, smoke, security, commercial, and live acceptance gates pass.

