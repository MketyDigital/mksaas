# Mkety Central AI Provider Runtime Design

**Date:** 2026-10-05  
**Status:** Draft for review  
**Repository:** `MketyDigital/mksaas`  
**Branch:** `codex/mkety-central-ai-source-design-20261005`

## 1. Purpose

Establish one central Mkety-owned AI provider control plane and runtime for the main Mkety Platform. The central runtime owns provider connections, model catalog and aliases, route policies, provider adapters, fallback rules, operational controls, and normalized execution evidence. Main-platform features call that runtime through scoped internal interfaces instead of independently selecting and holding provider credentials.

This is a design/specification change. It does not enable production inference or mutate Cloudflare configuration. Enterprise managed inference remains disabled until its product, security, billing, and operational gates are met.

## 2. Scope and boundaries

### In scope

The shared provider control plane serves the main Platform’s approved AI consumers, including:

- Public AI features.
- Workspace AI.
- Enterprise AI and the scoped Enterprise AI API.
- Main-platform Agent Builder, automation, knowledge, and other approved AI runtime features.

These consumers share provider infrastructure while retaining their own identity, authorization, data boundaries, entitlements, customer-facing usage rules, budgets, audit records, and product-specific behavior. A consumer must not gain access to another consumer’s data or billing context because it shares the provider runtime.

### Explicitly out of scope

- `customer-apps/assist` and its standalone production runtime, APIs, keys, database, migrations, rates, credits, routing, provider connections, and configuration. Assist stays unchanged and is not a consumer of this work.
- Enabling Enterprise managed inference in production.
- Cloudflare Unified Billing or prepaid Cloudflare credits for frontier models.
- Moving customer data, memory, tools, or product entitlements into the central provider control plane.
- Arbitrary public or private endpoint access without endpoint validation and controlled network egress.

## 3. Product and credential model

The runtime distinguishes two credential ownership modes.

### Mkety-managed provider connections

Mkety configures and owns central provider accounts/connections and their credentials for managed routes. Provider secrets are encrypted at rest, available only to the central runtime, redacted from logs and administrative responses, and rotated/revoked through controlled operations. Consumer applications receive scoped runtime authorization and model aliases, never provider secrets.

The central provider catalog must support:

- Cloudflare Workers AI hosted models.
- Azure AI Foundry and Azure OpenAI.
- AWS Bedrock.
- OpenAI.
- Google Gemini API.
- Google Vertex AI.
- Custom OpenAI-compatible providers.
- Genuine self-hosted model services.

Provider availability and model availability are separate: a provider adapter being supported does not imply that every model, capability, region, or route is enabled for every consumer.

### Customer BYOK

Customer-owned provider connections are optional and limited to product surfaces where the feature is explicitly supported, initially Workspace AI and Enterprise AI/API where applicable. BYOK is opt-in, scoped to the customer/tenant and authorized use, and uses the same central adapter/runtime security controls without transferring ownership of the provider account to Mkety.

A BYOK request must not silently switch to a Mkety-paid managed route after a customer-key failure. Such a switch changes who pays and requires an explicit product policy and customer instruction. BYOK must not bypass tenant authorization, model allowlists, usage records, or data-boundary checks. Public AI and internal platform features use centrally managed routes unless a product requirement explicitly adds customer BYOK.

## 4. Central architecture

The central AI service owns provider connection resolution, model and alias resolution, consumer policy evaluation, provider calls, eligible retries/fallbacks, output normalization, and execution evidence. Main-platform consumers pass a consumer identity, end-user/tenant context as authorized, task or capability, model alias, request limits, and an idempotency key where execution can be retried.

For each call, the runtime must:

1. Authenticate the calling main-platform service and resolve its registered consumer identity.
2. Enforce consumer, tenant, user, entitlement, data, model, capability, and budget policies before provider invocation.
3. Resolve the consumer’s versioned route profile and model alias to an eligible provider connection and model.
4. Apply that route’s timeout, rate, concurrency, retry, fallback, and data-handling policies.
5. Invoke the provider adapter using centrally held or explicitly selected customer-owned credentials.
6. Normalize the response, provider usage, estimated/actual cost evidence, provider request identifiers, and failure classification.
7. Return only the response and metadata allowed to that consumer.
8. Persist or emit an auditable execution record for the owning product’s usage, billing, support, and reconciliation flows.

The provider runtime is shared; product ledgers and customer-facing accounting remain owned by their existing product boundaries. The runtime must carry an immutable consumer and billing-mode label through reservation, attempt, fallback, settlement, and reconciliation records.

## 5. Routing, retries, and fallbacks

Routing is centrally managed through versioned profiles scoped to each consumer and environment. Profiles define permitted aliases, providers/models, capabilities, geographic/data constraints where applicable, spend and token limits, timeouts, retryable errors, fallback order, and rollout state.

Fallback rules are consumer-specific. A route may retry only classified transient failures and only where the request is safe to repeat. Authentication/authorization failures, invalid requests, unsupported capabilities, policy denials, quota exhaustion, and customer BYOK failures fail closed unless an explicit, reviewed product rule says otherwise. Fallback attempts must preserve idempotency, be bounded, and produce an auditable reason and per-attempt usage/cost record. Fallback must never cross from customer-paid BYOK to Mkety-managed spend by default.

Model aliases are stable consumer-facing names; underlying model and provider changes are versioned and observable. Changes that affect capability, data location, spend, or customer billing require the appropriate product review and rollout controls.

## 6. Cloudflare and billing

Workers AI hosted models are an approved central provider and may be called using the standard Workers AI binding and standard Workers AI account billing. The Cloudflare AI Gateway binding/ID is a routing and observability configuration; it does not by itself authorize or require Unified Billing.

Cloudflare Unified Billing and its prepaid AI credits are not to be used for frontier-model procurement. OpenAI, Azure, Bedrock, Gemini, Vertex, custom, and self-hosted routes are called and accounted for through their configured provider connections and direct provider or customer billing arrangements, not through Cloudflare’s prepaid frontier-model billing.

Before any production Cloudflare binding change, verify the exact Worker/environment, binding and Gateway ID, secret/config source, current deployment, standard Workers AI billing behavior, a safe validation path, and rollback procedure. Do not enable Enterprise inference as part of that binding change.

## 7. Real self-hosted provider support

Custom OpenAI-compatible support must distinguish public hosted endpoints from genuinely self-hosted services. A public HTTPS endpoint with a provider API key does not by itself satisfy private/self-hosted support.

The central runtime should support a controlled connection mode for self-hosted models, including endpoint and model configuration, secret handling, health/capability validation, timeouts, bounded response sizes, observability, and explicit network reachability. Private-network services must use an approved private connectivity mechanism or controlled connector. Endpoint registration and request-time routing must prevent SSRF, DNS rebinding, access to cloud metadata or internal control-plane addresses, redirects to prohibited destinations, and unbounded egress. Credentials and request/response data must follow the configured customer/tenant data policy. Network/security design must be validated before production use.

## 8. Consumer-specific requirements

- **Public AI:** Keep its user-facing behavior, moderation/trust checks, tools, memory, and public data policies at the Public AI boundary. It may use central provider routes but must not inherit Workspace/Enterprise BYOK or expose private tenant routes.
- **Workspace AI:** Migrate remaining legacy provider selection to central model aliases and scoped route policy. Preserve workspace policy, data handling, usage accounting, and optional workspace BYOK as separately authorized.
- **Enterprise AI/API:** Keep scoped API-key authentication, Enterprise entitlement and model/capability controls, request idempotency, usage reservation/settlement, and audit requirements. BYOK remains an explicit customer-paid route. Managed inference remains disabled in production until launch gates pass.
- **Agents, automation, knowledge, and other main-platform consumers:** Adopt the registered consumer interface and narrowly scoped capabilities. They must not resolve provider keys or bypass central policy through a legacy provider path.

## 9. Current implementation and gaps

The repository already has a central runtime with model routing and adapters for Workers AI/Cloudflare, OpenAI, Azure OpenAI, Gemini, Vertex, AWS Bedrock, and OpenAI-compatible providers. It can resolve central system-owned provider connections for managed external routes, and it supports explicit provider-connection selection for BYOK in relevant paths.

The main-platform consolidation is incomplete:

- Public AI still has a separate runtime/provider configuration boundary; integration must preserve its trust and data policies.
- Workspace agents support some central provider values, but legacy model/provider paths remain.
- The channel server runtime calls the central runtime without an explicit customer provider connection; its current route is centrally managed rather than customer BYOK.
- The Enterprise API route supports an explicit BYOK connection and idempotency, while managed inference is gated off in production. Its current BYOK path has narrower tool/structured-output behavior that must be made explicit in the product contract.
- Existing product/commercial documentation is inconsistent: some material describes Workers AI as the initial managed provider with frontier vendors through BYOK, while code/runtime supports Mkety system-owned external provider connections. The implementation plan must reconcile product rules and documentation before enabling any corresponding routes.
- OpenAI-compatible public HTTPS support does not alone provide secure private-network self-hosted connectivity.
- Prior read-only production diagnostics found the Workers AI binding `AI` present and `MKETY_AI_GATEWAY_ID` absent in the checked environment. Confirm the current target environment and deployment configuration before any binding operation; do not infer billing mode from the presence or absence of the ID.

These findings define the implementation work; they do not authorize changing production behavior during spec review.

## 10. Security, reliability, and operational controls

- Central secrets are encrypted, least-privilege, redacted, rotatable, and never returned to consumers.
- Consumer service credentials are scoped, revocable, environment-specific, and auditable.
- Tenant and product policy checks happen before any provider call and are revalidated for customer-owned routes.
- Requests and logs minimize sensitive prompt/response content; retention follows product and provider policy.
- Use bounded request size, output size, timeouts, concurrency, retries, and spend.
- Distinguish policy, user, provider, transport, and quota failures for safe retry/fallback decisions.
- Use idempotent reservation and settlement to avoid duplicate charges under retries.
- Record per-attempt route, connection identity (not secret), model, consumer, billing mode, usage, cost basis, outcome, fallback reason, and correlation/idempotency identifiers.
- Add health checks and route disable/circuit-breaker controls that do not leak provider detail to unauthorized consumers.
- Stage route/config changes and support rollback to a prior version.

## 11. Acceptance criteria

1. Approved main-platform consumers use the central provider interface and do not retrieve provider credentials.
2. Consumer/tenant authorization, data isolation, capabilities, accounting, and audit context remain correct for every route.
3. Mkety-managed provider connections cover the approved providers and model capabilities listed in this spec, subject to explicit route enablement.
4. Workspace/Enterprise BYOK is opt-in and scoped; its failure cannot silently create Mkety-managed provider spend.
5. Retries and fallbacks are bounded, idempotent, classified, consumer-specific, and auditable.
6. Usage and cost evidence can be reconciled across every attempt without merging product ledgers or mislabeling BYOK and managed usage.
7. Genuine self-hosted endpoints have controlled private reachability and pass SSRF/egress/security validation.
8. Cloudflare Workers AI uses standard Workers AI billing; no Cloudflare Unified Billing/prepaid frontier-model credits are configured or used.
9. Enterprise managed inference remains off until product, security, billing, and operational launch gates are separately approved.
10. No file, setting, binding, migration, deployment, or runtime behavior under `customer-apps/assist` is changed.

## 12. Delivery and rollout sequence

The implementation plan should sequence work as follows:

1. Reconcile product/commercial policy and route ownership with current docs and code.
2. Define the consumer registry, central credential/connection model, route-profile contract, audit shape, and API boundaries.
3. Close security gaps in private/self-hosted connections and central secret management.
4. Migrate and validate one main-platform consumer at a time, preserving its own entitlements and ledger; remove or block its bypass paths only after parity is demonstrated.
5. Add contract, policy, fallback, idempotency, accounting, security, and consumer-parity verification.
6. Validate in non-production and stage the Workers AI binding/configuration using standard billing.
7. Review production Cloudflare binding and runtime rollout separately, with a checked rollback and without enabling Enterprise managed inference.
8. Consider Enterprise managed inference launch only after acceptance, operational evidence, and separate customer/product approval.

No production provider connection, Cloudflare setting/binding, secret, or Enterprise inference switch is changed by this specification.
