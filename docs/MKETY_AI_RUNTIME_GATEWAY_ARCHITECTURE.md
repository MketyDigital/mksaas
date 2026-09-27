# Mkety AI Runtime, Gateway & Enterprise AI Architecture

> Status: design foundation
> Branch: `feat/mkety-ai-runtime-gateway-foundation-20260927`
> Date: 2026-09-27
> Governing authority: `AGENTS.md` and `docs/MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md`
>
> This document does not supersede `AGENTS.md`. If there is a conflict, `AGENTS.md` wins until the authority is deliberately updated.

## 1. Product intent

Mkety AI becomes the shared AI runtime and AI API product for Mkety Platform and approved Enterprise / Customer Solutions.

It has three simultaneous roles without collapsing their security boundaries:

1. the inference/runtime layer consumed by the existing Mkety Platform AI Workspace;
2. a developer-facing SaaS/PaaS API that customers can integrate like an OpenAI-compatible model provider;
3. an Enterprise AI-instance product for branded assistants, customer domains, messaging channels, private/BYOK providers, and managed deployments.

Mkety remains broader than AI. Mkety AI is a major Platform capability and enterprise service, not a replacement for the Platform, Academy, Trading, Mail, Media, or other Mkety products.

## 2. Domain contract

The existing Mkety domain authority remains intact:

- `mkety.com` — public company/product site.
- `app.mkety.com` — authenticated Mkety Platform.
- `api.mkety.com` — public/platform API boundary.
- `ai.mkety.com` — Mkety AI product console and AI-specific product experience.
- `*.mkety.app` — customer preview/development/managed application hostnames.
- customer custom domains — attached through the approved Cloudflare/custom-hostname path.

Canonical developer API:

```text
https://api.mkety.com/v1/ai
```

OpenAI-compatible examples:

```text
GET  /v1/ai/models
POST /v1/ai/chat/completions
POST /v1/ai/responses
POST /v1/ai/embeddings
```

Future multimodal endpoints may include image and audio operations when the selected model/provider capability actually supports them.

An optional `ai.mkety.com/v1` compatibility alias may be introduced later only if the domain authority is deliberately updated. It is not required for the first release.

## 3. Key product experiences

### 3.1 Mkety AI API

A customer creates a Mkety AI API key and uses it in an application by changing the OpenAI-compatible base URL.

Example conceptual configuration:

```text
Base URL: https://api.mkety.com/v1/ai
API key:  mk_ai_live_...
Model:    mkety/default
```

Keys are tenant/project scoped, stored hashed, shown in full only once, revocable, rotatable, auditable, and optionally restricted by model, endpoint, budget, origin/IP, and environment.

### 3.2 Mkety Platform AI Workspace

The existing Agent Builder, agents, knowledge, tools, model selection, testing, versions, Website AI, supported messaging, run history, and Automation agent action continue to be Platform experiences.

Their provider execution should progressively move behind the shared Mkety AI Runtime rather than each feature directly owning external-provider credentials and provider-specific routing.

### 3.3 Enterprise AI Instance

An Enterprise AI Instance is a customer-owned logical deployment/configuration, not necessarily a dedicated compute process.

It may include:

- customer name, brand and assistant identity;
- custom instructions and behavior;
- tenant/project knowledge;
- tools and business APIs;
- one or more approved model routes;
- Mkety-managed inference, BYOK, private/self-hosted model routes, or hybrid routing;
- web assistant/widget;
- Telegram bot/assistant;
- supported WhatsApp, Messenger, Instagram or other social messaging integrations where provider APIs permit;
- Slack, Discord, Microsoft Teams or other approved collaboration channels;
- API access;
- human handoff/escalation;
- analytics, traces, feedback and audit history;
- custom domain or `{customer}.mkety.app`;
- optional dedicated/private infrastructure and SLA through Enterprise terms.

## 4. Runtime architecture

```text
Client / Agent / Enterprise Channel
             |
             v
      Mkety AI Edge API
             |
      Auth / tenant / key
             |
   Entitlement + budget gate
             |
        Policy Router
      /       |        \
     /        |         \
Mkety-paid   BYOK     Private/Self-hosted
providers   providers      providers
     \        |          /
      \       |         /
       Cloudflare AI Gateway
       / routing / logs /
      / limits / fallback
             |
          Model
             |
      normalized result
             |
       Usage + cost event
             |
      Credits / Billing
             |
      Run / audit record
```

Mkety owns the customer-facing contract. Cloudflare remains infrastructure behind the Mkety abstraction.

## 5. Provider modes

Every model route has an explicit commercial/provider mode.

### 5.1 MKETY_MANAGED

Mkety owns the upstream provider credential and pays the upstream inference charge.

Requirements:

- only approved models;
- server-side effective-dated rate card;
- pre-call budget/credit authorization;
- max input/output constraints;
- usage reconciliation after the call;
- hard tenant/project/key limits;
- no unlimited plan whose economics depend on variable third-party inference.

### 5.2 CUSTOMER_BYOK

The customer supplies the provider credential.

Requirements:

- secret never returned after initial submission;
- prefer Cloudflare AI Gateway/Secrets Store or an equivalent Mkety-controlled encrypted secret reference;
- no plaintext provider secret in normal application tables or logs;
- BYOK-only routing must fail closed rather than silently falling back to a Mkety-paid upstream credential;
- Mkety may still charge a platform/gateway/agent/RAG/channel fee because Mkety continues to provide routing, observability, storage, tools, knowledge, runtime and support;
- provider inference itself should not be represented as a Mkety pass-through cost when the customer is paying the provider directly.

### 5.3 ENTERPRISE_PRIVATE

An approved customer/Mkety private model endpoint is registered as a custom provider.

This can support:

- Mkety-operated GPU infrastructure;
- customer-operated inference;
- OCI/GPU/VPS/Kubernetes inference;
- vLLM/TGI/Ollama-compatible or other approved HTTPS inference layers;
- an OpenAI-compatible private endpoint.

Private models still have compute, bandwidth and operational cost even where there is no per-token Cloudflare model charge. They must remain metered and capacity-controlled.

### 5.4 HYBRID

An explicit route may use an ordered strategy such as:

```text
private model -> customer BYOK -> Mkety-managed fallback
```

or another approved policy.

Fallback across commercial modes is never implicit. A route must declare whether Mkety-paid fallback is permitted.

## 6. Model abstraction

Expose stable Mkety aliases in addition to provider-native IDs.

Initial aliases should be capability-oriented:

- `mkety/default` — balanced default selected by policy.
- `mkety/fast` — low-latency/economical.
- `mkety/vision` — image-capable model.
- `mkety/reasoning` — reasoning-focused.
- `mkety/private/<deployment>` — approved private model route.

Provider-native IDs may still be available according to entitlement and route policy.

The alias layer protects customers from model deprecations and lets Mkety change the underlying provider/model only under an explicit compatibility policy.

Each model catalog row should describe capabilities such as:

- text input/output;
- image/vision input;
- image output;
- audio input/output;
- embeddings;
- tool/function calling;
- structured output;
- reasoning;
- context/output limits;
- provider;
- lifecycle status;
- commercial mode eligibility.

## 7. Initial Cloudflare model policy

Cloudflare Workers AI is one managed-provider path, not the only provider.

For the initial managed catalog:

- Gemma 4 can be offered as an economical multimodal option where its current Workers AI capability remains available.
- GPT-OSS can be offered for supported text/reasoning/Responses use cases, but should not be labeled as the vision default unless a specific selected GPT-OSS model actually provides vision.
- The second default multimodal route should be selected from the current model catalog based on verified vision, tool calling, context, latency, stability and price at implementation time.
- Model IDs and prices must never be permanently hard-coded into public commercial copy. They belong in a controlled model/rate catalog.

The implementation must revalidate currently available model capabilities and prices before production enablement.

## 8. Cloudflare AI Gateway role

Cloudflare AI Gateway may provide:

- Workers AI access;
- third-party provider routing;
- BYOK key references;
- dynamic routing;
- explicit fallback policy;
- observability;
- caching where safe;
- provider/model analytics;
- rate limiting/budget controls;
- custom providers for approved private/self-hosted HTTPS endpoints.

Mkety still owns:

- customer API keys;
- authentication/authorization;
- tenant/project ownership;
- model aliases/catalog;
- entitlements;
- customer budgets;
- commercial rate cards;
- usage ledger;
- credits/billing;
- Enterprise instance configuration;
- channel integrations;
- security policy;
- customer support and SLA.

Do not expose Cloudflare account tokens, gateway tokens or provider credentials as customer-facing Mkety credentials.

## 9. API-key contract

Follow the proven Mkety Mail API-key pattern rather than inventing a weaker mechanism.

Suggested key prefix:

```text
mk_ai_live_
```

Optional non-production prefix:

```text
mk_ai_test_
```

API-key record fields should include:

- id;
- tenantId;
- projectId where scoped;
- name;
- keyPrefix;
- secretHash;
- environment;
- scopes;
- modelAllowlist/policy reference;
- rateLimitPolicy;
- budgetPolicy;
- allowedOrigins/IP restrictions where configured;
- createdBy;
- createdAt;
- lastUsedAt;
- expiresAt;
- revokedAt.

The plaintext key is shown once and never persisted reversibly.

Initial scopes can include:

- `ai.models.read`;
- `ai.inference`;
- `ai.embeddings`;
- `ai.responses`;
- `ai.instances.invoke`;
- administrative scopes only through the authenticated control plane, not ordinary inference keys.

## 10. Usage, cost and charging

Reuse Mkety Usage/Credits/Billing rather than building a parallel payment system.

Existing meters remain useful:

- `ai.generation`;
- `ai.tokens.input`;
- `ai.tokens.output`;
- `knowledge.ingestion`.

Extend the metering contract as required for:

- request count;
- cached input tokens;
- reasoning tokens when exposed by provider;
- embedding tokens;
- image input/output units;
- audio seconds/units;
- tool executions where billable;
- gateway/routing operations if commercially relevant.

Provider cost and Mkety customer charge are different facts and must not be conflated.

Recommended accounting:

```text
immutable Usage Event
   -> provider usage/cost metadata
   -> effective-dated Mkety rate rule
   -> non-cash credit debit or metered charge
   -> Billing settlement / prepaid balance policy
```

For Mkety-managed variable-cost inference, favor:

- prepaid balance/credits;
- monthly included allowance where commercially useful;
- hard spend ceilings;
- optional controlled overage only for approved customers;
- Enterprise minimum commitment + included usage + metered overage where contracted.

Avoid unlimited variable-cost inference.

Rate versions must be server-owned, immutable once used, and effective-dated so upstream price changes do not rewrite historical usage.

## 11. Cost-safety invariants

Before every billable managed inference:

1. authenticate key/session;
2. resolve authoritative tenant/project;
3. require the correct entitlement;
4. resolve route/model capability;
5. enforce key/model/tenant budgets;
6. enforce max tokens/media limits;
7. authorize/reserve sufficient usage/credits where needed;
8. invoke provider;
9. record normalized provider usage;
10. reconcile final Mkety consumption;
11. persist run/failure metadata without leaking secrets.

Additional safeguards:

- per-minute and per-day key limits;
- tenant/project monthly limits;
- concurrency caps;
- request body size caps;
- timeouts;
- model allowlists;
- abuse/risk controls;
- no automatic expensive fallback unless route policy explicitly permits it;
- idempotency for operations where retries can create duplicated spend;
- circuit breakers for failing providers;
- configurable cache only when tenant/privacy semantics make reuse safe.

## 12. Tenant BYOK and secret isolation

Tenant BYOK is a first-class mode.

A provider connection should contain metadata and a secret reference, not the raw secret in ordinary queryable configuration.

Conceptual record:

```text
ai_provider_connections
- id
- tenant_id
- project_id nullable
- provider
- mode
- secret_ref
- public_config_json
- status
- created_by
- created_at
- rotated_at
- revoked_at
```

Never render stored secret values in Platform Control, AI Workspace, logs, error messages, exports or support tooling.

## 13. Enterprise AI Instances

Conceptual entities:

```text
ai_instances
ai_instance_versions
ai_instance_domains
ai_channels
ai_channel_installations
ai_routes
ai_model_aliases
ai_provider_connections
ai_api_keys
ai_runs
ai_usage_events
ai_budgets
ai_webhooks
ai_audit_logs
```

An instance can reference an existing published Mkety agent instead of duplicating its prompt/knowledge/tool model.

The preferred relationship is:

```text
Agent definition/version
       |
       v
Enterprise AI Instance
       |
       +-- Website
       +-- Telegram
       +-- API
       +-- Supported social/collaboration channel
       +-- Custom domain / *.mkety.app
```

Channel state and secrets remain adapters around one shared runtime rather than separate AI implementations.

## 14. Website/embedded assistant

Support:

- copy/paste script embed;
- React/JS SDK later;
- theme/brand settings;
- domain allowlist;
- signed server integration for sensitive actions;
- optional anonymous conversation;
- authenticated end-user identity supplied through a signed customer assertion;
- human escalation;
- file/image upload only when model and instance policy allow it;
- knowledge citations where available;
- feedback;
- transcript retention policy.

For customers without a domain, a managed instance may use:

```text
https://customer-slug.mkety.app
```

Customer-owned domains use the approved custom-hostname path.

## 15. Messaging/channel adapters

Initial priority:

1. Website/embed.
2. Telegram.
3. API.
4. Webhook/custom channel.
5. Slack/Discord/Teams based on demand.
6. WhatsApp/Messenger/Instagram where official provider/API policy allows.

A channel adapter owns transport concerns only:

- inbound authentication;
- source identity;
- message normalization;
- outbound formatting/delivery;
- provider-specific retry/idempotency.

It must not become a separate AI semantics engine.

## 16. Knowledge and data

Reuse the existing tenant/project knowledge architecture.

An Enterprise instance may attach:

- Mkety knowledge documents;
- website crawl/import;
- uploaded files;
- approved connectors;
- customer APIs/databases through tools rather than indiscriminate ingestion;
- structured FAQ/catalog datasets.

Private tenant knowledge must never leak into Public Mkety AI or another tenant.

Public Mkety AI remains a distinct public-only trust boundary even if it later consumes the common inference transport.

## 17. Relationship to existing Mkety products

### Platform AI Workspace

Becomes a first-party client of the shared Mkety AI Runtime.

The current `getAIProvider()` abstraction should be migrated incrementally. Do not break Agent Builder while the central runtime is introduced.

### Public Mkety AI

Remains public-only and isolated from tenant AI state. It may use the shared low-level inference transport only if private tenant/provider state remains unreachable.

### Automation

Automation agent actions call the same authorized agent runtime. Existing constraints such as disabled tools in bounded Automation execution remain unless separately redesigned and approved.

### Trading

Trading may use Mkety AI for bounded interpretation/presentation/fallback. Trading's deterministic server-side validation and execution authority remain unchanged. AI must never become broker/trade authority.

### MkLMS / Academy / customer LMS

MkLMS can consume Mkety AI for approved white-label tutor, support, course Q&A, content assistance or admin automation while retaining its independent installation/database/storage/security boundaries.

### Mail and Media

Mail/Media may consume AI through supported internal/API contracts, but Mkety AI does not absorb their independent product responsibilities.

## 18. Enterprise isolation modes

Offer multiple deployment/isolation levels rather than pretending every Enterprise customer needs dedicated infrastructure.

### Shared managed

- shared Worker/runtime;
- strict tenant/project isolation;
- customer configuration and secrets separated;
- normal SaaS economics.

### Isolated runtime

- dedicated Worker/service and/or database/secret namespace where required;
- customer domain;
- stronger operational isolation.

### Dedicated/private infrastructure

- dedicated GPU/model endpoint;
- private database/networking;
- regional placement;
- contractual SLA/security requirements;
- Enterprise-only quote.

## 19. Observability

Expose customer-safe operational visibility:

- requests;
- tokens/media units;
- model/alias;
- latency;
- success/failure;
- cached/not cached where relevant;
- cost/credit consumption;
- route/fallback event;
- channel;
- agent/instance;
- project;
- date range.

Internal telemetry may include provider diagnostics but must sanitize secrets and private provider responses.

Enterprise audit history should record configuration changes, key rotation/revocation, model-route changes, domain/channel changes and privileged actions.

## 20. Admin / Platform Control

Platform Control should manage safe metadata/policy such as:

- approved providers;
- model catalog;
- capability flags;
- model lifecycle;
- Mkety-managed rate versions;
- default aliases/routes;
- global circuit breakers;
- Enterprise provisioning state;
- usage/risk visibility.

Do not make raw infrastructure tokens, provider secrets, signing keys or unrestricted execution logic CMS-editable.

## 21. Initial implementation sequence

### Phase AI-00 — authority/design

- this architecture;
- reconcile `AGENTS.md`/commercial source of truth after review;
- define domain/API contract;
- define runtime boundaries and commercial modes.

### Phase AI-01 — API/runtime foundation

- tenant/project API-key schema and hashed-key lifecycle;
- model catalog/capabilities;
- route/policy schema;
- `GET /v1/ai/models`;
- normalized internal inference interface;
- initial OpenAI-compatible `chat/completions`;
- immutable run/usage events;
- entitlement and budget gate;
- tests before provider enablement.

### Phase AI-02 — Cloudflare managed provider

- Workers AI adapter;
- AI Gateway integration;
- managed model catalog;
- exact usage/cost normalization;
- retry/circuit-breaker policy;
- current model/cost verification.

### Phase AI-03 — BYOK

- provider connection UI/API;
- secure secret references;
- Cloudflare BYOK integration where applicable;
- BYOK-only fail-closed routing;
- provider health/test operation;
- per-provider/model allowlists.

### Phase AI-04 — Platform AI migration

- internal Mkety AI runtime client;
- progressively route Agent Builder/test/published agents through it;
- preserve knowledge/tools/versioning;
- preserve existing behavior during migration;
- remove duplicated direct-provider decisions only after parity tests.

### Phase AI-05 — Enterprise instances

- instance/version model;
- managed `*.mkety.app` hostname;
- Website AI channel;
- Telegram channel;
- API channel;
- custom domain provisioning through existing approved domain architecture;
- analytics/audit/handoff.

### Phase AI-06 — private/self-hosted models

- custom provider registration;
- TLS/auth/health checks;
- capacity policy;
- model capability declaration;
- private route aliases;
- Enterprise commercial controls.

### Phase AI-07 — expanded multimodal/connectors

- embeddings;
- image/vision;
- audio;
- approved social/collaboration channels;
- knowledge/connectors;
- richer observability;
- SLA/isolation options.

## 22. Release gates

Do not deploy this design directly to production.

Each phase requires:

- feature branch;
- migrations added rather than historical migrations edited;
- tenant isolation tests;
- auth/API-key tests;
- entitlement tests;
- cost/budget tests;
- provider failure tests;
- no-secret-leak tests;
- Cloudflare candidate validation;
- exact model/cost revalidation before enabling managed models;
- explicit promotion authorization under the repository's normal production controls.

## 23. Decisions to preserve

1. Mkety AI is a shared Platform/Enterprise capability, not a new unrelated architecture authority.
2. `api.mkety.com` remains the canonical API boundary.
3. `ai.mkety.com` is the product/console surface.
4. `*.mkety.app` is the default managed customer hostname namespace.
5. Existing AI Workspace remains and becomes a consumer of the shared runtime.
6. Public Mkety AI remains private-data isolated.
7. Trading AI remains non-authoritative for execution.
8. BYOK must fail closed and never silently create Mkety upstream spend.
9. Private/self-hosted models are not assumed to be cost-free; their capacity is still metered.
10. Billing/Entitlements/Usage/Credits remain Mkety-owned shared commercial primitives.
11. Provider/model details remain replaceable behind Mkety model aliases and routing policy.
12. Enterprise dedicated infrastructure is available when justified, not the default for every AI customer.
