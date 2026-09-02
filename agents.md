# Mkety — AI Agent Continuation Blueprint

> **Purpose:** Persistent source of truth and hand-off document for any AI coding agent continuing the Mkety platform upgrade.
>
> **Last updated:** 2026-09-02
>
> **Authoritative development repository:** `MketyDigital/mksaas`
>
> **Current live/legacy repository:** `MketyDigital/Mkety`
>
> **Primary product:** Mkety

---

# 0. READ THIS FIRST — AUTHORITY, REPOSITORY, AND DECISION ORDER

This file is the canonical architecture/product hand-off for the **new Mkety platform currently under development in `MketyDigital/mksaas`**.

The existing `MketyDigital/Mkety` repository remains the current public/live Mkety product until the upgraded platform is complete and intentionally switched over. It is a **legacy/reference source only** for pricing, previous product descriptions, customer expectations, Solution Hub ideas, branding history, and useful working concepts.

## Repository rule — LOCKED

- Build the upgraded platform in `MketyDigital/mksaas`.
- Do not redesign the new platform inside the legacy `MketyDigital/Mkety` repository.
- Use the legacy repository for information/reference when useful.
- Do not copy legacy implementation constraints into `mksaas` merely because they already exist.
- Do not change the live product or switch production traffic until the new platform is ready and the user explicitly authorizes the cutover.

## Decision precedence

When this file contains historical material and a later section explicitly says **LOCKED**, **SUPERSEDES**, or **CURRENT**, the later/current decision wins.

Use these status labels accurately:

- **LOCKED** — explicitly accepted and should not be revisited without the user's instruction.
- **DECIDED** — accepted architecture/product direction.
- **IMPLEMENTED** — code exists.
- **VERIFIED** — actually tested/observed working.
- **IN PROGRESS** — active implementation.
- **PLANNED** — accepted future work.
- **DEFERRED** — intentionally postponed.
- **ENTERPRISE ONLY** — not part of standard shared-platform economics.
- **REVISIT** — intentionally left open for later cost/technical review.

Do not present a planned component as implemented or verified.

---

# 1. NON-NEGOTIABLE AGENT RULES

1. **Do not restart architecture discussions already settled here.** Preserve locked decisions unless the user explicitly revisits them.
2. **Everything customers buy and use is Mkety.** Infrastructure vendors, internal engines, background services, orchestration components, databases, queues, runtimes, and implementation details are behind the scenes.
3. **Do not expose Cloudflare, OCI, Coolify, Redis, PostgreSQL, model gateways, deployment providers, or other infrastructure vendors in normal public marketing.** Enterprise customers may receive infrastructure disclosure where required for architecture, compliance, procurement, data location, contractual, security, or dedicated-deployment discussions.
4. **AI model names may be customer-visible where model choice is a legitimate product feature.** Even then, the product remains Mkety; the model is a capability/provider inside Mkety.
5. **Mkety must remain multi-tenant and customer-isolated.** Never create tenant-unsafe global queries, storage paths, secrets, workflows, agents, billing records, deployments, or background jobs.
6. **Separate the Mkety control plane/shared product from customer-specific heavy workloads.** Standard products should use shared/serverless economics wherever possible; dedicated/heavy customer workloads are Enterprise and infrastructure is selected per agreement and budget.
7. **Cloudflare is the preferred application/edge/runtime layer for standard Mkety usage.** Do not push work onto OCI merely because a VM exists.
8. **OCI Day-1 core VM is deliberately small and fixed.** Do not fill it with optional services.
9. **Use capability limits, usage units, projects, agents, executions, storage, credits, domains, and features in customer plans — not promises of vCPU/RAM/server allocations for serverless products.**
10. **Prefer simple implementations first.** Do not add Flowise, Activepieces, Qdrant, LiteLLM, Uptime Kuma, a large ERP/LMS framework, or other infrastructure merely because it was previously discussed.
11. **Never commit secrets, API keys, service credentials, webhook secrets, private customer content, or production credentials to Git.**
12. **Preserve portability.** Mkety owns the product abstractions; cloud providers supply infrastructure primitives.
13. **Do not fabricate traction, partnerships, customer counts, revenue, compliance, certifications, startup-program acceptance, or infrastructure capabilities.** Position Mkety strongly but truthfully.
14. **Inspect current code and recent commits before changing implementation.** This blueprint records decisions; the repository determines implementation state.
15. **If a new recommendation conflicts with old history, update this file when the user accepts the new decision.**

---

# 2. MKETY COMPANY / PRODUCT POSITIONING — CURRENT AND LOCKED

Mkety should be presented as a **global AI-powered technology platform and product company** that helps businesses and organizations build, automate, deploy, and operate digital solutions.

The company should sound like a scalable technology startup rather than a local web-development agency.

## Public positioning

Mkety enables businesses to:

- Build and deploy AI assistants and AI agents.
- Automate business workflows and repetitive operations.
- Build and deploy websites, portals, APIs, and lightweight applications.
- Connect business tools and data through integrations.
- Use AI-powered knowledge and document systems.
- Deploy reusable business solutions and industry blueprints.
- Commission advanced/private solutions through Enterprise.

Recommended umbrella language:

> **AI-powered solutions for modern businesses.**

Other acceptable language:

- AI-powered business infrastructure.
- AI agents, automation, applications, and business solutions in one platform.
- Build, automate, deploy, and operate with Mkety.
- AI-first tools for businesses and teams.
- Intelligent software and automation for business operations.

Do not make the brand sound primarily like consulting, freelance development, shared hosting, VPS hosting, or a collection of unrelated cloud products.

## Startup-provider / accelerator positioning

When describing Mkety to startup programs, cloud-credit providers, accelerators, technical partners, and similar organizations, emphasize the truthful product characteristics that such programs commonly evaluate:

- Product-led technology company.
- AI-first / AI-enabled SaaS and platform architecture.
- Multi-tenant recurring software product.
- Reusable agent, workflow, deployment, integration, and Solution Hub capabilities.
- Global product architecture.
- Business/enterprise use cases.
- Scalable serverless-first design.
- Cloud-agnostic/provider-abstracted architecture where practical.
- Usage metering and recurring subscriptions.
- Platform extensibility through tools/integrations.
- Cost-efficient early infrastructure with a clear path to scale.
- Security, authorization, tenancy, and audit as platform concerns.
- Potential to serve SMBs, creators, teams, and larger organizations.

### Truthfulness rule

The goal is to **sound like the technology startup Mkety actually is becoming**, not to imitate application language dishonestly. Never invent metrics or claim capabilities that are not implemented/planned.

---

# 3. MARKET POSITION — GLOBAL FIRST

Mkety may initially acquire many customers in Nigeria and Africa, and affordability remains strategically important, but **all public wording must remain global**.

## LOCKED rules

- Do not call the standard product an “African edition.”
- Do not make public product descriptions region-limited unless a feature genuinely is limited by provider availability.
- Do not frame Mkety as “for Africans only,” “Nigerian software,” or similar narrow positioning.
- Use globally understandable product language.
- Keep pricing architecture globally presentable.
- Local payment methods may be available behind the scenes without changing global product positioning.
- Region-specific campaigns are allowed, but the core product remains global.

The internal business may optimize pricing and acquisition for African markets while public architecture, terminology, design, product quality, and platform positioning remain global-ready.

---

# 4. BRAND RULE — EVERYTHING IS MKETY

The customer should experience one product ecosystem: **Mkety**.

Avoid exposing an internal stack as a list of products.

Bad public experience:

```text
Cloudflare Worker
Redis Queue
OCI Job Runner
PostgreSQL
Coolify
LiteLLM
R2
```

Correct customer experience:

```text
Mkety Agent
Mkety Workflow
Mkety Knowledge
Mkety Deployment
Mkety Storage
Mkety Analytics
Mkety Solution
Mkety Billing
```

Internal provider names may appear in:

- technical administration,
- internal documentation,
- engineering logs,
- Enterprise architecture proposals,
- compliance/data-processing documentation,
- procurement/security reviews,
- customer-requested dedicated infrastructure discussions.

Normal SMB/Creator users should not need to understand where Mkety runs.

---

# 5. PRODUCT STRUCTURE

## Mkety

Main brand and customer platform.

The primary website/platform should remain a cohesive Next.js experience where practical rather than fragmenting the brand across unnecessary standalone sites.

## Mkety Platform

Core product capabilities:

- Workspaces.
- Projects.
- AI Agents.
- Agent Builder.
- Agent versions/publishing.
- AI test/playground experience.
- Tools/integrations.
- Knowledge/RAG.
- Workflows/automation.
- Deployments.
- Domains.
- Usage/credits/billing.
- Audit/logging.
- Solution Hub.

## Mkety Academy

Education/training arm covering digital technology skills such as web/app development, AI, automation, and related topics.

Keep the Academy lightweight in Mkety Core. A reusable full LMS/course portal remains a Solution/Blueprint rather than a reason to bloat the core SaaS.

## Trading Workspace — CURRENT POSITION

Trading remains a **Mkety Workspace / Enterprise capability**, but the previously developed dedicated trading infrastructure and MTProto/trade-copy systems are outside the standard `mksaas` shared-platform scope.

### LOCKED

- Keep Trading Workspace visible conceptually.
- Public price: **Custom / Enterprise**.
- Access is granted through Enterprise engagement.
- Do not provision or promise trade-copy infrastructure from the Day-1 Mkety core OCI VM.
- Do not include persistent MT4/MT5/MTProto/trading execution services in standard shared-platform resource calculations.
- Existing trading systems may remain separately operated/deployed.
- Future trading requirements use dedicated/customer-specific infrastructure according to agreement and budget.

Trading should not force the standard Mkety platform to carry low-latency broker/runtime requirements.

---

# 6. CUSTOMER / COMMERCIAL SEGMENTATION

Use the following conceptual segmentation where useful:

### Personal / Starter

Simple websites, landing pages, portfolios, and lightweight online presence.

### Creator / Business

AI, automation, lightweight applications, portals, dashboards, workflows, and business solutions that fit the shared Mkety platform envelope.

### Enterprise

Any requirement that needs one or more of:

- dedicated infrastructure,
- persistent arbitrary containers/processes,
- private databases,
- large databases,
- heavy compute,
- high-volume workloads,
- browser automation,
- custom networking,
- specialized trading infrastructure,
- strict latency requirements,
- private model hosting,
- customer-specific cloud topology,
- advanced compliance/security requirements,
- large/complex ERP or industry systems,
- guaranteed/dedicated compute,
- special support or SLA,
- custom architecture.

Enterprise is a **deployment/commercial policy**, not merely “large company.” A smaller organization can be Enterprise if its technical requirements fall outside the shared platform envelope.

---

# 7. CORE ARCHITECTURE — CURRENT

```text
                              MKETY
                                │
                  Cloudflare Application Layer
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
      Pages                   Workers                   R2
        │                       │                       │
 Web/UI/static sites     APIs / agents /         Files / media /
                        workflows / webhooks      knowledge objects
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                          Mkety data layer
                                │
                           PostgreSQL
                                │
                  Shared persistent support
                                │
             OCI Free VM — 2 OCPU / 16 GB RAM
                                │
         ┌──────────────────────┼──────────────────────┐
         │                      │                      │
      Coolify                 Redis              Mkety Worker
```

This diagram describes **Mkety Core/shared services**, not customer-owned Enterprise workloads.

## Control plane principle

Mkety owns:

- identity/authorization policy,
- tenancy,
- workspaces/projects,
- agent definitions and versions,
- workflow definitions,
- tools,
- knowledge metadata,
- deployment records,
- usage/billing,
- solution configuration,
- customer UX,
- orchestration and policy.

Cloud/infrastructure providers are implementation layers behind Mkety.

---

# 8. DAY-1 OCI CORE STACK — LOCKED

The new Always-Free/core OCI VM capacity to design around is:

```text
2 OCPU
16 GB RAM
```

### Day-1 services — exactly these four

1. **Coolify**
2. **PostgreSQL**
3. **Redis**
4. **Mkety Worker**

This is LOCKED for Day 1 unless the user explicitly changes it.

## Do NOT add by default

Do not install/start these on Day 1 merely because earlier architecture discussions mentioned them:

- LiteLLM.
- Uptime Kuma.
- Qdrant.
- Flowise.
- Activepieces.
- n8n.
- customer trading infrastructure.
- Telegram MTProto userbots.
- ERPNext.
- customer-owned applications.
- arbitrary customer containers.

Those components are not banned; they are **not part of the locked core VM baseline**.

## Historical OCI note

Earlier Mkety work used a larger OCI environment (approximately 4 CPU/~15 GiB RAM) for Coolify, PostgreSQL, Redis, and other experiments. That historical capacity must **not** be used for new sizing assumptions. Current Day-1 planning uses **2 OCPU / 16 GB RAM**.

---

# 9. MKETY WORKER — LOCKED CONCEPT

**Mkety Worker** is a shared persistent background-job service, not a customer-facing product and not a separate brand.

Its purpose is to complete asynchronous or long-running platform tasks that should not remain attached to an interactive Cloudflare HTTP request.

## Example flow

```text
Customer action
      ↓
Cloudflare / Mkety API
      ↓
Validate + create job
      ↓
Return quickly to customer
      ↓
Redis / job state
      ↓
Mkety Worker
      ↓
Perform background task
      ↓
Update PostgreSQL / R2 / external service
      ↓
Job COMPLETE / FAILED
```

## Suitable Worker jobs

Examples include:

- bulk knowledge ingestion,
- document parsing,
- embedding batches,
- large imports/exports,
- background workflow steps,
- bounded retries,
- batch email/notification work,
- report generation,
- certificate generation,
- cleanup/maintenance jobs,
- usage aggregation,
- billing aggregation,
- deployment orchestration,
- jobs requiring libraries/runtime characteristics unsuitable for edge execution.

## What Mkety Worker is NOT

- Not one process/container per ordinary customer.
- Not a substitute for Cloudflare Workers.
- Not the main HTTP API.
- Not a place to host every Solution Hub product.
- Not a generic customer VPS.
- Not the trading execution runtime.

Cloudflare receives/orchestrates most standard application traffic; Mkety Worker quietly completes justified persistent/background work.

---

# 10. POSTGRESQL — CORE DATA LAYER

PostgreSQL is the primary relational data platform for Mkety Core.

The main `mksaas` architecture should not assume Supabase is required for the core product.

### SUPERSEDES earlier generic Supabase-first wording

Use PostgreSQL for core Mkety domains such as:

```text
Tenancy
- tenants
- workspaces
- members
- projects
- domains

Identity/application profile
- users
- identities/references
- roles
- permissions/policy metadata

AI
- agents
- agent_versions
- agent_runs
- conversations
- tools
- knowledge_sources
- knowledge_chunks/metadata

Automation
- workflows
- workflow_versions
- workflow_runs
- workflow_steps
- webhook_triggers
- execution_events

Billing
- plans
- subscriptions
- wallets
- ledger
- usage
- invoices
- credits
- audit_logs
- webhook_events

Deployments
- applications
- deployments
- environments
- domains
- resources
- deployment_events

Background work
- jobs
- job_runs
- job_errors
```

Follow the existing repository schema where implemented; do not duplicate tables merely to match conceptual names.

## Trading database exception

A separate main Supabase PostgreSQL database already powers the existing trading workspace. That is outside the new Day-1 Mkety Core database decision and should not be confused with `mksaas` core data architecture.

---

# 11. REDIS — LIMITED SHARED SUPPORT ROLE

Redis remains in the locked OCI Day-1 stack, but should be used intentionally.

Suitable roles:

- background-job coordination,
- short-lived cache,
- distributed locks,
- temporary workflow/job state,
- counters/rate-control state where appropriate,
- ephemeral coordination between persistent services.

Do not route every feature through Redis merely because Redis exists.

If Cloudflare-native primitives are simpler and cheaper for a particular edge concern, use them rather than creating unnecessary OCI traffic.

---

# 12. LITELLM — DEFERRED / ONLY IF JUSTIFIED

LiteLLM remains an accepted possible infrastructure component, but it is **not required Day 1** and must not be added to the core VM without a concrete need.

Mkety should initially be capable of maintaining its own stable model-provider abstraction:

```text
Mkety Agent Runtime
       ↓
Mkety Model Adapter / Provider Layer
       ↓
OpenAI / Gemini / Anthropic / Groq / other approved models
```

Consider LiteLLM later if Mkety materially benefits from:

- centralized provider routing,
- unified OpenAI-compatible APIs across providers,
- provider failover,
- centralized provider quotas/rate limits,
- cross-provider spend controls,
- model gateway telemetry,
- operational simplification at larger scale.

Do not deploy it simply because it is popular.

---

# 13. UPTIME KUMA — DEFERRED / OPTIONAL

Uptime Kuma is not part of the Day-1 locked VM.

Use Cloudflare/provider/application health visibility initially where sufficient. Add Uptime Kuma or another monitor later if it provides clear operational value without wasting constrained core resources.

Observability is required; Uptime Kuma specifically is not.

---

# 14. QDRANT / FLOWISE / ACTIVEPIECES / N8N

These remain optional tools, not Mkety Core dependencies.

## Qdrant

Use PostgreSQL + pgvector first where sufficient. Consider Qdrant only when dedicated vector-search requirements justify the operational cost.

## Flowise

Do not make Mkety agents depend on Flowise. Mkety has its own Agent Builder/lifecycle abstraction.

## Activepieces / n8n

Do not make Mkety's workflow control plane permanently depend on either engine. They may be used in Enterprise/customer-owned deployments or targeted integrations where justified.

---

# 15. CLOUDFLARE — PRIMARY STANDARD PLATFORM RUNTIME

Cloudflare is the preferred edge/application/runtime layer for standard Mkety products.

The account includes **Workers Paid**, so design standard shared features around the Cloudflare platform before assigning persistent VM resources.

Accepted Cloudflare roles include:

- DNS.
- Pages.
- Workers.
- R2.
- CDN/cache.
- edge authorization.
- custom domains.
- SSL.
- routing.
- WAF/security where appropriate.
- lightweight API/business logic.
- agent orchestration.
- model API orchestration/streaming.
- webhooks.
- workflow triggers and normal short execution paths.
- scheduled edge functions where appropriate.
- signed/tokenized file/media access.
- managed integrations.
- lightweight customer applications.

## Architectural principle

Do not ask “Can we put this on OCI?” first.

Ask:

1. Can this be a static Pages workload?
2. Can this safely/economically run as a Worker/serverless Mkety feature?
3. Can persistent data live in PostgreSQL/R2 while computation remains serverless?
4. Does it truly require a persistent process/background worker?
5. If customer-specific/heavy, should it be Enterprise instead of consuming shared core capacity?

---

# 16. STARTER WORKSPACE — REPOSITIONING

Starter should be essentially a **Pages-first website/publishing product**.

Do not market it as hosting with CPU/RAM.

### Customer value language

Starter can include controlled limits around:

- published websites/pages,
- landing pages,
- portfolio sites,
- simple business sites,
- basic blogs/documentation where supported,
- custom domain(s),
- SSL,
- edge delivery,
- forms/integrations,
- basic analytics,
- project management,
- storage or asset allowance,
- Mkety credits where relevant.

### Infrastructure rule

For ordinary Starter usage:

```text
Cloudflare Pages
+ optional lightweight shared supporting services only when a feature requires them
```

Do not provision an OCI container per Starter customer.

### Remove/supersede legacy wording

Avoid public technical promises such as:

- shared CPU,
- shared RAM,
- VPS-like resources,
- server allocation.

Sell customer outcomes and platform capabilities.

---

# 17. DEPLOY WORKSPACE — REPOSITIONING

Deploy should represent **lightweight web apps, APIs, portals, and serverless application deployment**, primarily using Pages + Workers and shared Mkety services.

### Customer-facing capabilities may include

- web applications,
- Worker-powered APIs,
- webhooks,
- scheduled functions,
- custom domains,
- environment variables/secrets,
- Git-connected deployment where implemented,
- deployment history,
- logs/status,
- SSL,
- storage/database connectivity,
- project limits,
- application limits,
- usage/credits.

### Preferred language

Use phrases such as:

- managed application runtime,
- serverless application runtime,
- edge deployment,
- managed deployment,
- application/API usage allowance.

Do not promise shared CPU/RAM as if each subscription includes a slice of a VM.

### Deployment boundary

If a customer needs arbitrary Docker containers, persistent daemons, large compute, special networking, or dedicated resources, move that requirement to **Enterprise** and select infrastructure according to the agreement/budget.

---

# 18. AI WORKSPACE — REPOSITIONING

AI Workspace should be centered on Mkety's actual agent system, not generic “AI hosting.”

Potential customer value/limits:

- AI Agent Builder.
- number of agents.
- number of published agents.
- drafts and version history.
- model choice.
- test playground.
- Website AI.
- Telegram Bot integration.
- WhatsApp/social integrations where supported.
- API access.
- tools/actions.
- knowledge sources.
- knowledge storage/indexing allowance.
- conversation/run history.
- usage credits/tokens or Mkety usage units.
- team members.

Most AI inference should occur at external AI model providers. Standard Mkety AI assistants should not require a dedicated OCI process per customer.

Typical flow:

```text
User
 ↓
Mkety / Cloudflare
 ↓
Agent runtime + tools + retrieval
 ↓
AI model provider
 ↓
streamed Mkety response
```

Use the Mkety Worker only for justified asynchronous tasks such as bulk ingestion/embedding jobs.

---

# 19. AUTOMATION WORKSPACE — REPOSITIONING

Automation Workspace should expose Mkety workflow capability rather than infrastructure resources.

Potential features/limits:

- visual workflow builder,
- workflow count,
- webhook triggers,
- schedules,
- API actions,
- conditions,
- notifications,
- integration catalog,
- secrets,
- run history,
- execution logs,
- retries,
- monthly executions/credits,
- team access.

Most normal workflow orchestration should remain Cloudflare/serverless-first.

Jobs that need longer background processing can be queued to Mkety Worker.

Customer-specific long-running automation, browser automation, heavy data processing, or private runtime requirements belong in Enterprise when they exceed the standard shared envelope.

---

# 20. MKETY ONE / BUNDLED PLANS

A future bundled plan such as Mkety One may combine standard Workspace capabilities, but its public value must be expressed in product limits and usage rather than physical server allocations.

Good plan dimensions:

- workspaces/projects,
- published apps,
- websites,
- agents,
- knowledge sources/storage,
- workflow executions,
- credits/usage,
- domains,
- team members,
- support level,
- analytics/history retention.

Avoid “unlimited” for a resource that has meaningful marginal cost unless a fair-use policy and economics have been explicitly designed.

---

# 21. SOLUTION HUB — CURRENT COMMERCIAL MODEL

The legacy Mkety Solution Hub is a useful source of customer demand/categories, but each solution must now be classified by runtime economics.

## Class A — Standard Mkety / managed shared-platform solutions

These can have transparent monthly prices when they fit Cloudflare + shared Mkety data/services.

Examples include many of the legacy ideas:

### AI

- Website AI Assistant.
- Knowledge AI Assistant.
- Customer Support AI.
- Document Q&A/AI within reasonable limits.
- Sales AI Assistant.
- Lead Qualification AI.
- Appointment AI.
- Telegram Bot AI.
- WhatsApp AI where provider/API requirements permit.
- social messaging AI where provider APIs permit.

### Automation

- lead automation,
- notification automation,
- content automation,
- workflow automation,
- API automation,
- scheduled automation,
- webhook automation,
- approval workflows,
- reasonable data synchronization,
- CRM/sales/support workflows within shared limits.

### Web / lightweight applications

- landing pages,
- static websites,
- portfolios,
- blogs,
- documentation sites,
- business websites,
- booking/appointment apps,
- lightweight CRM,
- project-management tools,
- basic help desk,
- basic inventory,
- customer portals,
- admin dashboards,
- membership portals,
- lightweight APIs,
- lightweight web applications.

These should use Mkety shared/serverless infrastructure and not receive dedicated VM allocations by default.

## Class B — Enterprise / infrastructure assigned per engagement

Make a solution Enterprise/Custom when requirements materially exceed the shared platform envelope.

Examples:

- complex ERP.
- large school/college management systems.
- hospital/clinic systems with substantial data/security requirements.
- larger e-commerce/transactional systems.
- heavy logistics platforms.
- high-volume data processing.
- browser automation.
- arbitrary Docker/container workloads.
- persistent customer services.
- private databases.
- private networking.
- private model hosting.
- dedicated environments.
- specialized trading infrastructure.
- high-throughput integrations.
- strict latency/SLA deployments.

Infrastructure may then be Cloudflare, OCI paid resources, Azure/startup-credit resources, another provider, or customer-owned infrastructure depending on requirements and agreement.

### Critical margin rule

Never quietly place a heavy/custom customer workload on the constrained Mkety Core free VM to make a low monthly public price work.

---

# 22. CUSTOMER-OWNED PRODUCTS / PROPERTIES

The shared OCI Day-1 VM is **not** a free hosting pool for arbitrary customer-owned products or properties.

Standard Mkety features that customers use are shared platform usage.

A customer's own product requiring dedicated/persistent infrastructure is evaluated separately:

```text
Customer requirement
       ↓
Mkety architecture assessment
       ↓
Shared standard fit? ── yes → Mkety shared platform
       │
       no
       ↓
Enterprise
       ↓
Dedicated/customer-specific infrastructure
```

Do not permanently consume core free-tier capacity with bespoke customer workloads.

---

# 23. AI AGENT SYSTEM

The agent architecture is persistent, tenant-aware, and versioned.

Core concepts:

- Workspace.
- Project.
- Agent.
- Agent version.
- Draft version.
- Published version.
- Runtime execution.
- Tools.
- Knowledge sources.
- Model/provider configuration.
- Credentials/secrets.
- Conversation/session state.
- Usage/telemetry.
- Audit trail.

Lifecycle:

```text
Create Agent
   ↓
Configure
   ↓
Add instructions / model / tools / knowledge
   ↓
Save draft
   ↓
Test
   ↓
Version
   ↓
Publish
   ↓
Published version becomes authoritative
   ↓
Runtime
   ↓
Observe
   ↓
Next version / rollback
```

Never let production silently execute an unpublished draft when a published version exists.

Known repository history indicates foundational agent persistence, Agent Builder, published-version authority, and runtime/version lifecycle work have already been implemented/committed. Verify code before claiming production readiness.

---

# 24. MIPX / TOOL REGISTRY / ACTION ENGINE

Mkety-first abstractions remain accepted:

- **MIPX** — internal Mkety integration/protocol abstraction.
- **Tool Registry** — centralized tool/action definitions.
- **Action Engine** — validated/authorized execution layer.

Actions should support where applicable:

- validation,
- authorization,
- tenant awareness,
- idempotency,
- bounded retries,
- timeout,
- failure state,
- audit record,
- usage accounting,
- provider-specific adapters behind stable Mkety interfaces.

These abstractions help keep Mkety customer-facing even when implementation vendors change.

---

# 25. WORKFLOW / AUTOMATION ENGINE

Existing repository history indicates substantial foundations already exist:

- workflow definitions/runs,
- execution history,
- persistence,
- webhook workflows,
- webhook secrets,
- execution engine,
- tenant-scoped API,
- authenticated execution,
- CRUD/lifecycle API,
- run history,
- bounded retries.

Continue building the usable product layer:

- visual workflow builder,
- trigger/action catalog,
- conditions,
- scheduling,
- durable/background execution where required,
- observability,
- customer-facing errors/history,
- usage metering.

Do not rebuild existing API foundations without verifying they are missing/broken.

---

# 26. KNOWLEDGE / RAG

Target:

- file/document ingestion,
- chunking,
- embeddings,
- vector search,
- tenant/workspace/project isolation,
- agent-specific knowledge selection,
- retrieval telemetry.

Default strategy:

```text
PostgreSQL + pgvector where sufficient
```

Use R2 for appropriate object/file storage.

Qdrant becomes a dedicated vector workload only when actual scale/performance requirements justify it.

Bulk parsing/embedding may use Mkety Worker.

---

# 27. IDENTITY / AUTHORIZATION

Previously accepted target direction includes:

- ZITADEL for identity/authentication/organization identity where the migration remains appropriate.
- Cerbos for fine-grained authorization/policy decisions.
- Prisma as the accepted ORM target from previous architecture discussions.

Important: the original starter may still contain Auth.js/Auth0/Drizzle-era assumptions. Verify actual current code before migrating/removing anything.

Authorization must be:

- tenant-aware,
- workspace-aware,
- project/resource-aware,
- role/permission-aware,
- auditable.

Never trust a tenant/workspace ID merely because a client supplied it; resolve permissions from authenticated context.

---

# 28. BILLING / CREDITS / USAGE

Desired billing product concepts remain:

- plans,
- subscriptions,
- wallet/credits,
- ledger,
- usage metering,
- invoices,
- audit logs,
- webhook processing,
- admin billing.

Lago remains the preferred billing/usage engine from the earlier architecture discussion **if integration economics/operations still make sense when implementation reaches this phase**.

Payment gateways previously accepted include Selar and NOWPayments where useful. Additional gateways may be added for global coverage.

Do not expose payment-provider implementation details unnecessarily.

Pricing must account for actual marginal costs including:

- AI inference,
- storage,
- Worker/runtime usage,
- background jobs,
- workflow executions,
- external API/provider fees,
- email/SMS/communications,
- media processing where applicable,
- dedicated Enterprise infrastructure.

---

# 29. PRICING PRINCIPLES — CURRENT

Legacy Mkety prices are reference material, not automatically final prices for the upgraded platform.

Reprice/reword workspaces before the new platform cutover.

## Customer-facing limits should use

- number of projects,
- websites/pages,
- published applications,
- agents,
- published agents,
- knowledge sources/storage,
- workflow runs/executions,
- Mkety credits/usage units,
- domains,
- team members,
- retention/history,
- support tier.

## Avoid

- vCPU promises for serverless products,
- RAM promises for serverless products,
- implying a VPS/container allocation where none exists,
- “unlimited” usage without economic controls,
- hard guarantees that depend on third-party provider pricing/limits unless contractually designed.

Public pricing remains globally presented. Affordability for Nigeria/Africa can influence internal pricing strategy without regionalizing the brand.

Enterprise price remains **Custom**.

---

# 30. DEPLOYMENT PRODUCT MODEL

Mkety's core promise includes:

```text
Create AI Agents
Automate Workflows
Deploy Applications
Use Business Solutions
```

Deployment functionality should eventually support:

- application/project creation,
- repository connection,
- builds/deploys,
- environment variables/secrets,
- domains,
- deployment history,
- logs/status,
- rollback,
- usage/resource tracking,
- customer isolation.

Standard deployment path:

- static/light sites → Pages,
- lightweight APIs/apps → Workers + Pages + shared data/storage,
- background platform jobs → Mkety Worker,
- dedicated/heavy/customer-specific runtime → Enterprise-selected infrastructure.

Coolify is not the default runtime for every standard customer application.

---

# 31. COOLIFY

Coolify is the Day-1 management layer for the small set of persistent OCI services.

Primary purpose on the core VM:

- deploy/manage PostgreSQL-related supporting configuration where appropriate,
- Redis,
- Mkety Worker,
- necessary persistent Mkety services approved later.

Do not use Coolify as an excuse to move ordinary Pages/Worker workloads onto the VM.

---

# 32. OBSERVABILITY / OPERATIONS

Observability is required even though Uptime Kuma is deferred.

Use appropriate combinations of:

- Cloudflare logs/analytics,
- application logs,
- Worker/job logs,
- PostgreSQL health metrics,
- Redis health,
- Coolify service health,
- workflow execution history,
- audit logs,
- deployment history,
- background-job state/error reason,
- provider dashboards where necessary.

Every major asynchronous operation should expose a state and failure reason, e.g.:

```text
Job: PROCESSING
Job: FAILED — reason
Workflow: COMPLETED
Deployment: BUILDING
Agent run: FAILED
Knowledge ingestion: INDEXING
```

Add a dedicated external monitoring service later when justified.

---

# 33. SECURITY / MULTI-TENANCY

Security is a platform requirement.

Audit sensitive events such as:

- login/security events,
- permission changes,
- tenant/workspace membership changes,
- agent publish/unpublish,
- workflow execution,
- secret changes,
- billing changes,
- deployment changes,
- sensitive file/media access where appropriate.

Use least privilege.

Customer resources must be scoped to authenticated tenant/workspace/project context.

Storage/object keys should use isolation patterns such as:

```text
/<tenant>/<workspace>/<project>/...
```

Never allow a customer to guess another customer's resource identifier and obtain access.

---

# 34. CUSTOMER DATA PORTABILITY

Use stable internal IDs and provider-independent abstractions for important external resources.

Example:

```text
resource.provider = "..."
resource.provider_resource_id = "..."
```

Apply this principle to:

- AI providers,
- storage,
- deployment providers,
- payment providers,
- identity providers,
- automation integrations.

The goal is not zero vendor dependence; the goal is that Mkety product logic is not unnecessarily welded to one provider.

---

# 35. COURSE / LMS / EVERGREEN WEBINAR

The prior course/LMS work remains a reusable Mkety Solution/Blueprint direction rather than core-platform bloat.

Previously selected starting template:

`foyzulkarim/nextjs-lms-boilerplate`

A related Mkety LMS repository (`mklms`) has been planned for self-paced courses and evergreen webinar work.

Core requirements previously accepted include:

- paid enrollment,
- student accounts,
- course/module/lesson structure,
- progress tracking,
- completion rules,
- certificate automation,
- email/notification delivery,
- private community unlock,
- Telegram integration/Mini App where useful,
- mobile-friendly experience,
- custom branding.

## Certificate requirement

Certificate creation should require zero manual work per student:

```text
100% completion
 ↓
completion event
 ↓
unique certificate ID
 ↓
render template
 ↓
PDF
 ↓
storage/email
 ↓
verification page
 ↓
community unlock
```

Use a dedicated confirmed certificate-name field.

## Evergreen webinar

Treat evergreen webinar as a separate user experience that may share identity/data/media/payment infrastructure with a course product.

Do not falsely describe a recording as genuinely live. Scheduled-event UX, countdown, synchronized replay chat, timed CTA, and controlled playback may be used without deceptive claims.

---

# 36. VIDEO ARCHITECTURE — PREVIOUSLY LOCKED, PRESERVED

Unless the user explicitly revisits the course/video architecture, preserve:

```text
OCI Media Flow + OCI Object Storage
              ↓
        processed HLS/ABR
              ↓
       Cloudflare R2
              ↓
     Cloudflare CDN/cache
              ↓
       Mkety HLS player
```

This media pipeline is **not the same as the Day-1 core OCI VM stack**. OCI managed Media Flow/Object Storage are separate managed services and should not be confused with the 2 OCPU/16 GB core VM.

R2 remains the production HLS/storage/delivery origin where that architecture is used.

Use signed/tokenized access for paid/private media.

Do not expose provider details in normal customer UX. Show states such as Uploading → Processing → Ready.

---

# 37. TELEGRAM / SOCIAL AUTOMATION BOUNDARY

Mkety can support normal Telegram/social API integrations and webhook/Bot API automations through the shared platform where appropriate.

Previously developed persistent Telegram MTProto/userbot infrastructure is **outside the Day-1 core plan**.

### LOCKED

- Do not place existing MTProto/userbot systems on the new Mkety Core VM.
- Do not count them when sizing the 2 OCPU/16 GB core environment.
- A future persistent MTProto requirement is Enterprise or separately deployed infrastructure unless explicitly approved as a shared platform service.

This does not prevent ordinary Telegram Bot API integrations from being standard Mkety features.

---

# 38. TRADING BOUNDARY — ENTERPRISE ONLY

Previously developed trade-copy, signal-copy, MT4/MT5, and related persistent trading runtimes are outside standard `mksaas` infrastructure.

Trading Workspace remains a Mkety product concept but is commercially/operationally **Enterprise / Custom**.

Possible Enterprise capabilities may include:

- trading dashboards,
- investor portals,
- analytics/reporting,
- MT4/MT5 integrations,
- trade-copy systems,
- signal automation,
- broker integrations,
- custom trading infrastructure.

Architecture and pricing are agreed case-by-case.

Do not promise sub-50ms execution or other latency guarantees in standard marketing without a dedicated verified architecture and contract.

---

# 39. ERP / HEAVY INDUSTRY SOLUTIONS

ERPNext and other large systems remain possible Solution/Blueprint/Enterprise options, not Mkety Core.

Open edX remains excluded from Mkety Core v1.

Large school, hospital, ERP, logistics, or other industry systems should be assessed as Enterprise when their data/runtime/operational requirements exceed standard shared-platform limits.

Do not install these systems on the Day-1 core VM.

---

# 40. FRONTEND / APPLICATION TECHNOLOGY

Primary application technology remains:

- Next.js,
- React,
- TypeScript,
- Tailwind CSS,
- shadcn/ui where useful.

Favor:

- server-side authorization,
- tenant-scoped access,
- reusable feature modules,
- typed API contracts,
- strong mobile UX,
- accessible components,
- minimal client-side secrets,
- edge-compatible code where standard Cloudflare deployment is intended.

---

# 41. CURRENT REPOSITORY IMPLEMENTATION CONTEXT

`MketyDigital/mksaas` originated from a mature Next.js multi-tenant SaaS/AI starter.

Repository/template history includes foundations around:

- multi-tenancy,
- tenant routes,
- admin,
- roles/permissions foundations,
- audit logging,
- webhooks,
- file uploads,
- AI assistant/RAG foundations,
- PostgreSQL/pgvector,
- GitHub integration concepts,
- CI/CD,
- Storybook,
- i18n.

Recent historical work in this project also indicates implementation around:

- agent persistence,
- Agent Builder,
- agent publish/version lifecycle,
- runtime against published versions,
- workflow persistence,
- workflow CRUD/lifecycle APIs,
- secure webhooks,
- execution history,
- bounded retries.

Do not assume every starter feature matches the final Mkety target. Verify current code.

---

# 42. ROADMAP / CONTINUATION ORDER

Recommended continuation remains:

## A. Verify/finish AI runtime UX

- test playground,
- agent run UI,
- runtime errors,
- tool invocation visibility,
- usage tracking.

## B. Tools + knowledge

- Tool Registry UI,
- permissions,
- knowledge source management,
- ingestion,
- retrieval,
- agent attachment,
- background ingestion path through Mkety Worker where necessary.

## C. Workflow product UX

- visual builder,
- triggers/actions,
- conditions,
- scheduling,
- execution history,
- retry/error UX,
- Cloudflare-vs-background execution routing.

## D. Deployment

- app/project creation,
- repository connection,
- Pages/Workers deployment model,
- env/secrets,
- logs/status,
- domains,
- rollback,
- Enterprise escape hatch for non-serverless workloads.

## E. Billing/entitlements

- plans,
- entitlements,
- wallet/credits,
- usage events,
- subscriptions,
- invoices/payments.

## F. Reprice/reword the product catalog

Before cutover from legacy Mkety:

- rewrite Starter,
- rewrite Deploy,
- rewrite AI Workspace,
- rewrite Automation Workspace,
- rewrite bundled/Mkety One offering,
- make Trading Enterprise/Custom,
- classify every Solution Hub item as Standard Shared or Enterprise,
- remove VPS-like resource promises,
- define safe usage/credit limits.

## G. Related Solution products

Continue LMS/webinar and other blueprints as separate/reusable product work without bloating Mkety Core.

---

# 43. LIVE LEGACY MKETY → NEW MKSAAS CUTOVER

Until the new platform is ready:

```text
MketyDigital/Mkety
= live/public legacy product
```

During development:

```text
MketyDigital/mksaas
= authoritative upgrade/new platform repository
```

Use legacy pages/pricing/Solution Hub to understand existing offers and avoid accidentally deleting useful market ideas.

Before production switch:

1. Verify core application features.
2. Verify tenancy/security.
3. Verify Cloudflare deployment architecture.
4. Verify Day-1 OCI persistent services.
5. Verify PostgreSQL migration/data plan.
6. Finalize plan entitlements and usage limits.
7. Rewrite public pricing and Solution Hub classifications.
8. Verify billing/payment paths.
9. Verify domains/routing.
10. Verify rollback strategy.
11. Explicitly obtain user authorization for cutover.

Do not make the legacy repository authoritative for new architectural choices.

---

# 44. WHAT NOT TO DO

Do not:

- treat the legacy Mkety repo as the new architecture source of truth,
- switch production before the upgraded platform is verified,
- install optional infrastructure on OCI Day 1,
- install LiteLLM Day 1 without a demonstrated need,
- install Uptime Kuma Day 1 merely because it was previously listed,
- install Qdrant before pgvector is shown insufficient,
- make Flowise/Activepieces/n8n mandatory Mkety Core dependencies,
- host ordinary Starter sites on OCI,
- allocate OCI RAM/CPU per ordinary Deploy customer,
- place arbitrary customer products on the Mkety Core free VM,
- place existing trading systems on the Mkety Core VM,
- place existing MTProto/userbots on the Mkety Core VM,
- advertise physical CPU/RAM for serverless plans,
- expose internal cloud provider names as Mkety product names,
- hard-code one AI provider,
- create cross-tenant queries,
- store secrets in Git,
- add Open edX to core v1,
- build a giant LMS into core,
- claim startup acceptance/traction/certification that does not exist,
- make Africa-limited wording the default global product language,
- spend for heavy managed infrastructure before customer demand or an Enterprise budget justifies it,
- claim production readiness from a successful build alone.

---

# 45. TESTING / VERIFICATION STANDARD

For each major feature:

1. Type-check.
2. Lint.
3. Unit tests where appropriate.
4. Integration tests for APIs/data boundaries.
5. Browser verification of important UX.
6. Mobile check for customer-facing flows.
7. Authorization allowed/denied tests.
8. Tenant isolation tests.
9. Failure-state tests.
10. Deployment build/runtime verification.
11. Where relevant, background-job success/retry/failure tests.
12. Usage-metering verification.

Do not call a feature complete without evidence appropriate to its risk.

---

# 46. SOURCE CONTROL / AI DEVELOPMENT WORKFLOW

Primary development repository:

`MketyDigital/mksaas`

Default branch:

`main`

Use feature branches for significant changes where appropriate.

For every new AI coding session:

### Step 1 — Read

- this `agents.md`,
- repository README/docs,
- relevant feature code,
- recent commits.

### Step 2 — Establish actual state

Use code, schema, tests, Git history, and deployment logs.

### Step 3 — Preserve locked architecture

Especially:

```text
Cloudflare = standard application/edge/runtime
OCI core VM = Coolify + PostgreSQL + Redis + Mkety Worker only on Day 1
Heavy/customer-specific = Enterprise architecture
```

### Step 4 — Implement smallest correct increment

Avoid broad rewrites and duplicate systems.

### Step 5 — Verify

Use tests/build/browser/runtime checks appropriate to the change.

### Step 6 — Update this document

When a major architecture/product decision changes, record it here.

---

# 47. MASTER ONE-PAGE VIEW — CURRENT

```text
                                  MKETY
                                    │
                  AI-powered global business platform
                                    │
     ┌──────────────────────────────┼──────────────────────────────┐
     │                              │                              │
 AI Agents                    Automation                      Deploy
 Knowledge                    Workflows                       Sites
 Tools                        Integrations                    Apps/APIs
     │                              │                              │
     └──────────────────────────────┼──────────────────────────────┘
                                    │
                              Solution Hub
                                    │
                 ┌──────────────────┴──────────────────┐
                 │                                     │
          Standard / Shared                       Enterprise
      transparent subscriptions                  Custom pricing
                 │                                     │
       Cloudflare-first Mkety             infrastructure selected
          shared platform                  per agreement / budget
                 │                                     │
        ┌────────┼────────┐                            │
        │        │        │                            │
      Pages    Workers     R2                 Dedicated/customer-
        │        │        │                   specific resources
        └────────┼────────┘
                 │
             PostgreSQL
                 │
          OCI CORE FREE VM
         2 OCPU / 16 GB RAM
                 │
      ┌──────────┼──────────┐
      │          │          │
   Coolify     Redis    Mkety Worker
```

PostgreSQL is part of the locked OCI core stack even though shown as the central data layer in the conceptual diagram.

---

# 48. FINAL ARCHITECTURAL PRINCIPLE — LOCKED

Mkety is a **global AI-powered product platform**, not a bundle of cloud-provider services.

Mkety should be enterprise-capable underneath while remaining simple to customers.

The standard shared product should be **Cloudflare/serverless-first** because this allows Mkety to serve many light customers without assigning permanent VM resources to each one.

The small OCI free VM should remain a **persistent support layer**, not the primary web runtime and not a customer hosting pool.

Day-1 OCI is locked to:

```text
Coolify
PostgreSQL
Redis
Mkety Worker
```

No other persistent service is Day-1 mandatory.

Heavy/dedicated workloads are Enterprise. Their infrastructure is selected according to actual technical requirements, customer agreement, available startup/provider credits, reliability needs, and budget.

Infrastructure should remain invisible to ordinary users. The customer buys **Mkety capabilities**, not Cloudflare, OCI, Redis, Coolify, or PostgreSQL.

Mkety may initially win strongly in Africa, but the product, pricing language, website, brand, architecture, and startup narrative remain completely global.

The long-term objective is to build Mkety as a credible AI-first software company with reusable platform capabilities, recurring product revenue, scalable architecture, strong tenant isolation, and a disciplined cost model that can grow from startup/free resources into paid infrastructure only when real usage justifies it.

---

# 49. HAND-OFF TO THE NEXT AI

If you are a new AI agent continuing Mkety:

> Read this entire file before proposing architecture.
>
> Work in `MketyDigital/mksaas` for the new platform. Treat `MketyDigital/Mkety` as the still-live legacy/reference product until explicit cutover.
>
> Do not ask the user to repeat decisions documented here.
>
> Keep normal Mkety customer experience provider-agnostic: everything is Mkety.
>
> Preserve the locked Day-1 OCI stack: **Coolify + PostgreSQL + Redis + Mkety Worker on 2 OCPU / 16 GB RAM.**
>
> Keep standard Starter/Deploy/AI/Automation/Solution Hub products Cloudflare/serverless-first when technically appropriate.
>
> Do not revive ordinary Trading/MTProto/trade-copy infrastructure inside Mkety Core; Trading is Enterprise/Custom.
>
> Do not install optional services merely because an older discussion listed them.
>
> Position Mkety globally and AI-first, including in startup-provider applications, while remaining truthful about actual implementation and traction.
>
> Inspect the repository to determine what is IMPLEMENTED versus PLANNED, then continue from the existing code instead of rebuilding from zero.

---

_Last maintained as the living Mkety platform architecture, product-positioning, and AI-development hand-off document._