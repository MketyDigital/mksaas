# Assist Owner-Controlled Reasoning and Resilient Operations

**Status:** Proposed design for review
**Scope:** Standalone Mkety Assist only
**Baseline:** `assist-conversation-resilience-20261002` at `8cabb9347fa180a575447f33077d176ab62b9ab3`

## Intent and constraints

Assist already serves live enterprise customers. This change must extend the running product without replacing its conversation, routing, media, or accounting paths. The purchaser and operator of an Assist tenant is the business owner. A person chatting with that business is an end user: they do not choose the model/reasoning level and do not receive a separate Mkredit charge. The tenant owner chooses the desired capability and pays the resulting usage from that tenant's MKredit balance.

Success means a business owner can select a supported reasoning level for an assistant; the configured provider chain uses the strongest requested level that its targets actually support and bills only the tenant owner at configured rates; operators can manage and pause provider/model routes without losing fallback options; image and voice routes remain usable when a configured provider is unavailable; and uncertain provider outcomes can be reconciled without duplicate inference or silently shifting provider cost to the customer.

Existing prompt, knowledge, memory, history, image, voice, ordered routing, BYOK, reservation, and settlement behavior must remain compatible. Existing assistant configurations retain their current behavior until an owner changes the new setting. No parallel model registry, billing ledger, or end-user reasoning API is introduced. Paid inference remains fail-closed when tenant scope, current rates, eligibility, or reservation cannot be verified.

## Existing foundations and gaps

- Assistant instructions, retrieved knowledge, memory, and recent conversation history are already assembled into the reply context. Reasoning effort is currently selected internally; assistant configuration does not persist an owner-selected reasoning tier.
- Operators already maintain ordered model targets, providers, model IDs, validated connections, per-target MKredit/provider cost rates, BYOK policy, runtime limits, and enabled state. Workers AI, external frontier providers, and supported OpenAI-compatible endpoints are represented through this route system. Route status and target enablement exist in the API, though the operator UI does not expose a clear global model pause/readiness workflow.
- Image and voice have separate aliases and ordered fallback targets, and their provider usage is settled independently. Tenant feature policy can disable either feature. There is no end-to-end route readiness indicator or acceptance gate proving at least one usable target for each enabled media capability.
- Durable Object attempt journaling and idempotent D1 settlement protect against duplicate provider calls/charges. Unknown outcomes are intentionally held; there is no operator workflow to inspect and resolve them.
- Conversation/configuration caches and durable inbound work already reduce repeated reads and provide some recovery. They cannot replace authoritative credit reservation or settlement during a D1 outage.

## Recommended design

### 1. Owner-selected reasoning on the existing assistant settings

Add an assistant-level reasoning preference with compatibility default `standard` and selectable `high` and `maximum` tiers. `standard` retains today's complexity-aware selection. `high` and `maximum` are explicit owner choices that override that default selection for every request; simple-looking wording must not silently downgrade them. Add a separate owner setting `reasoning_fallback_policy` with `allow_lower_effort` as the continuity-first default and `strict` as an opt-in exact-tier requirement. The owner UI explains that lower effort is only used when no eligible target can honor the selected tier; diagnostics record the requested and applied tiers. This is a visible owner policy choice rather than a silent downgrade. The preference and policy are edited only in the authenticated business owner's assistant settings and versioned with the rest of assistant configuration. They are not accepted from chat users, inbound webhooks, Telegram messages, or end-user API request bodies.

At invocation, combine the owner preference with provider/model capability metadata. `high` requests the strongest normal reasoning effort supported by the selected target. `maximum` requests the provider's highest supported effort and strongest configured reasoning model. If the provider exposes no reasoning control, the route may use its strongest configured model but must not claim that a higher effort was applied. Fallback is evaluated per target, so effort is translated to each target's supported API shape rather than blindly copied across providers. Try the selected tier across the enabled chain first. Under `allow_lower_effort`, if no eligible target can honor it, try the next supported tier in order (`maximum` → `high` → existing adaptive `standard`, or `high` → existing adaptive `standard`); under `strict`, fail closed with a clear owner-facing configuration error. Never repeat an attempt with an ambiguous provider outcome just to change tiers. Record requested/applied tier for owner diagnostics. Business instructions and available knowledge remain part of the same conversation context and continue to govern the answer.

Keep completion limits independent from reasoning choice. Preserve the current response-token defaults and safety caps; do not mistake prompt length or a 256-token acceptance probe for the production response limit. Include actual usage returned by each provider in settlement where available. Apply existing output rates to reasoning tokens when the provider bills them as output; add explicit per-target pricing metadata when a provider bills reasoning separately. High/max choices may only be enabled for a route when the applicable rate card is configured; if reasoning usage has a separate provider charge that cannot be measured or safely covered by a configured rate, fail closed for that tier rather than silently undercharge.

### 2. Extend the existing operator model controls

Retain `model_route_targets`, aliases, validated provider connections, per-target pricing, ordered deterministic fallback, and customer overrides. Add an explicit operator-facing pause/resume state and route readiness indicators using the existing route configuration. Pausing one provider/model target removes it from dispatch while preserving the rest of the ordered chain; pausing an alias blocks that alias deliberately. The UI must make the effect and remaining enabled fallback count visible, and must prevent an accidental save that leaves a required production route without any eligible target unless the operator intentionally pauses the whole alias.

Expose supported reasoning capabilities and missing rate configuration per target in the existing operator surface. Support the already registered providers and compatible self-hosted endpoints; a target is considered eligible only if its connection is active/validated, the provider/model adapter supports the requested call shape, and its usage pricing is configured. Do not introduce provider-specific credentials or configuration into customer-facing settings.

### 3. Protect media capability through route readiness

Keep existing image and voice aliases, feature policy, media preprocessing, provider fallback, and independent settlement intact. Add readiness visibility and checks that distinguish a tenant feature being disabled by policy from an enabled feature whose route has no usable target. For active production configuration, image and voice routes should each have at least one enabled, validated, priced target and a configured fallback when available. Operator changes may intentionally pause a media alias, but this must be visible and must not silently disable unrelated text replies. Acceptance checks must cover both image and voice dispatch/fallback/settlement.

### 4. Add durable, auditable unknown-outcome reconciliation

Continue using the per-assistant settlement journal as the attempt authority and D1 reservations/settlements as the credit ledger. Add a D1 projection/index of unresolved attempts written before or alongside provider dispatch and updated idempotently as journal state changes, so operators can list work that needs reconciliation without attempting to enumerate Durable Object instances. Add a scoped operator view and API that reveal safe diagnostic fields (attempt, provider/model, timestamps, reservation, reported usage/cost when known, retry state) but never prompts, secrets, or full user content.

Resolution actions must be authenticated, audited, reasoned, scoped to the owning tenant/assistant, and idempotent. Supported outcomes are: confirm no provider submission and release the reservation; recover a provider result/usage and settle/deliver it; or record a provider charge with no recoverable answer and settle the evidenced charge while returning a safe retry path for a new user request. If provider charge cannot be determined, keep the attempt quarantined for further review; do not automatically release funds, regenerate the same attempt, or invent a usage amount. If a charge must be absorbed by Mkety, that must be an explicit auditable operator resolution using a distinct internal adjustment, not a hidden customer refund or inferred rate.

Reconciliation records must survive transient D1 or Durable Object errors. A periodic retry/reconciliation mechanism may repair projection drift from journaled attempt IDs already indexed in D1. It must use bounded retries/backoff and never dispatch inference as part of accounting repair.

### 5. Outage and cost behavior

Use existing caches for non-authoritative reads and existing durable inbound job mechanisms to retry recoverable work. Cached assistant prompts, route preferences, and knowledge may be used only within documented version/TTL bounds; cache cannot authorize spending. If D1 is unavailable or the reservation/rate cannot be verified, do not issue a billable provider call. If a provider may have received a request, retain its reservation and reconciliation marker until the outcome is resolved. Fallback calls are individually tracked and settled against the provider/model that actually answered; avoid retries after an ambiguous submission.

Add configurable but bounded retry/backoff for infrastructure faults, request-size-aware context budgets, and per-tier output/reasoning ceilings derived from provider capabilities and available MKredits. The default `standard` tier avoids needlessly using maximum reasoning for simple tasks; explicit `high` and `maximum` owner selections are honored for every request. Never silently downgrade an owner's selected tier; if a fallback cannot honor the selection, skip it and expose the applied capability in internal diagnostics.

## Data and API compatibility

- Add an assistant-level preference using a schema migration and safe default so existing tenants keep current behavior.
- Add the separate owner-controlled fallback policy with the compatibility/continuity default `allow_lower_effort`; preserve it through settings, version snapshots, and rollback.
- Include the preference in assistant read/update responses, owner UI, config snapshots, rollback, and assistant version history.
- Add provider capability/rate metadata only to existing route/target configuration surfaces. Existing route records and integrations remain valid.
- Add unresolved-attempt index/projection and immutable resolution audit records. Do not store prompt or response bodies in the operator reconciliation projection.
- Scope every owner-visible setting by authenticated customer and assistant. Scope every operator action by existing operator authorization, tenant, assistant, and attempt identities.
- Preserve current public webhook and end-user interfaces; no new end-user tier selector or MKredit billing surface.

## Deployment and rollout

Keep the migration additive, use compatibility defaults, and deploy runtime support before relying on new operator configuration. Seed no tenant-specific preference or price changes. Verify existing active enterprise assistants and route order before and after migration. Publish the owner setting only after provider capability/rate validation is available. Enable reconciliation UI only after projection backfill/indexing and access-control checks pass. Do not globally pause, reorder, or replace any current live model or media route as part of rollout.

Push the feature branch and wait for exact-head CI. Apply the Assist migration to production through the repository's established guarded workflow, deploy the standalone Assist Worker, then run production health and controlled acceptance checks for text, image, voice, reasoning tiers, credit settlement, fallback, and operator reconciliation. Roll back by disabling the new UI/setting and restoring the previous deployment; keep additive schema and ledger history intact. Do not claim production success until exact deployed SHA and live acceptance evidence are verified.

## Acceptance criteria

1. Existing assistants with no new setting produce the current behavior and retain prompt, knowledge, memory, context, output sizing, and channel behavior.
2. Only an authenticated tenant owner can change the assistant reasoning preference/fallback policy; end users cannot raise model effort or charge the owner through message content/API parameters.
3. Standard/high/maximum are translated only to supported model capabilities; unavailable capabilities or missing applicable rates use the owner's fallback policy and fail closed where billing would be unsafe.
4. Fallback target order remains deterministic, disabled/paused targets are skipped, and every attempted/submitted target has idempotent attempt and correct per-provider settlement behavior.
5. Operator can pause/resume a target or alias, see route readiness, and identify whether at least one valid target remains. No routine edit changes the existing live route ordering or disables active enterprise customers.
6. Image and voice remain independently routed and metered; their acceptance tests cover successful primary calls, fallback, and no-duplicate settlement.
7. Unknown outcomes appear in a tenant-scoped, auditable operator reconciliation workflow. Replaying a resolution has no duplicate credit/cost effect; unresolved/ambiguous cases remain held and do not trigger duplicate inference.
8. D1 reservation/rate failure prevents paid dispatch. Recoverable queue/cache paths do not bypass authoritative billing checks.
9. Migration, type check, unit tests, operator UI checks, security isolation checks, production acceptance checks, and conversation-quality checks pass; exact-head CI and post-deploy smoke/acceptance pass before claiming release success.

## Explicit non-goals

- Replacing the existing Assist runtime, prompt assembler, knowledge system, cache, queue, model aliases, pricing tables, ledger, or media adapters.
- Giving chat end users a model/reasoning selector, business account, MKredit balance, or inference invoice.
- Falling back to a lower tier without the configured owner policy or without recording requested/applied tiers.
- Guaranteeing provider uptime or inventing unsupported model reasoning controls.
- Continuing a paid provider call without verified reservation during database failure.
- Automatically charging an unverified estimate or automatically releasing an ambiguous provider-cost reservation.
- Changing current tenants' model aliases, provider ordering, business prompts, context budgets, credits, or feature policy defaults as a side effect of deployment.
