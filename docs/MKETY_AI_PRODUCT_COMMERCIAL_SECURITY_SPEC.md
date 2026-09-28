# Mkety AI Product, Commercial, Security & Operations Specification

> Status: proposed product/commercial specification
> Date: 2026-09-27
> Branch: `feat/mkety-ai-runtime-gateway-foundation-20260927`
> Governing authority: `AGENTS.md`, `docs/MKETY_PRODUCT_COMMERCIAL_SOURCE_OF_TRUTH.md`, `docs/MKETY_SHARED_PAYMENTS.md`, `docs/ROLES_AND_PERMISSIONS.md`, and `docs/MKETY_AI_RUNTIME_GATEWAY_ARCHITECTURE.md`.
>
> This document is additive. Where it conflicts with an existing authority, the existing authority wins until deliberately reconciled.

## 1. Product definition

Mkety AI is one central multi-tenant AI platform with four first-class consumption surfaces:

1. **First-party Mkety runtime** — Public Mkety AI, AI Workspace, Automation AI operations and approved Mkety products.
2. **Mkety AI Workspace** — self-service agent/application builder for normal Mkety Platform customers.
3. **Mkety AI API/PaaS** — OpenAI-compatible and Mkety-native developer APIs.
4. **Mkety AI Enterprise** — managed, white-label, multi-channel AI for businesses.

Dedicated per-customer AI infrastructure is an exception, not the default. A normal Enterprise "AI instance" is a logical tenant configuration on the central service.

## 1.1 Product packaging boundary — Workspace vs Enterprise Add-on

The existing **AI Workspace** and the new **Enterprise Mkety AI** are related but commercially distinct products.

- **AI Workspace ($16.99/month today)** remains the normal self-service Mkety Platform workspace for agents, knowledge, tools, model choice, Website AI, supported messaging integrations, API access, histories, testing and team collaboration.
- **Enterprise Mkety AI** is a separately entitled paid product/add-on/workspace for organizations that need managed customer-facing AI infrastructure: branded assistants, production channels, custom domains, operator handoff, tenant-wide controls, enterprise analytics, advanced security, higher limits, committed usage, private routing, SLA or custom integrations.
- Buying AI Workspace must **not** silently grant Enterprise AI.
- Buying Enterprise AI may depend on a base Mkety tenant/account, but its entitlement, commercial terms, limits, usage pools and overage behavior are separate.
- Enterprise AI should appear in central Mkety as an enabled product/workspace/add-on, while `ai.mkety.com` remains its focused console/control surface.
- A tenant may own both AI Workspace and Enterprise AI and reuse approved agents/knowledge/configuration through explicit linkage rather than duplicated membership/billing systems.
- The same central runtime can serve both without collapsing their product entitlements.

The product relationship should mirror the future **Media ↔ central Mkety** integration pattern:

```text
Central Mkety
  tenant / identity / PBAC / billing / entitlements
        |
        +-- AI Workspace entitlement
        |      -> normal Platform AI experience
        |
        +-- Enterprise AI add-on entitlement
        |      -> ai.mkety.com enterprise console
        |      -> channels / domains / usage / support / SLA
        |
        +-- Future Media add-on entitlement
               -> media.mkety.com / isolated Media runtime
```

Enterprise AI and Media can therefore be surfaced as first-class products in the central Mkety catalog and enabled for normal Mkety tenants without physically folding all operational storage/runtime into the core app.

## 2. Customer hierarchy and team collaboration

Reuse the existing Mkety tenant membership, invitation and PBAC system.

Hierarchy:

```text
Tenant / Organization
  ├── Owners / Admins
  ├── Billing administrators
  ├── AI administrators
  ├── AI builders
  ├── Knowledge managers
  ├── Channel managers
  ├── Developers
  ├── Analysts / Auditors
  └── Support operators
       |
       +-- Projects
            |
            +-- Agents / AI applications
            +-- API keys
            +-- Knowledge
            +-- Provider connections
            +-- Channels
            +-- Domains
```

A member may have multiple roles. Effective authorization is the union of database-resolved permissions.

### 2.1 Proposed AI permissions

Add permission keys such as:

- `ai:dashboard`
- `ai:agents:read`
- `ai:agents:write`
- `ai:agents:publish`
- `ai:knowledge:read`
- `ai:knowledge:write`
- `ai:tools:read`
- `ai:tools:write`
- `ai:providers:read`
- `ai:providers:write`
- `ai:api_keys:read`
- `ai:api_keys:write`
- `ai:channels:read`
- `ai:channels:write`
- `ai:domains:read`
- `ai:domains:write`
- `ai:usage:read`
- `ai:billing:read`
- `ai:billing:manage`
- `ai:audit:read`
- `ai:security:manage`
- `ai:enterprise:manage`

Do not rely on UI role labels for authorization. Server/API checks remain database-backed.

### 2.2 Suggested system roles

These are convenience bundles, not authorization shortcuts:

- **Owner** — all tenant permissions, ownership transfer, billing authority.
- **AI Admin** — all AI configuration except tenant ownership/payment secrets.
- **Builder** — agents, prompts, tools, knowledge and testing.
- **Developer** — API keys, webhooks, SDK/app integrations, logs.
- **Knowledge Manager** — knowledge sources, documents, indexing and retrieval configuration.
- **Channel Manager** — website, Telegram, social/collaboration channel configuration.
- **Analyst/Auditor** — read-only runs, usage, quality, audit and analytics.
- **Support Operator** — conversation/handoff queues only.
- **Billing Admin** — plan, usage, credits, overage, invoices/receipts and payment methods.

Customers may create custom roles using the existing PBAC capability.

## 3. Product surfaces

### 3.1 AI Console — `ai.mkety.com`

Recommended navigation:

- Overview
- Playground
- Agents / Applications
- Knowledge
- Tools / Actions
- Models
- Providers / BYOK
- API Keys
- Channels
- Domains
- Conversations / Human Handoff
- Runs / Traces
- Usage / Costs
- Budgets / Limits
- Team / Roles
- Security
- Webhooks
- Billing
- Audit
- Developer Docs

The console must adapt to entitlements: normal Workspace customers see only relevant capabilities; Enterprise and developer customers see advanced controls.

### 3.2 Developer API

Canonical base URL remains:

```text
https://api.mkety.com/v1/ai
```

Initial compatibility:

- `GET /models`
- `POST /chat/completions`
- `POST /responses`
- `POST /embeddings`
- streaming
- usage in response
- request IDs
- idempotency support where useful
- structured errors
- rate-limit headers
- budget/credit errors that are distinct from provider failures

Later:

- image generation/editing where supported
- speech-to-text / text-to-speech
- batch
- files
- reranking
- realtime/streaming voice where commercially justified

### 3.3 Enterprise managed AI

A customer configuration may include:

- brand/name/avatar/theme
- system behavior/instructions
- model route
- knowledge
- tools/actions
- website widget
- hosted `customer.mkety.app` page
- custom domain
- Telegram
- WhatsApp/Messenger/Instagram where official APIs permit
- Slack/Discord/Teams
- webhook/custom channel
- API
- CRM/helpdesk integrations
- human handoff
- operator inbox
- conversation history
- feedback
- analytics
- usage budgets
- retention policy
- security policy
- audit trail
- customer team/RBAC

### 3.4 Enterprise demo/trial

Enterprise demos use the same central runtime but a restricted demo policy.

Default demo policy should be configurable and may include:

- one demo AI configuration;
- one managed `*.mkety.app` preview;
- one website widget;
- optional Telegram test bot;
- small knowledge allowance;
- low-cost managed model route;
- hard conversation/request/token/credit cap;
- no automatic paid fallback;
- no unrestricted tool/action execution;
- short expiry;
- optional domain allowlist;
- demo watermark/branding if desired;
- conversion button/contact path;
- automatic suspension at expiry or quota exhaustion.

Sales/admin may issue a one-time demo allowance through audited credit grants. Do not create a new real-money wallet for demos.

## 4. Provider architecture

Supported provider modes:

### 4.1 Mkety Managed

Mkety pays upstream inference and charges customer usage according to the Mkety rate card.

Initial managed models should be intentionally small in number and expandable.

**Day-one managed-provider policy:**

- Cloudflare Workers AI hosted open models only for Mkety-managed inference.
- Initial routes: `@cf/google/gemma-4-26b-a4b-it` and `@cf/qwen/qwen3.8-27b`.
- Third-party frontier models are **not** to be purchased through Cloudflare Unified Billing/prepaid AI Gateway credits as a normal Mkety-managed route.
- OpenAI, Anthropic, Gemini, xAI and similar third-party providers are supported through **customer BYOK** where enabled.
- Mkety may later operate its own private/self-hosted model endpoint on OCI, AWS, Azure or another approved GPU platform.
- Additional Workers AI open models may be added through the controlled model catalog after cost/capability review.
- Cloudflare Workers AI billing should use standard Workers AI billing unless an explicit future architecture decision changes it; do not silently switch the gateway to prepaid Unified Billing.

Expose stable aliases:

- `mkety/default`
- `mkety/fast`
- `mkety/vision`
- `mkety/reasoning`
- `mkety/private/<deployment>`

### 4.1.1 Day-one Workers AI cost baseline — verified 2026-09-27

Current Cloudflare Workers AI published unit pricing:

| Model | Input | Output | Cached input | Primary role |
| --- | ---: | ---: | ---: | --- |
| `@cf/google/gemma-4-26b-a4b-it` | $0.10 / 1M tokens | $0.30 / 1M tokens | not separately listed | economical default / vision / tools |
| `@cf/qwen/qwen3.8-27b` | $0.45 / 1M tokens | $3.20 / 1M tokens | $0.05 / 1M tokens | higher-capability reasoning / vision / tools |

Cloudflare currently meters Workers AI in neurons internally and publishes equivalent per-model token pricing. The account receives a 10,000-neuron daily free allocation; usage above that allocation on Workers Paid is billed at the model's published unit economics. The free allocation is an infrastructure benefit and must never be promised as a customer entitlement.

Illustrative raw upstream cost, excluding Worker requests, storage, Gateway, retrieval, tools, payment fees and Mkety margin:

| Workload example | Tokens | Gemma 4 raw cost | Qwen 3.8 raw cost |
| --- | --- | ---: | ---: |
| Light chat | 1,000 in / 300 out | ~$0.00019 | ~$0.00141 |
| Normal chat | 2,000 in / 500 out | ~$0.00035 | ~$0.00250 |
| RAG-style answer | 5,000 in / 800 out | ~$0.00074 | ~$0.00481 |
| Heavy agent turn | 10,000 in / 2,000 out | ~$0.00160 | ~$0.01090 |

For 1,000 "normal chat" turns at the example size, raw model inference is approximately $0.35 on Gemma 4 versus $2.50 on Qwen 3.8 before all other Mkety costs.

Commercial consequences:

- `mkety/default` should initially prefer Gemma 4 for ordinary workloads unless evaluation quality says otherwise.
- Qwen 3.8 should be a higher-capability route rather than the universal default because its output cost is materially higher.
- model aliases and policy routing should decide whether a request truly needs Qwen;
- Enterprise and API rate cards should price against measured blended workloads, not merely multiply provider token rates;
- image/vision inputs, long contexts, reasoning behavior and agent tool loops must be benchmarked before publishing final credit conversion.

### 4.1.2 Provisional Mkety managed-inference rate floor

Use an internal target gross-margin floor of approximately **65% before non-model operating costs**, which is roughly a 3x multiplier on raw model inference. This is a planning floor, not yet approved public pricing.

Provisional managed-inference reference:

| Model | Raw input / 1M | Raw output / 1M | Provisional Mkety input / 1M | Provisional Mkety output / 1M |
| --- | ---: | ---: | ---: | ---: |
| Gemma 4 | $0.10 | $0.30 | $0.30 | $0.90 |
| Qwen 3.8 27B | $0.45 | $3.20 | $1.35 | $9.60 |

Qwen cached input raw pricing is $0.05/M; a provisional 3x reference would be $0.15/M cached input.

At the illustrative 2,000-input/500-output "normal chat" workload:

- Gemma raw ~= $0.00035; provisional managed inference ~= $0.00105 per turn, or ~= $1.05 per 1,000 turns.
- Qwen raw ~= $0.00250; provisional managed inference ~= $0.00750 per turn, or ~= $7.50 per 1,000 turns.

This inference rate is **not the whole Enterprise price**. Enterprise pricing must recover and monetize:

- central runtime/Worker operations;
- knowledge ingestion/vector/search/storage;
- file/R2/storage;
- channel delivery;
- tool/API execution;
- observability/log retention;
- human handoff/operator inbox;
- domains/branding;
- support/SLA;
- implementation and integrations;
- payment fees/tax/FX exposure;
- abuse/fraud reserve;
- future provider price changes.

Before public launch, benchmark real p50/p95 workloads and either confirm or raise these floors. Never automatically reduce an effective-dated customer rate because an upstream provider temporarily discounts its model.

For BYOK, do not apply a fake provider-token markup. Recover Mkety value through the subscription/platform fee and any explicitly priced Mkety-owned operations (RAG, storage, channels, tools, runs, observability, etc.).

### 4.2 Customer BYOK

Customer supplies provider credentials.

Requirements:

- provider secret stored only in an approved secret store/reference;
- never returned after creation;
- key rotation and revoke;
- provider connection health test;
- BYOK-only policy can fail closed;
- no silent transition to Mkety-paid inference;
- customer can select allowed models;
- customer can set provider spend/rate limits where supported;
- Mkety still meters platform operations.

### 4.3 Mkety private/self-hosted

Register an authenticated HTTPS/OpenAI-compatible inference endpoint hosted on OCI, AWS, Azure, dedicated GPU host or other approved infrastructure.

The Mkety public API contract must not change when the backing route changes from Workers AI to a private endpoint.

### 4.4 Hybrid

Explicit route policy, for example:

```text
Mkety private -> customer BYOK -> Mkety managed
```

Cross-commercial-mode fallback is opt-in and budget-aware.

## 5. Routing behavior

The Mkety policy layer owns the final route decision.

Supported routing policies should eventually include:

- fixed model;
- alias-based model;
- fastest eligible route;
- lowest estimated cost;
- capability-based routing;
- geography/data-policy routing;
- model/provider health;
- tenant plan;
- budget remaining;
- token/context requirement;
- modality requirement;
- A/B percentage rollout;
- canary rollout;
- customer preference;
- provider affinity;
- private-first;
- BYOK-first;
- managed-only;
- no-fallback mode.

Every fallback is recorded with route, provider and reason.

## 6. Plans and commercial model

### 6.1 Principle

Do not sell unlimited variable-cost managed inference.

Use a hybrid commercial structure:

```text
subscription/platform fee
+ included AI credits/allowance
+ metered usage or prepaid top-up
+ optional channel/storage/add-on usage
+ optional Enterprise implementation/support
```

Provider cost and customer charge are separate immutable facts.

## 6.0 Commercial packaging authority

Commercially, treat Enterprise Mkety AI as a **separate add-on/workspace subscription**, not as an automatic benefit of the normal AI Workspace plan.

Recommended structure:

```text
Existing Mkety Platform subscription (optional/base)
        +
Enterprise AI platform/add-on subscription
        +
included Enterprise AI allowance
        +
metered usage / prepaid top-ups / contracted overage
        +
optional paid add-ons
        +
one-time implementation/integration fees where applicable
```

Possible Enterprise AI package dimensions include:

- number of production assistants/applications;
- number of channels;
- custom domains;
- monthly conversation allowance;
- managed-inference credit allowance;
- knowledge/storage quota;
- operator/handoff seats;
- API projects/service accounts;
- retention/audit window;
- support/SLA level;
- BYOK eligibility;
- private/self-hosted routing eligibility;
- regional/dedicated infrastructure.

The normal AI Workspace subscription keeps its current price/behavior unless deliberately changed. Enterprise AI gets its own product entitlement(s), plan/version/rate-card configuration and billing line item.

### 6.0.1 Payments

Enterprise AI uses the existing Mkety shared payment boundary only:

- NOWPayments — primary/default crypto path;
- Flutterwave v3 — supported Mkety-owned/central compatible path;
- Kora Checkout Standard — supported provider-controlled checkout path.

Browser return/UI success is never proof of payment. Settlement must follow the existing verified webhook/re-query/idempotent Billing/Enterprise ledger rules.

Enterprise invoices/contracts may also be represented through existing Billing/Enterprise settlement primitives where supported. Do not build a second payment subsystem inside AI.

### 6.0.2 Usage and allowance

Each Enterprise plan/version may define one or more included allowances such as:

- conversations;
- AI requests;
- input/output tokens;
- managed AI credits;
- RAG/retrieval operations;
- knowledge ingestion;
- storage;
- tool/action executions;
- automation/workflow runs;
- channel deliveries;
- operator seats;
- API rate/concurrency capacity.

Customer-facing packaging can emphasize **conversations/credits/capacity** while internal accounting still records the precise underlying token/provider usage and cost.

### 6.0.3 Limits

Enterprise limits are layered, not singular:

1. entitlement limit;
2. plan/version allowance;
3. tenant/project/key budget;
4. customer-configured safety limit;
5. Mkety infrastructure/provider limit.

The strictest applicable limit wins.

Configurable limits include:

- RPM/TPM;
- concurrency;
- daily/monthly request ceilings;
- input/context/output token caps;
- file/document sizes;
- knowledge/storage quota;
- channel count;
- assistant/application count;
- API-key/project count;
- tool steps and run duration;
- daily/monthly managed-spend ceiling;
- retention days.

### 6.0.4 Overage behavior

Every Enterprise tenant must have an explicit overage mode:

- **Hard stop** — safest default for self-service or trial tenants.
- **Prepaid top-up** — consume purchased AI credits after included allowance.
- **Authorized auto top-up** — only where payment-provider/consent mechanics safely support it.
- **BYOK continuation** — provider inference continues on customer key while Mkety-owned platform operations remain subject to Mkety limits/charges.
- **Controlled postpaid overage** — only contracted/approved Enterprise/Business tenants with credit limit and settlement terms.

Usage warnings should be emitted at configurable thresholds such as 50%, 75%, 90% and 100%.

No Enterprise plan should imply unlimited Mkety-paid inference unless backed by a separately priced dedicated-capacity contract.

### 6.0.5 Enterprise add-ons

Optional line items may include:

- extra conversation/credit packs;
- additional production assistants;
- extra channels;
- additional operator seats;
- advanced analytics/audit retention;
- extra knowledge/storage;
- custom domain packs;
- premium support;
- custom integration packs;
- dedicated/private model route;
- dedicated GPU/runtime capacity;
- private networking;
- regional residency;
- custom SLA.

### 6.0.6 Security tiers

All Enterprise AI receives baseline tenant isolation, PBAC, audit, secret protection, rate/budget enforcement and secure API keys.

Higher Enterprise tiers/contracts may additionally enable:

- SSO/SAML/OIDC;
- SCIM;
- IP/CIDR restrictions;
- custom retention/no-content-retention;
- DLP/guardrails;
- private networking;
- dedicated model/runtime;
- regional residency;
- customer-managed encryption where later supported;
- extended audit export;
- stricter approval policies for high-risk tools/actions;
- SLA and incident-response commitments.

Do not advertise compliance certifications that Mkety has not actually achieved.


### 6.2 Preserve and blend the existing Mkety Platform/Public AI implementation

Current Platform and Public AI contracts remain authoritative. This Enterprise/runtime project is an extension and consolidation layer, not a replacement product redesign.

Existing self-service pricing remains:

- Starter — $5.99/month.
- AI Workspace — $16.99/month.
- Automation Workspace — $16.99/month.
- Deploy Workspace — $9.99/month.
- Mkety One — $49/month.
- Enterprise — Custom.

Existing AI Workspace positioning remains: Agent Builder, agents/published agents, drafts/versions, model choice, testing, Website AI, supported messaging integrations, API access, tools/actions, knowledge, run/conversation history, usage and team access.

Existing Public Mkety AI remains a public-only assistant with its own memory, public knowledge/tools and hard isolation from tenant/private state. The user sees one Mkety AI and does not choose providers/models.

The central Mkety AI runtime should progressively become the shared low-level inference/control service underneath these existing surfaces while preserving their product boundaries:

```text
Public Mkety AI      -> public-only policy/knowledge -> central inference transport
AI Workspace         -> tenant policy/knowledge/tools -> central runtime
Enterprise           -> tenant managed channels/config -> central runtime
Developer API        -> tenant API key/project policy -> central runtime
```

Do not make Public AI capable of reaching tenant knowledge simply because both eventually share inference transport. Do not remove existing Workspace behavior before parity tests.

AI-specific metering should layer underneath the existing subscriptions rather than replacing them.

The existing fixed subscription term structure remains:

- 1 month: no discount
- 3 months: 5%
- 6 months: 10%
- 12 months: 15%

Those discounts apply to the fixed subscription portion only. Variable provider usage, purchased credit packs and pass-through/overage charges do not automatically receive the term discount.

### 6.3 Proposed Mkety AI commercial families

#### A. AI Workspace

Keep the existing AI Workspace subscription as the normal builder product.

Recommended commercial behavior:

- subscription unlocks builder/agent/knowledge/publishing capabilities;
- includes a modest monthly recurring AI credit allowance;
- unused recurring allowance normally expires at period end unless commercial policy explicitly says otherwise;
- customer may buy top-up credits;
- optional BYOK can continue after included managed credits are exhausted if plan permits;
- usage dashboard always shows included, consumed and remaining allowance.

Do not change the existing public price merely as part of this architecture document.

#### B. AI API / Developer

Recommended structure:

**Developer / Trial**
- no recurring charge or very low entry price;
- tiny one-time or monthly test allowance;
- strict RPM/day/month caps;
- limited managed models;
- BYOK optional only after verified account/anti-abuse controls;
- no production SLA.

**API Pay-as-you-go**
- prepaid Mkety credits;
- OpenAI-compatible API;
- all entitled managed aliases;
- budget controls;
- usage logs;
- top-up/auto-recharge;
- platform margin incorporated through the Mkety rate card.

**API Business**
- optional monthly platform minimum;
- higher limits;
- teams/RBAC;
- service accounts;
- multiple projects;
- audit exports;
- custom routing;
- BYOK;
- priority support.

**API Enterprise**
- contract;
- committed spend/minimum;
- volume rate card;
- SSO/SCIM when implemented;
- SLA;
- higher/dedicated limits;
- private networking/dedicated inference options;
- custom retention/data policy.

#### C. Enterprise managed AI

Price this as a managed software/service product rather than raw tokens alone.

Recommended structure:

```text
one-time implementation/onboarding fee
+ monthly Enterprise platform fee
+ included conversations/AI credits
+ usage above allowance
+ optional paid add-ons
```

The implementation fee can cover setup, knowledge ingestion, integrations, branding, custom workflows and launch support.

Do not hard-code one universal Enterprise price. Enterprise scope can vary dramatically.

### 6.4 Recommended launch pricing policy

Use rate-card-driven amounts rather than putting provider math into code.

A sensible launch structure is:

- **Workspace**: retain existing subscription price; attach included AI credits after economic testing.
- **Developer Trial**: free, tightly capped, no automatic overage.
- **API PAYG**: no long-term contract; customer prepays credits and consumes against Mkety rates.
- **Business API**: monthly platform minimum plus usage.
- **Enterprise**: quote-based setup + monthly minimum + included usage + overage.
- **Dedicated AI infrastructure**: separate Enterprise quote.

Before publishing numeric usage prices, run real prompts against the chosen managed models and calculate p50/p95 cost per normal chat, RAG chat, vision request and agentic request. Set margin and safety reserve from measured data, not token list prices alone.

### 6.5 AI credit model

Reuse the current non-cash Credits subsystem.

An AI credit is an internal consumption unit, not money and not withdrawable.

Rate card maps normalized usage into credits, for example:

```text
model/provider input units
model/provider output units
image units
audio units
embedding units
tool/managed-service units
     -> effective-dated Mkety rate
     -> credits charged
```

Use integers/bigints only.

### 6.6 Recurring allowance vs purchased credits

Keep distinct buckets/policies:

- recurring plan allowance;
- promotional/demo grants;
- purchased top-up credits;
- manual support adjustment;
- Enterprise committed allowance.

Recommended consumption order:

1. expiring promotional/demo grant;
2. expiring recurring plan allowance;
3. purchased non-expiring or longer-lived credits;
4. approved postpaid overage/credit line.

The existing Usage/Credits design currently has one projected balance. Multi-bucket expiration requires a deliberate extension and must not be faked by mutating ledger history.

### 6.7 Overage modes

Each tenant chooses or is assigned one mode:

- **Hard stop** — stop managed inference when allowance/credits end.
- **Auto top-up** — buy a configured credit pack when balance reaches threshold, subject to payment-provider support and explicit customer authorization.
- **Prepaid reserve** — customer manually tops up.
- **Controlled postpaid overage** — Enterprise/approved Business only, with credit limit and invoice/settlement process.
- **BYOK continuation** — managed route stops, but customer-owned provider route can continue if policy permits.

Default for self-service managed AI should be **hard stop**, not debt.

Notify at configurable thresholds such as 50%, 75%, 90%, 100%.

### 6.8 Usage dimensions to meter

At minimum:

- requests/generations;
- input tokens;
- output tokens;
- cached input/output where provider exposes it;
- reasoning tokens where applicable;
- embedding units;
- image input;
- image output;
- audio input seconds;
- audio output seconds;
- transcription;
- tool/action calls if Mkety bears a cost;
- web/search/retrieval operations if cost-bearing;
- knowledge ingestion/indexing;
- vector storage;
- file/object storage;
- conversation count for Enterprise reporting;
- channel messages/delivery if cost-bearing;
- automation/workflow runs;
- webhook deliveries;
- dedicated capacity reservation where applicable.

Do not double-charge one underlying cost accidentally. Metering vocabulary and commercial rate mapping are separate layers.

## 7. Payments

Reuse the shared Mkety payment boundary exactly.

Provider priority:

1. NOWPayments — default/primary crypto.
2. Flutterwave v3.
3. Kora Checkout Standard.
4. manual/contract settlement only where already supported and authorized.

Rules:

- server creates canonical charge/reference;
- browser success never grants AI credits or subscription;
- verify webhook signature;
- server re-query where provider requires it;
- verify status, reference, amount and currency;
- idempotent settlement;
- only after verified settlement may Billing/Usage/Credits grant entitlement or purchased credits;
- no AI subsystem stores provider card credentials.

### 7.1 Auto-recharge

Implement only after the payment provider and consent model support a safe recurring/reusable-payment flow.

Until then:

- threshold alert;
- one-click top-up checkout;
- no invented recurring-card behavior;
- no hidden charge.

Crypto auto-recharge should not be assumed because wallet invoice flows may require a new customer payment each time.

## 8. Security architecture

### 8.1 Tenant isolation

Every AI object is tenant scoped and project scoped where applicable.

Never trust tenant/project IDs from a request body without resolving them against the authenticated key/session.

Cross-tenant cache, logs, knowledge retrieval and provider secrets are prohibited.

### 8.2 Customer API keys

Use hashed Mkety API keys.

Features:

- show plaintext once;
- prefix/environment distinction;
- scoped permissions;
- project restriction;
- model/route allowlist;
- origin allowlist for browser-safe products;
- IP/CIDR allowlist where appropriate;
- expiry;
- manual revoke;
- rotation;
- last-used metadata;
- usage/budget per key;
- service-account ownership;
- audit history.

Do not permit unrestricted secret API keys directly in public browser JavaScript. Use restricted publishable/embed tokens or signed server assertions for browser widgets.

### 8.3 Provider secrets

- encrypted/secret-store reference only;
- never returned after save;
- never included in logs/traces;
- redacted from errors;
- restricted admin access;
- rotation/revoke;
- health checks without exposing the credential.

Because Cloudflare AI Gateway account-scoped Run tokens can reach all gateways in an account, Mkety must not treat a Cloudflare account-level AI Gateway token as a tenant isolation primitive. Tenant isolation remains in the Mkety Worker/control plane.

### 8.4 Prompt/data security

Support configurable:

- prompt injection defenses;
- tool/action permission boundaries;
- URL/domain allowlists for fetch tools;
- outbound egress controls;
- maximum tool steps;
- human approval for sensitive actions;
- structured tool schemas;
- secret redaction;
- DLP policy;
- safety/guardrails policy;
- content-category policy;
- attachment/file validation;
- malware scanning where appropriate;
- PII-sensitive logging modes;
- zero/limited retention modes where supported;
- deletion/export workflows.

Guardrails/DLP are additional controls, not substitutes for application authorization.

### 8.5 Tool security

AI must never obtain arbitrary database/network authority because a prompt asked for it.

Tools are registered capabilities with:

- schema;
- tenant scope;
- allowed agent;
- required user/role;
- approval requirement;
- timeout;
- idempotency;
- retry policy;
- audit;
- safe response size;
- secrets kept server-side.

High-risk actions may require explicit human confirmation.

### 8.6 Abuse prevention

Implement:

- per-IP unauthenticated limits;
- per-key RPM/TPM;
- per-tenant concurrency;
- per-model concurrency;
- daily/monthly spend/credit ceilings;
- signup/demo anti-abuse controls;
- suspicious-volume flags;
- disposable-account mitigation;
- captcha/turnstile where appropriate;
- API anomaly detection;
- denied-country/IP policy only when legally/operationally required;
- automatic key suspension for clear compromise patterns with admin recovery.

## 9. Limits and capacity

Separate four concepts:

1. product entitlement;
2. customer configured budget;
3. Mkety commercial allowance;
4. infrastructure/provider limit.

The effective limit is the strictest applicable limit.

Per plan/customer controls should include:

- requests per minute;
- tokens per minute where measurable;
- concurrent requests;
- max context;
- max output;
- max file size;
- max files/request;
- max image dimensions/count;
- max tool steps;
- max agent run duration;
- daily spend;
- monthly spend;
- project budget;
- API-key budget;
- per-end-user budget for Enterprise;
- storage quota;
- knowledge document count/size;
- retention days.

Return structured 429/402-like domain errors without leaking upstream internals.

## 10. Caching

Caching is a cost optimization, never a tenant-isolation shortcut.

### 10.1 Safe cache key

At minimum include:

- tenant/project;
- agent/version;
- model/route version;
- system instructions hash;
- normalized input;
- relevant tool/knowledge version;
- safety policy version;
- locale where relevant.

### 10.2 Cache eligibility

Default **off** for:

- requests using private user data;
- authenticated account-specific responses;
- tool calls with side effects;
- rapidly changing business data;
- prompts marked no-store;
- sensitive categories;
- streamed conversational context where exact identity matters.

Useful candidates:

- public/static FAQ;
- deterministic classifications;
- repeated public knowledge questions;
- embeddings;
- static summarization where source/version is part of key;
- repeated system boilerplate when provider supports prompt caching.

Support explicit cache controls:

- off;
- exact-request cache;
- provider prompt cache;
- tenant-only semantic cache later;
- TTL;
- purge by agent/knowledge/version.

Never share response cache across tenants unless the input and source are explicitly public and the product has a dedicated public cache namespace.

## 11. Reliability

Implement:

- bounded retries;
- exponential backoff;
- retry only safe/idempotent requests;
- provider/model timeout;
- circuit breaker;
- health scoring;
- explicit fallback chain;
- no fallback across paid modes without policy;
- streaming disconnect handling;
- cancellation;
- request deadline propagation;
- queue/backpressure for expensive operations;
- dead-letter/replay only for safe asynchronous operations;
- provider incident switch;
- route version rollback.

Idempotency keys protect billable non-stream and asynchronous operations from duplicate charging.

### 11.1 Cloudflare state and delivery primitives

Use each Cloudflare primitive for the job it is actually good at. None replaces the authoritative Mkety database/commercial ledger.

**PostgreSQL through the existing Mkety database gateway remains authoritative for:**

- tenant/project ownership;
- API-key records and revocation state;
- Billing subscriptions and settlement;
- Entitlements;
- Usage/Credits and charge idempotency;
- model/route configuration source of truth;
- budgets and approved overage policy;
- durable audit records.

**Workers KV may be used only for read-heavy, safely stale acceleration such as:**

- model catalog snapshots;
- route/config snapshots with short TTL and version keys;
- feature/config flags;
- tenant-safe exact-response cache metadata;
- public/static knowledge cache metadata.

KV is eventually consistent, so it must never be the final authority for revocation, entitlement, balance, budget authorization or duplicate-charge prevention. Sensitive authorization changes must read through to the authoritative store or use a version/invalidation design that fails closed.

**Durable Objects are optional coordination primitives, sharded by a natural boundary rather than globally. Appropriate uses include:**

- per-tenant / per-project / per-key rate windows;
- short-lived in-flight request coordination;
- streaming session coordination where shared state is actually required;
- circuit-breaker/health coordination when strong single-key ordering is useful;
- write serialization before publishing derived cache state.

Do not send every AI request through one global Durable Object. A global object would become a bottleneck and single hot coordination point.

**Workers Cache API / AI Gateway caching may accelerate only cache-eligible requests** under the tenant-safe cache rules above. Authorization, entitlement and budget checks happen before serving any tenant-private cached AI result unless the cached object itself is a deliberately public artifact in a public namespace.

**AI Gateway is the provider-edge control layer** for observability, approved caching, rate controls, bounded retries and explicit model/provider fallback. Mkety's own runtime policy remains authoritative, especially for commercial mode, tenant isolation and whether a fallback is allowed to spend a Mkety-managed credential.

**Cloudflare Queues + DLQ are for asynchronous, replay-safe work**, such as non-interactive indexing, post-response analytics/accounting repair, evaluation jobs and other bounded background operations. A queue must not turn a non-idempotent inference/tool action into an automatic retry loop.

This layering is intended to provide low latency without weakening correctness:

```text
Request
  -> stateless edge validation
  -> authoritative auth / entitlement / budget decision
  -> optional tenant-safe coordination (Durable Object)
  -> versioned read cache where safe (KV / Cache / AI Gateway)
  -> provider route
  -> authoritative usage/accounting write
  -> async replay-safe follow-up through Queue/DLQ where needed
```

A cache or coordination outage should degrade to the authoritative path where safe. An authoritative database/commercial decision outage should fail closed for billable managed inference rather than guess.

## 12. Observability and analytics

Customer-visible:

- requests;
- conversations;
- tokens/media units;
- credits;
- cost/charge;
- model alias;
- actual model/provider where disclosure policy allows;
- latency;
- first-token latency where measurable;
- cache hit;
- retry;
- fallback;
- error class;
- agent/application;
- channel;
- API key;
- project;
- end-user pseudonymous identifier;
- feedback;
- quality signals;
- budget status.

Internal:

- provider cost;
- customer charge;
- gross margin;
- route performance;
- p50/p95/p99 latency;
- capacity;
- error rate;
- safety/DLP events;
- abuse flags;
- provider availability;
- model quality tests.

Export OpenTelemetry where useful.

### 12.1 Privacy-aware logging modes

Offer policy levels:

- standard logs;
- metadata-only;
- prompt/response redacted;
- no prompt/response persistence;
- Enterprise custom retention.

Operational security events and billing usage remain auditable even where content retention is disabled.

## 13. Conversation and human-handoff features

For Enterprise support/assistant use:

- shared operator inbox;
- bot/human ownership;
- transfer to team/queue;
- priority;
- tags;
- notes;
- transcript;
- SLA timer;
- contact identity;
- CRM/contact lookup;
- escalation reason;
- AI summary for handoff;
- resume AI after human close;
- business hours;
- away message;
- assignment/routing;
- operator RBAC;
- block/allow end user;
- satisfaction/feedback;
- export.

Conversation pricing may be useful for Enterprise-facing packaging, but underlying token/provider usage must still be metered internally for cost control.

## 14. Knowledge/RAG

Support:

- uploaded files;
- web pages/site crawl;
- manual Q&A;
- structured records;
- API/connector ingestion;
- scheduled refresh;
- versioning;
- source citations;
- chunk/index configuration;
- permissions;
- project/agent attachment;
- deletion/reindex;
- ingestion status;
- duplicate detection;
- freshness;
- retrieval analytics;
- document-level metadata/filtering.

Future advanced controls:

- hybrid search;
- reranking;
- per-source trust priority;
- freshness policy;
- answer-only-from-knowledge mode;
- fallback when evidence is insufficient.

## 15. Model evaluation and quality

Add an evaluation layer before model/route changes:

- golden test sets;
- prompt regression;
- RAG retrieval tests;
- tool-call correctness;
- safety tests;
- latency;
- cost;
- structured-output validity;
- model comparison;
- human ratings;
- A/B/canary rollout;
- rollback.

Alias changes that can materially change customer behavior should be versioned and auditable.

## 16. Enterprise integrations

Prioritize adapters that preserve one common AI semantics/runtime:

- Website/embed SDK.
- API.
- Telegram.
- Webhooks.
- Slack.
- Discord.
- Microsoft Teams.
- WhatsApp Business Platform.
- Messenger/Instagram Messaging.
- CRM/helpdesk adapters.
- Email assistant through Mkety Mail where appropriate.
- internal databases/business APIs through approved tools.

Each adapter owns transport/auth/delivery only. It does not implement a separate model/routing engine.

## 17. Domains and branding

Shared/default:

- `<customer>.mkety.app`.

Custom:

- customer domain/subdomain through the approved Cloudflare SaaS/custom-hostname boundary.

Brand controls:

- logo;
- assistant avatar;
- colors;
- launcher position;
- welcome message;
- localization;
- custom CSS only through sanitized/limited tokens rather than arbitrary unsafe markup;
- remove Mkety branding according to plan;
- email/notification branding where applicable.

## 18. Data lifecycle

Per object type define:

- retention;
- deletion;
- export;
- legal hold where needed;
- backups;
- restore;
- residency where supported;
- encryption;
- access audit.

Customer deletion must remove/revoke:

- API keys;
- provider connections;
- channels;
- domains;
- knowledge;
- conversation content according to policy;
- active publish/embed tokens.

Financial and security records may have separate legally/operationally required retention.

## 19. Enterprise security roadmap

Launch foundation:

- tenant PBAC;
- MFA through central identity where available;
- audit log;
- hashed Mkety API keys;
- provider secret isolation;
- encryption in transit;
- least privilege;
- DLP/guardrails configuration;
- IP/origin restrictions;
- budgets/rate limits;
- retention controls.

Later Enterprise features:

- SAML/OIDC enterprise SSO;
- SCIM provisioning;
- dedicated encryption keys where justified;
- regional/data residency controls;
- private networking;
- dedicated runtime/GPU;
- contractual SLA;
- security review/DPA;
- compliance evidence/export.

Do not advertise a certification until it has actually been achieved.

## 20. Admin / Platform Control

Mkety operators need:

- model catalog;
- alias/version management;
- provider status;
- provider cost rate;
- customer rate-card versions;
- global/tenant route overrides;
- circuit breaker;
- credit/manual grant tools;
- demo issuance;
- tenant plan/entitlement view;
- usage/cost/margin;
- abuse/security event view;
- enterprise provisioning;
- domain/channel health;
- customer support impersonation only through audited, constrained support tooling;
- feature flags;
- incident banner/provider disable.

Raw secrets must not be casually editable/viewable.

## 21. Cost-protection invariants

Before Mkety-managed inference:

1. authenticate;
2. resolve tenant/project;
3. authorize capability;
4. validate request size/modality;
5. resolve model alias/route;
6. check tenant/project/key/end-user rate limits;
7. check commercial entitlement;
8. check available allowance/credits/approved overage;
9. estimate/reserve worst-case or bounded spend where practical;
10. invoke;
11. capture provider usage;
12. write immutable usage event;
13. reconcile reserved vs actual charge;
14. write run/trace metadata;
15. return sanitized response.

If usage metadata is missing, apply a safe fallback accounting policy rather than assuming zero cost.

## 22. Cloudflare-specific implementation notes current at design date

Cloudflare is infrastructure, not the customer commercial authority.

Current capabilities that fit Mkety:

- Workers AI serverless models.
- AI Gateway authenticated requests.
- BYOK backed by Secrets Store.
- Dynamic routing with conditional/model/rate/budget nodes.
- Spend limits.
- retries/timeouts/fallback.
- exact-request caching.
- logs/analytics/cost metrics.
- custom metadata.
- Guardrails.
- DLP.
- OpenTelemetry export.
- custom HTTPS providers for private/self-hosted models.

Important limits must be treated as upstream capacity constraints, not customer plan promises. Mkety should maintain its own stricter limits and may horizontally scale/segment infrastructure as traffic grows.

## 23. Proposed data model extensions

In addition to the architecture document:

```text
ai_api_keys
ai_model_catalog
ai_model_aliases
ai_route_policies
ai_route_versions
ai_provider_connections
ai_provider_health
ai_rate_cards
ai_rate_card_versions
ai_budgets
ai_budget_events
ai_usage_costs
ai_runs
ai_run_steps
ai_cache_policies
ai_security_policies
ai_enterprise_configs
ai_enterprise_config_versions
ai_channels
ai_channel_installations
ai_domains
ai_conversations
ai_messages
ai_handoffs
ai_feedback
ai_webhooks
ai_audit_events
ai_demo_grants
```

Avoid tables that duplicate existing tenant membership, Billing, Entitlements, Credits or generic audit primitives when those can be extended safely.

## 24. Launch feature priority

### P0 — central foundation

- AI-specific PBAC keys.
- AI API keys.
- model catalog + aliases.
- provider-neutral runtime.
- managed route abstraction.
- budget/credit preauthorization.
- immutable usage/cost/run events.
- models endpoint.
- chat completions endpoint.
- streaming.
- structured errors.
- usage response.
- rate limits.
- audit.

### P1 — Cloudflare managed production candidate

- Workers AI.
- AI Gateway.
- two initial managed model routes.
- retries/timeouts.
- explicit fallback.
- caching policy.
- spend ceilings.
- observability.
- prompt/response retention mode.
- cost reconciliation.

### P2 — BYOK

- provider connection UI/API.
- secure secret refs.
- health test.
- customer model allowlist.
- fail-closed BYOK.
- BYOK usage/platform metering.

### P3 — first-party migration

- Public Mkety AI consumes shared low-level runtime without private tenant access.
- AI Workspace agents consume central runtime.
- preserve Automation/Trading authority boundaries.

### P4 — Enterprise

- enterprise logical configuration.
- managed `*.mkety.app`.
- website widget.
- Telegram.
- API.
- knowledge.
- team/RBAC.
- conversations/handoff.
- analytics.
- demo mode.
- custom domains.

### P5 — private/self-hosted

- custom provider.
- OCI/AWS/Azure/GPU endpoint.
- capacity/health.
- private-first aliases.
- optional dedicated infrastructure.

### P6 — expansion

- more channels;
- SSO/SCIM;
- advanced DLP/security;
- voice/audio;
- image generation;
- richer evaluation;
- semantic caching where safe;
- regional/dedicated infrastructure.

## 25. Progress ledger

### Completed design/audit

- Reconstructed Mkety architecture from authoritative mksaas/Trading/mklms documents.
- Confirmed central multi-tenant runtime is the primary Enterprise architecture.
- Confirmed normal Workspace and Public Mkety AI become first-party consumers.
- Confirmed existing PBAC/team system should be reused.
- Confirmed existing shared payments are NOWPayments default, Flutterwave v3 and Kora.
- Confirmed existing Billing -> Entitlements -> Usage/Credits separation.
- Defined provider modes: managed, BYOK, private and hybrid.
- Defined enterprise demo strategy.
- Defined commercial structure and overage modes.
- Defined security, cache, reliability, observability and capacity policy.
- Defined implementation priorities.

### Not yet implemented in code

- AI API-key schema/service.
- AI-specific PBAC keys.
- AI model/rate/route schemas.
- AI cost reservation/reconciliation.
- purchased credit packs/top-ups.
- overage modes.
- Workers AI adapter for the new central runtime.
- AI Gateway integration for the new runtime.
- BYOK UI/service.
- Enterprise configuration/channel layer.
- private-model adapter.
- production pricing values for managed inference.

## 26. Next engineering step

The next code slice should remain narrow and production-safe:

1. add AI PBAC permission keys and tests;
2. add additive schemas for AI API keys, model catalog/aliases, route policy, rate card, budgets and runs;
3. implement hashed AI API-key lifecycle;
4. implement provider-neutral inference contract;
5. implement model catalog service;
6. implement budget/credit authorization interface without paid calls;
7. implement `GET /api/v1/ai/models`;
8. implement `POST /api/v1/ai/chat/completions` against a non-billable/fake provider in tests;
9. add tenant isolation, idempotency, auth, rate-limit and no-secret-leak tests;
10. only then wire Workers AI/AI Gateway in a non-production environment.

No production DNS, provider billing, paid inference, dedicated GPU provisioning or production Agent Builder rerouting should occur in this first code slice.


## 27. Explicit exclusion: Cloudflare Unified Billing frontier-model resale

Mkety's day-one managed inference must **not** depend on Cloudflare Unified Billing for third-party frontier models.

Cloudflare Unified Billing can purchase prepaid credits and use Cloudflare-managed credentials for supported third-party providers. That is specifically not the intended Mkety product path because:

- it introduces a Cloudflare credit balance and 5% credit-purchase fee;
- it can create a negative credit balance in rare cases;
- it obscures the cleaner distinction between Mkety-managed Workers AI, customer BYOK, and Mkety private models;
- Mkety does not need Cloudflare to resell OpenAI/Anthropic/Gemini/xAI on its behalf.

Allowed day-one provider paths are therefore:

1. **Workers AI standard billing** for approved Cloudflare-hosted open models, initially Gemma 4 and Qwen 3.8 27B.
2. **BYOK** for customer-owned third-party provider accounts.
3. **Private/self-hosted HTTPS provider** when Mkety later operates models on OCI/AWS/Azure/etc.
4. Explicit controlled hybrid combinations of the above.

AI Gateway remains useful for observability, routing, caching, guardrails, DLP, BYOK secret handling and custom providers. Its Unified Billing capability should remain disabled/not relied upon unless a future documented decision deliberately changes this rule.

## 28. Public/Workspace/Enterprise blending rule

The major net-new product work in this initiative is the **Enterprise/shared AI server + developer PaaS layer**.

Do not reopen already-settled Public Mkety AI or normal AI Workspace product architecture except where needed to connect them safely to the central runtime.

Implementation order after Mail is stabilized:

1. build central runtime/API foundation;
2. add Workers AI Gemma/Qwen routes;
3. add BYOK;
4. prove Public AI transport compatibility without weakening public/private isolation;
5. prove AI Workspace agent/runtime parity;
6. migrate first-party consumers incrementally;
7. deliver Enterprise logical configurations/channels/demo;
8. add private/self-hosted inference when economics or customer requirements justify it.

The existing Public AI provider adapters may remain operational during migration. The target state is shared transport/control, not forced simultaneous replacement.


## 29. Verified external references — 2026-09-27

Implementation-time revalidation remains mandatory. Current research references:

- Cloudflare Workers AI Gemma 4 model page: https://developers.cloudflare.com/ai/models/%40cf/google/gemma-4-26b-a4b-it/
- Cloudflare Workers AI Qwen 3.8 27B model page: https://developers.cloudflare.com/workers-ai/models/qwen3.8-27b/
- Cloudflare Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Cloudflare AI Gateway BYOK: https://developers.cloudflare.com/ai-gateway/configuration/bring-your-own-keys/
- Cloudflare AI Gateway Unified Billing: https://developers.cloudflare.com/ai-gateway/features/unified-billing/
- Cloudflare AI Gateway Custom Providers: https://developers.cloudflare.com/ai-gateway/configuration/custom-providers/

These references support the provider/cost assumptions in this design but are not substitutes for release-time verification.


## 30. Central product/add-on integration rule

Enterprise AI should be discoverable and purchasable from the central Mkety product/catalog experience, but enabling it creates a separate product entitlement and opens the Enterprise AI workspace/console rather than expanding the normal AI Workspace invisibly.

A normal tenant journey may be:

```text
Mkety tenant
  -> Products / SolutionHub / Billing
  -> Enable Enterprise AI
  -> choose plan or contact sales
  -> payment/contract settlement
  -> entitlement becomes active
  -> Enterprise AI workspace appears
  -> ai.mkety.com opens with tenant context
```

The future Media integration should follow the same central-product pattern while retaining Media's isolated operational runtime/storage. This gives users one Mkety identity, team, billing and entitlement system without scattering product ownership or forcing all products into one runtime.
