#####start:DO NOT ADD ANYTHING INSIDE HERE ADD ABOVE OR BELLOW AFTER THE END:start########
# Mkety — Master Architecture, Product Blueprint & AI Development Guide

> **D ocument status:** Master Blueprint
> **Authority:** Current Mkety architecture and development source of truth
> **Repository:** `mksaas`
> **Primary domain:** `mkety.com`
> **Platform:** `app.mkety.com`
> **API:** `api.mkety.com`
> **Last architectural revision:** September 2026

---

# 00. DOCUMENT AUTHORITY

This document is the authoritative blueprint for the Mkety ecosystem and the `mksaas` repository.

It exists so that human developers and AI coding agents can continue Mkety development without reconstructing the architecture from historical conversations, old repositories, abandoned implementations, or assumptions.

## 00.1 Current authority

The current architecture is:

```text
Mkety
│
├── Mkety Platform
│   ├── AI
│   ├── Automate
│   ├── Deploy
│   ├── Workspaces
│   ├── SolutionHub
│   ├── Billing / Plans / Pricing
│   └── Platform Administration
│
├── Mkety Academy
│
└── Enterprise / Customer Solutions
    ├── Trading
    ├── mklms
    └── Future customer projects
```

The `mksaas` repository is becoming the authoritative development repository for the Mkety Platform and Mkety public website.

---

# 01. CRITICAL ARCHITECTURAL DECISIONS

These decisions override older assumptions in historical documentation.

## 01.1 Mkety is not an AI-only company

Mkety is a technology platform combining:

* AI
* application building
* deployment
* automation
* integrations
* cloud infrastructure
* ready-made solutions
* business tooling
* education
* enterprise solutions

AI is one major capability of Mkety Platform, not the entire definition of Mkety.

---

## 01.2 Mkety has two primary products

### Product 1 — Mkety Platform

The primary SaaS/PaaS product.

It provides the unified environment for:

* AI
* Agents
* Knowledge
* Tools
* Models
* Automation
* Workflows
* Integrations
* Applications
* APIs
* Websites
* Deployment
* Domains
* Solutions
* Templates
* Usage
* Credits
* Billing
* Teams
* Projects
* Infrastructure management

Primary application:

```text
https://app.mkety.com
```

---

### Product 2 — Mkety Academy

Mkety's education/training product.

It can provide:

* digital technology training
* AI training
* business technology training
* practical implementation courses
* workshops
* webinars
* certifications
* learning portals
* enterprise training

Academy is a real Mkety product, but it does not need to dominate the public Mkety homepage.

---

# 02. ENTERPRISE / CUSTOMER SOLUTION BOUNDARY

Not everything built by Mkety is a core Mkety Platform workspace.

Mkety can build specialized enterprise/customer systems.

Examples:

```text
Mkety
│
├── Core Products
│   ├── Mkety Platform
│   └── Mkety Academy
│
└── Enterprise / Customer Solutions
    ├── Trading
    ├── mklms
    └── Future projects
```

Enterprise projects can consume Mkety infrastructure and shared services without becoming core Platform workspaces.

Examples of reusable shared services:

* identity
* authentication
* billing
* payment processing
* APIs
* notifications
* storage
* deployment infrastructure
* organization management
* usage accounting

---

# 03. TRADING WORKSPACE

## 03.1 Trading remains visible in the frontend

Trading is still represented as a workspace/solution in the Mkety Platform interface.

It should **not be removed from the frontend workspace presentation**.

The user should be able to see Trading alongside the other Mkety workspace categories.

---

## 03.2 Trading is Enterprise / Custom

Trading should be labelled and priced as:

```text
Custom
```

or

```text
Enterprise
```

depending on the exact UI context.

It is not part of the normal self-service Platform subscription feature set.

The public/product presentation should communicate that Trading is a specialized business solution available through custom/enterprise engagement.

---

## 03.3 Trading is architecturally standalone

Trading is different from the normal Platform workspaces.

Conceptually:

```text
Mkety Platform
│
├── AI
├── Automate
├── Deploy
├── Solutions
└── Trading
      │
      └── Standalone Enterprise Application
```

Trading can share:

* ZITADEL identity
* Mkety organization identity
* payment/billing interfaces
* selected Mkety APIs
* shared infrastructure patterns

But Trading should not be implemented as though its internal application is simply another AI/automation module.

---

## 03.4 Trading frontend presentation

The Trading workspace should contain a concise business-solution summary explaining what Mkety can provide.

Possible capability categories include:

* trading automation
* signal workflows
* trading integrations
* execution infrastructure
* specialized automation
* enterprise trading tooling
* custom integrations
* monitoring
* specialized deployments

The exact capabilities shown publicly must reflect what Mkety actually supports.

Do not invent production capabilities merely to make the product appear larger.

---

# 04. MKLMS

`mklms` is an enterprise/customer project.

It is **not a third Mkety core product**.

It is an example of what Mkety can build for customers.

```text
Mkety Platform
       │
       └── Enterprise Services
              │
              └── Customer Project
                     └── mklms
```

`mklms` may use:

* Mkety authentication
* Mkety payment infrastructure
* Mkety APIs
* Mkety deployment infrastructure
* Mkety storage
* Mkety shared services

But its codebase remains independently deployable.

The same model applies to future customer projects.

---

# 05. REPOSITORY STRATEGY

## 05.1 `mksaas` is the new Mkety development authority

The `mksaas` repository began as a SaaS/template foundation.

Mkety is now turning that foundation into the actual Mkety Platform.

The correct mental model is:

```text
mksaas template
       ↓
customize
       ↓
add Mkety functionality
       ↓
apply Mkety brand/content
       ↓
Mkety Platform
```

We are **not** throwing away the mksaas architecture/design and rebuilding an unrelated system.

---

## 05.2 Legacy `mkety` repository

The old `mkety` repository currently contains the live public website.

### Critical rule

**Do not modify the old `mkety` main branch while it remains the live public site.**

It is the protected legacy production reference until the new site is ready for cutover.

The old repository contains valuable historical/reference material, including:

* original Mkety blueprint
* pricing concepts
* product descriptions
* Academy material
* old public-site copy
* business positioning
* existing Mkety AI behavior/reference

Important legacy files include:

```text
mketyv1.txt
mketypricing.txt
```

These are references, not the current authority.

---

# 06. SINGLE-REPOSITORY TARGET

The target architecture is:

```text
mksaas
│
├── Public Mkety Website
│
├── Mkety Platform
│
├── Shared UI
│
├── Shared Application Infrastructure
│
├── Authentication / Identity integration
│
├── Billing abstraction
│
├── Payment abstraction
│
├── AI infrastructure
│
├── Automation infrastructure
│
├── Deployment infrastructure
│
├── Solutions / SolutionHub
│
├── Domains
│
├── Usage / Credits
│
├── Teams / Organizations
│
├── Administration
│
└── Documentation
```

This is the primary development repository.

---

# 07. MKSaaS DESIGN PRINCIPLE

## 07.1 Preserve the mksaas visual DNA

The Mkety frontend should look like it belongs to the mksaas design family.

Keep and leverage:

* premium SaaS visual language
* modern typography
* card systems
* animations
* transitions
* interactive elements
* hover effects
* polished components
* layout techniques
* spacing systems
* responsive behavior
* visual hierarchy
* technical/product aesthetic

Do not unnecessarily redesign the visual framework from scratch.

---

## 07.2 Make it Mkety

The result must nevertheless be branded and structured as Mkety.

Change:

* brand colors
* logos
* terminology
* navigation
* copy
* product descriptions
* pricing language
* workspace naming
* product hierarchy
* information order
* page composition

The Mkety website may move sections:

* up
* down
* into tabs
* into cards
* into expandable panels
* into product sections

This is intentional.

The objective is:

```text
mksaas design language
        +
Mkety identity
        +
Mkety information architecture
        =
Mkety
```

---

# 08. MKETY BRAND DIRECTION

Primary visual identity:

* Mkety violet/purple brand color
* white
* technical dark tones
* modern technology aesthetic

The design should feel:

* premium
* technical
* modern
* credible
* compact
* intelligent
* business-oriented
* approachable

Avoid making the website look like a generic AI startup.

Mkety must communicate that it is a broader technology platform.

---

# 09. MKETY.COM PUBLIC WEBSITE

Primary domain:

```text
mkety.com
```

The public website is the company's primary marketing and product-entry surface.

It must be sufficiently complete and credible for:

* customers
* partners
* startup programs
* technology providers
* enterprise prospects
* Academy users

---

# 10. PUBLIC SITE INFORMATION ARCHITECTURE

The public site should use a tab-oriented/interactive structure rather than becoming an extremely long conventional landing page.

Potential primary navigation:

```text
Home
Platform
Solutions
Academy
Pricing
Enterprise
About
Sign In
Get Started
```

Exact labels can be refined during implementation, but the structure should remain compact and tab-driven.

---

# 11. PUBLIC WEBSITE PRODUCT POSITIONING

The public website should clearly communicate:

## Mkety Platform

The core technology platform for:

```text
Build
Automate
Deploy
Use AI
Integrate
Operate
```

## Mkety Academy

Training and education for practical technology adoption.

## Enterprise

Custom technology solutions and specialized implementations.

Trading may appear under the enterprise/solutions presentation, but should not be positioned as a third primary consumer product.

---

# 12. PUBLIC MKETY AI

The public website contains a Mkety AI box/assistant.

This is **not the Platform Agent Builder**.

There are two different AI experiences.

## Public AI

Location:

```text
mkety.com
```

Purpose:

* answer visitor questions
* explain Mkety
* explain products
* help visitors navigate the site
* explain plans
* explain solutions
* direct visitors toward relevant products

It is effectively a public-facing Mkety assistant.

---

## Platform AI

Location:

```text
app.mkety.com
```

Purpose:

* create agents
* configure agents
* use knowledge
* use tools
* select models
* execute AI tasks
* publish agents
* run AI applications
* integrate AI into workflows

These systems must remain conceptually and technically separate.

---

# 13. MKETY PLATFORM

Primary URL:

```text
app.mkety.com
```

Mkety Platform is the main SaaS/PaaS product.

Its central concept is a unified workspace.

---

# 14. PLATFORM CORE MODEL

```text
Organization
    │
    ├── Users
    ├── Teams
    │
    └── Projects
          │
          ├── AI
          ├── Automation
          ├── Deployments
          ├── Domains
          ├── Solutions
          └── Usage
```

The Platform must be multi-tenant.

Tenant isolation is mandatory.

---

# 15. WORKSPACES

The term **Workspace** is a central Mkety product concept.

The Platform should present capabilities as clear workspaces rather than exposing internal implementation details.

Core workspace structure:

```text
Workspaces
│
├── AI
├── Automate
├── Deploy
├── Solutions / SolutionHub
└── Trading
```

Trading is visually included but architecturally standalone.

---

# 16. AI WORKSPACE

The AI workspace contains the AI-building environment.

Core areas:

```text
AI
│
├── Agents
├── Agent Builder
├── Knowledge
├── Tools
├── Models
├── AI Applications
├── Runs
└── Versions
```

---

# 17. AGENTS

Users can create and manage AI agents.

Agent functionality includes:

* configuration
* instructions
* model selection
* tools
* knowledge
* runtime
* testing
* versioning
* publishing
* execution history

Agents belong to the correct tenant/project scope.

---

# 18. AGENT BUILDER

The Agent Builder is the primary environment for constructing agents.

It should eventually support:

* system instructions
* model configuration
* temperature/behavior controls where supported
* knowledge sources
* tools
* integrations
* runtime settings
* memory where implemented
* structured outputs where required
* testing
* versioning
* publishing

---

# 19. KNOWLEDGE

Knowledge provides RAG/knowledge capabilities.

Current foundation includes:

* knowledge documents
* ingestion
* chunking
* metadata
* embeddings/retrieval foundation
* agent knowledge association

Future architecture may add additional vector/search infrastructure when actual scale requires it.

Do not automatically deploy Qdrant or another vector database without a concrete requirement.

---

# 20. TOOLS

Tools allow agents to perform actions beyond generation.

Examples:

* HTTP/API calls
* internal platform operations
* integrations
* business actions
* workflow actions
* future connector tools

Tools must be tenant/project scoped where applicable.

---

# 21. MODELS

Models are an abstraction layer.

The platform should not hard-code the entire product around one AI provider.

Potential providers include:

* OpenAI
* Google/Gemini
* Anthropic
* Groq
* other approved providers

Provider availability must be controlled by configuration and product entitlement.

---

# 22. AI APPLICATIONS

Agents can eventually become deployable AI applications.

Potential forms:

* chat applications
* embedded assistants
* API agents
* customer support agents
* internal business agents
* workflow agents
* specialized enterprise applications

---

# 23. AUTOMATE WORKSPACE

The Automate workspace is the workflow automation layer.

It is independent of the AI workspace, although AI can be used as an action inside automation.

Core model:

```text
Trigger
   ↓
Workflow
   ↓
Actions
   ↓
Conditions / Transformations
   ↓
Result
```

---

# 24. AUTOMATION FEATURES

Required foundation:

* workflow persistence
* workflow CRUD
* workflow definitions
* node model
* manual execution
* webhook execution
* execution history
* run records
* HTTP/API action
* transform action
* condition/action
* agent action
* variable interpolation
* failure recording
* bounded retries
* generic webhook foundation

---

# 25. AUTOMATION EXECUTION

Automation executions must be:

* tenant scoped
* project scoped
* auditable
* observable
* bounded
* failure-aware

Retries must use controlled behavior such as exponential backoff.

Avoid infinite retries.

---

# 26. INTEGRATIONS

Integrations are a Platform capability.

Architecture:

```text
Mkety Integration Layer
│
├── Generic HTTP
├── Webhooks
├── Provider adapters
├── OAuth/connectors
└── Internal Mkety integrations
```

Provider-specific adapters should be introduced when there is an actual product requirement.

Do not create dozens of integrations prematurely.

---

# 27. DEPLOY WORKSPACE

Deploy is the application deployment layer.

It should allow users to manage:

* websites
* applications
* APIs
* services
* environments
* domains
* deployments
* deployment history
* deployment status
* configuration

---

# 28. DEPLOYMENT MODEL

Conceptually:

```text
Project
  │
  └── Application
       │
       ├── Development
       ├── Preview
       └── Production
```

Deployments must support controlled environments.

---

# 29. DOMAINS

Mkety supports:

* Mkety-managed application domains
* custom domains
* customer-owned domains
* deployment hostnames
* preview domains

Primary domain architecture:

```text
mkety.com
app.mkety.com
api.mkety.com
origin.mkety.com

*.mkety.app
```

---

# 30. DOMAIN PURPOSES

## `mkety.com`

Corporate/public website.

## `app.mkety.com`

Main Mkety Platform.

## `api.mkety.com`

Public/platform API.

## `origin.mkety.com`

Dedicated origin/fallback hostname for infrastructure routing.

It should point to a real Mkety routing/origin layer.

It must not exist merely as a placeholder.

## `*.mkety.app`

Customer-facing production, Development/preview applications.
---

# 31. CLOUDFLARE FOR SAAS

Cloudflare is responsible for the edge/domain layer.

Expected capabilities:

* DNS
* CDN
* SSL
* WAF
* Workers
* Pages
* R2
* custom hostnames
* Cloudflare for SaaS
* routing

Customer custom hostnames should be created and managed through the Mkety backend as required.

Do not create a giant wildcard custom-hostname architecture prematurely.

---

# 32. SOLUTIONHUB

**SolutionHub** is a major Mkety product concept.

It is the place where users discover ready-to-use business solutions rather than assembling everything from zero.

SolutionHub can contain:

* ready-made solutions
* templates
* workflows
* AI agents
* AI applications
* deployment templates
* business automations
* industry blueprints
* integrations
* starter projects

Concept:

```text
SolutionHub
│
├── AI Solutions
├── Automation Solutions
├── Deployment Solutions
├── Business Solutions
├── Industry Solutions
└── Enterprise Solutions
```

---

# 33. SOLUTIONHUB VS WORKSPACES

These are different concepts.

### Workspaces

Where users operate/build/manage capabilities.

Examples:

```text
AI
Automate
Deploy
Trading
```

### SolutionHub

Where users discover packaged solutions.

Example:

```text
Customer Support AI
Lead Capture Automation
Telegram Workflow
Business Website
AI Knowledge Assistant
Marketing Automation
```

SolutionHub can launch or provision assets into the user's workspace/project.

---

# 34. TRADING AND SOLUTIONHUB

Trading can appear in SolutionHub as an enterprise solution category.

For example:

```text
Trading Automation
Custom
Enterprise
```

The underlying Trading application remains standalone.

---

# 35. PLANS

**Plans** are the commercial packages users subscribe to.

Plans determine high-level commercial access.

A plan may define:

* included features
* workspace access
* usage limits
* AI credits
* deployment credits
* storage
* projects
* team members
* integrations
* support level
* domain capabilities
* enterprise eligibility

Plans must not be confused with individual usage counters.

---

# 36. PRICING

**Pricing** is the public/commercial presentation of plans and services.

Pricing should explain:

* what each plan includes
* limits
* included credits
* included usage
* billing period
* upgrade path
* enterprise/custom options

Pricing must remain aligned with actual backend entitlements.

Never advertise an entitlement that the system cannot enforce or provide.

---

# 37. CUSTOM / ENTERPRISE PRICING

Some capabilities are not normal subscription features.

These include specialized solutions such as Trading and major enterprise/customer implementations.

The UI should communicate:

```text
Custom
```

or

```text
Enterprise
```

rather than inventing a fixed consumer price.

---

# 38. BILLING ARCHITECTURE

Mkety owns the commercial abstraction.

The architecture should not require every product/project to implement payment providers independently.

Concept:

```text
Mkety Billing
│
├── Plans
├── Subscriptions
├── Entitlements
├── Wallet
├── Credits
├── Usage
├── Ledger
├── Invoices
├── Audit Logs
└── Payments
     ├── Selar
     └── NOWPayments
```

---

# 39. PAYMENT ABSTRACTION

The payment architecture should be reusable.

Do not implement:

```text
mklms → Selar directly
Trading → Selar directly
Platform → Selar directly
```

Instead:

```text
Product / Project
       ↓
Mkety Billing / Payment Interface
       ↓
Mkety Payment Worker
       ↓
Provider Adapter
       ├── Selar
       └── NOWPayments
```

This allows provider implementations to be changed without rewriting every product.

---

# 40. SELAR / NOWPAYMENTS

Initial payment providers:

* Selar
* NOWPayments

The existing Mkety/reference implementation should be treated as the behavioral reference for the payment flow.

The implementation must preserve:

* webhook handling
* payment verification
* transaction recording
* subscription/payment state
* appropriate product entitlement
* idempotency
* auditability

Provider-specific implementation details should remain behind the payment abstraction.

---

# 41. WALLET

Wallet is the user's commercial balance/credit interface where applicable.

Possible balances include:

* platform balance
* AI credits
* deployment credits
* other metered credits

Wallet operations must be ledger-backed.

Never modify balances without an auditable transaction.

---

# 42. USAGE METERING

Usage must be measurable.

Potential usage dimensions:

* AI tokens
* AI requests
* agent executions
* workflow executions
* deployment resources
* storage
* bandwidth
* runtime
* API calls
* other metered resources

Usage should feed:

```text
Usage
 ↓
Ledger
 ↓
Credits / Entitlements
 ↓
Billing
```

---

# 43. CREDITS

Credits are not the same thing as money.

Examples:

* AI credits
* deployment credits

The system must clearly distinguish:

```text
Money
Credits
Usage
Entitlements
```

---

# 44. LEDGER

The ledger is the financial/accounting history.

It must be append-oriented and auditable.

Track:

* credits granted
* credits consumed
* refunds
* payments
* adjustments
* usage charges
* entitlement changes

Avoid destructive balance manipulation.

---

# 45. SUBSCRIPTIONS

Subscription state should include appropriate lifecycle states such as:

* pending
* active
* past due
* cancelled
* expired

Exact implementation must reflect the payment provider and business requirements.

---

# 46. INVOICES

Invoices must be generated from authoritative billing records.

Never rely only on frontend calculations.

---

# 47. AUDIT LOGS

Important commercial and administrative events must be auditable.

Examples:

* subscription changes
* payment events
* refunds
* credit grants
* entitlement changes
* admin adjustments
* organization changes
* security-sensitive changes

---

# 48. IDENTITY

ZITADEL is the intended identity foundation.

The architecture should support shared identity across appropriate Mkety services.

Potential applications:

```text
Mkety Platform
Mkety Academy
Trading Enterprise
Customer Projects
```

Sharing identity does not mean sharing application code.

---

# 49. IDENTITY BOUNDARY

Identity:

```text
Who is the user?
```

Authorization:

```text
What can the user access?
```

Entitlements:

```text
What has the organization purchased?
```

Project membership:

```text
Which project can the user access?
```

These must not be collapsed into one concept.

---

# 50. MULTI-TENANCY

Multi-tenancy is fundamental.

Every tenant-scoped resource must enforce tenant isolation.

Current foundation includes:

* tenants
* projects
* users
* agent ownership
* workflow ownership
* execution ownership
* knowledge ownership

Never trust tenant IDs supplied by the browser without server-side authorization.

---

# 51. ORGANIZATIONS / TEAMS

Platform structure:

```text
Organization
│
├── Members
├── Teams
├── Projects
├── Plans
├── Billing
├── Usage
└── Resources
```

Future authorization should support role-based access.

---

# 52. PROJECTS

Projects provide resource boundaries.

Examples:

```text
Project A
├── Agents
├── Knowledge
├── Tools
├── Workflows
└── Deployments

Project B
├── Agents
├── Workflows
└── Applications
```

Resources should not accidentally cross project boundaries.

---

# 53. CURRENT TECHNOLOGY FOUNDATION

The current mksaas foundation includes:

* Next.js
* React
* TypeScript
* Drizzle ORM
* PostgreSQL
* AI SDK
* multi-tenant application structure

Current known versions at the time of this blueprint include:

```text
Next.js 16.2.4
AI SDK 6
```

Version numbers are implementation facts, not architectural guarantees.

Agents must inspect the actual repository before changing dependencies.

---

# 54. DATABASE

PostgreSQL is the primary relational datastore.

Current schema namespace:

```text
saas_template
```

The schema may eventually be renamed or migrated when appropriate, but this must be an intentional migration, not an incidental code change.

---

# 55. REDIS

Redis is part of the intended OCI core infrastructure where required.

Potential uses:

* queues
* caching
* transient state
* rate limiting
* job coordination

Do not use Redis as the authoritative source for durable business data.

---

# 56. OCI

OCI is the Day-1 persistent compute/infrastructure layer.

The current target core is approximately:

```text
OCI
└── 2 OCPU / 16 GB VM
```

with:

```text
Coolify
PostgreSQL
Redis
Mkety Worker
```

Only add additional infrastructure when the product actually requires it.

---

# 57. CLOUDFLARE + OCI

Primary architecture:

```text
INTERNET
    │
    ▼
CLOUDFLARE
    ├── DNS
    ├── CDN
    ├── WAF
    ├── Pages
    ├── Workers
    ├── R2
    └── SaaS / Custom Hostnames
          │
          ▼
    MKETY APPLICATION / API
          │
          ▼
         OCI
          ├── PostgreSQL
          ├── Redis
          ├── Mkety Worker
          └── Coolify
```

---

# 58. NO VERCEL PRODUCTION ARCHITECTURE

Vercel is no longer part of the target Mkety production architecture.

Do not introduce Vercel into new deployment planning.

Production development/testing must target:

```text
Cloudflare
+
OCI
```

Cloudflare Pages/Workers should be used where appropriate.

OCI provides persistent backend/compute workloads where required.

---

# 59. OTHER CLOUDS

Azure, AWS, GCP and other providers are future infrastructure options.

They are not required for Day 1.

They may be introduced for:

* customer workloads
* enterprise requirements
* specialized infrastructure
* cost optimization
* regional deployment
* workload scaling
* provider-specific capabilities

Architecture must remain cloud-portable where practical.

Startup credits must not dictate bad architecture.

---

# 60. COOLIFY

Coolify is the current deployment/control layer for OCI-hosted services where appropriate.

It can manage:

* containers
* applications
* services
* deployment workflows

Do not assume every future service belongs on the same VM.

---

# 61. MKETY WORKER

The Mkety Worker is a reusable backend processing layer.

Potential responsibilities:

* payment processing
* webhooks
* background jobs
* usage processing
* asynchronous automation
* provider integrations
* scheduled tasks

Workers should be isolated from synchronous web request handling where workloads require asynchronous execution.

---

# 62. CLOUDflare WORKERS

Cloudflare Workers can handle:

* edge APIs
* routing
* lightweight business logic
* webhooks
* authentication-aware edge operations
* domain routing
* integration endpoints
* API gateways

Do not move heavyweight persistent workloads to Workers merely because Workers exist.

---

# 63. R2

Cloudflare R2 is the preferred object storage layer where appropriate.

Potential uses:

* uploaded files
* course assets
* application assets
* generated files
* deployment artifacts
* media

Access should use controlled signed URLs or appropriate authorization.

---

# 64. SECURITY

Security is a system requirement, not a final feature.

Required principles:

* tenant isolation
* server-side authorization
* least privilege
* secret isolation
* encrypted transport
* secure cookies/tokens
* webhook verification
* idempotency
* rate limiting
* audit logs
* secure file access
* safe logging

---

# 65. SECRETS

Never place real secrets inside:

```text
agents.md
source code
Git commits
documentation
frontend bundles
logs
```

Document only:

* secret name
* purpose
* environment
* owner
* provider
* required scope

---

# 66. SECRET MAP

Expected categories:

```text
Agent / Infrastructure Secrets
│
├── GitHub
│   ├── repository access
│   └── GitHub App credentials
│
├── Cloudflare
│   ├── Account ID
│   ├── API credentials
│   └── SaaS/custom-hostname credentials
│
├── OCI
│   ├── tenancy configuration
│   ├── compartment configuration
│   └── deployment credentials
│
├── PostgreSQL
│
├── Redis
│
├── ZITADEL
│
├── Payments
│   ├── Selar
│   └── NOWPayments
│
└── AI Providers
    ├── OpenAI/Azure OpenAI
    ├── Gemini/google vertex AI
    ├── Anthropic
    ├── cloudflare AI, awsbedrock,Groq
    └── approved providers
```

Actual values belong only in secure environment/secret storage.

---

# 67. SECRET RULES FOR AI AGENTS

An AI agent must never:

* print a secret
* commit a secret
* place a secret in documentation
* hard-code API keys
* expose server secrets to the browser
* paste credentials into generated code
* log authentication tokens

Agents should use existing environment variable names whenever possible.

---

# 68. ACADEMY ARCHITECTURE

Mkety Academy is a primary Mkety product but does not need to be tightly coupled to Platform application internals.

Possible Academy architecture:

```text
Mkety Academy
│
├── Courses
├── Lessons
├── Webinars
├── Students
├── Registrations
├── Certificates
├── Payments
└── Community / integrations
```

It can consume shared Mkety services.

---

# 69. COURSE / WEBINAR PLATFORM

Known Academy direction includes:

* self-paced courses
* protected course access
* recorded/on-demand webinar experiences
* registration flows
* timers
* community links
* automated certification
* private learning environments

Media architecture should be selected according to actual cost and scale requirements.

Do not force YouTube/Vimeo into the architecture.

---

# 70. ENTERPRISE CUSTOMER PROJECT ARCHITECTURE

Future customer applications should generally follow:

```text
Customer Project
      │
      ├── Own frontend/application
      ├── Own deployment
      ├── Own project resources
      │
      └── Mkety Shared Services
             ├── Identity
             ├── Billing
             ├── Payments
             ├── APIs
             └── Infrastructure
```

This prevents customer-specific requirements from polluting the core Mkety Platform.

---

# 71. PUBLIC SITE VS PLATFORM

This distinction is mandatory.

```text
mkety.com
│
└── Public Mkety experience
     ├── company
     ├── products
     ├── pricing
     ├── solutions
     ├── academy
     └── public Mkety AI
```

versus:

```text
app.mkety.com
│
└── Authenticated Platform
     ├── Workspaces
     ├── Projects
     ├── AI
     ├── Automate
     ├── Deploy
     ├── SolutionHub
     ├── Trading
     ├── Billing
     └── Administration
```

---

# 72. PLATFORM NAVIGATION CONCEPT

The application should feel like a unified operating environment.

Example:

```text
Dashboard

Workspaces
  AI
  Automate
  Deploy
  Trading

SolutionHub

Projects

Usage

Plans / Pricing

Billing

Domains

Integrations

Team

Administration
```

Exact UI placement can change.

The conceptual separation must remain.

---

# 73. PLANS VS WORKSPACES VS SOLUTIONS VS PRICING

These four terms must remain semantically distinct.

## Plans

Commercial packages.

```text
What subscription level do I have?
```

## Workspaces

Functional operating environments.

```text
What can I work with?
```

## SolutionHub

Ready-made solutions.

```text
What can I deploy/use without building everything myself?
```

## Pricing

Commercial explanation and purchase interface.

```text
What does it cost?
```

Never use these terms interchangeably.

---

# 74. PRODUCT EXPERIENCE

The Platform should progressively guide users from:

```text
Discover
   ↓
Choose Plan
   ↓
Create Workspace/Project
   ↓
Choose Solution OR Build
   ↓
Configure
   ↓
Test
   ↓
Deploy
   ↓
Operate
   ↓
Measure Usage
   ↓
Upgrade/Scale
```

---

# 75. CURRENT IMPLEMENTATION PROGRESS

The following functionality has already been substantially implemented in the mksaas foundation.

## Batch 1 — AI Foundation

Status:

```text
COMPLETE / IMPLEMENTED
```

Implemented foundation includes:

* multi-tenancy
* workspace
* projects
* agent persistence
* Agent Builder
* agent runtime
* AI test playground
* tools
* knowledge/RAG foundation
* version snapshotting
* versioning
* publishing
* published agent state/runtime
* tenant/project/agent isolation
* `agent_runs`

---

# 76. CURRENT AGENT RUN MODEL

The `agent_runs` model includes concepts such as:

* tenant ID
* project ID
* agent ID
* status
* messages
* output
* error
* token counts
* start time
* completion time

The implementation must remain tenant/project scoped.

---

# 77. AI SDK 6 RULES

The current AI SDK is version 6.

Known implementation differences include:

```text
maxSteps
```

being replaced by:

```text
stopWhen: stepCountIs(...)
```

and newer response APIs should be used.

Examples of current API direction include:

```text
toUIMessageStreamResponse()
```

rather than older APIs where applicable.

`convertToModelMessages` is asynchronous.

Agents must inspect the installed package version before applying API examples from memory.

---

# 78. BATCH 2 — AUTOMATION FOUNDATION

Batch 2 has been substantially implemented but must be considered **UNVERIFIED until rebuilt and tested on the new Cloudflare/OCI target architecture**.

Implemented concepts include:

* workflow persistence
* tenant/project scoped workflows
* workflow CRUD
* workflow definition JSON/node model
* manual execution
* webhook execution
* execution history
* workflow run records
* HTTP/API action
* transform action
* condition/action
* agent action
* variable interpolation
* failure recording
* bounded HTTP retries
* exponential backoff
* generic webhook integration foundation

---

# 79. CURRENT KNOWN BATCH 2 ISSUE

A previous build failed in:

```text
src/app/api/workflows/[workflowId]/route.ts
```

The issue involved:

```text
body.definition
```

being typed as generic `object` instead of:

```text
WorkflowDefinition
```

This must be verified against the current repository state before assuming it remains unresolved.

Do not blindly patch historical errors without checking the current code.

---

# 80. BATCH 3 — DEPLOYMENTS

Next major functional area:

```text
Deployments + Cloud
```

Expected areas:

* deployment persistence
* application records
* environments
* deployment state
* deployment history
* build/deployment orchestration
* domains
* custom domains
* preview deployments
* production deployments
* Cloudflare integration
* OCI integration
* application routing

---

# 81. BATCH 4 — BILLING / PRODUCTION HARDENING

After deployment foundations:

```text
Billing
+
Plans
+
Entitlements
+
Credits
+
Usage
+
Payments
+
Production hardening
```

This batch must integrate:

* Selar
* NOWPayments
* Mkety payment abstraction
* worker architecture
* usage
* ledger
* subscriptions
* plans
* entitlements

---

# 82. DEVELOPMENT ORDER

The overall roadmap is:

```text
PHASE 0
Architecture / Blueprint
        ↓
PHASE 1
Public Mkety Website
        ↓
PHASE 2
AI Foundation
        ↓
PHASE 3
Automation
        ↓
PHASE 4
Deployments / Cloud
        ↓
PHASE 5
SolutionHub
        ↓
PHASE 6
Plans / Pricing / Billing
        ↓
PHASE 7
Domains / Enterprise
        ↓
PHASE 8
Production Hardening
        ↓
PHASE 9
Scale / Multi-cloud / Enterprise
```

Existing code means parts of Phases 2–4 already exist and should be audited rather than recreated.

---

# 83. IMMEDIATE PRIORITY

The immediate priority is:

## Mkety public website

Before continuing large backend feature batches, convert the mksaas template into the Mkety public experience.

Requirements:

* use mksaas visual foundation
* apply Mkety branding
* preserve premium interactions
* use tabs/compact sections
* present Mkety Platform clearly
* present Academy
* explain Solutions/SolutionHub
* explain Workspaces
* explain Plans/Pricing
* include Enterprise
* keep Trading visible as Custom/Enterprise
* include public Mkety AI
* make the site application/startup-program ready

---

# 84. PUBLIC SITE DESIGN PRINCIPLE

Do not reproduce the old Mkety website visually.

Use the old site primarily as:

* content reference
* product reference
* brand reference
* Academy reference
* existing AI behavior reference

Use mksaas as:

* design reference
* component reference
* layout reference
* interaction reference
* animation reference
* implementation foundation

---

# 85. CONTENT MIGRATION RULE

When migrating old Mkety content:

```text
Old Mkety content
       ↓
review
       ↓
remove outdated positioning
       ↓
align with current architecture
       ↓
rewrite into current Mkety terminology
       ↓
implement in mksaas design
```

Do not blindly copy legacy content.

86. there is no other domain aside mkety.com(main and app, api, etc) and mkety.app(customers preview/customers apps)
# 87. PRICING LANGUAGE

Public pricing must use the current Mkety terminology.

Core commercial concepts:

```text
Plans
Pricing
Credits
Usage
Custom
Enterprise
```

The low-cost Nigeria-friendly commercial offering should not publicly be labelled an “African edition.”

Use the approved Lite Offer terminology where that offer is presented.

---

# 88. WORKSPACE LANGUAGE

Use:

```text
Workspace
```

for major functional areas.

Do not expose internal implementation labels where a customer-facing workspace name is clearer.

Example:

```text
AI Workspace
Automation Workspace
Deploy Workspace
Trading Workspace
```

---

# 89. SOLUTION LANGUAGE

Use:

```text
Solution
SolutionHub
Business Solution
Enterprise Solution
```

for packaged outcomes.

A solution is not necessarily a workspace.

---

# 90. AGENT CODING RULE

Before modifying code, an AI agent must:

1. Read this `agents.md`.
2. Inspect the current repository.
3. Identify whether the requested functionality already exists.
4. Inspect current schemas/types.
5. Check the actual package versions.
6. Check deployment assumptions.
7. Avoid duplicating existing abstractions.
8. Make the smallest architecture-consistent change that completes the intended batch.

---

# 91. NEVER ASSUME HISTORICAL CODE IS CURRENT

Historical conversations and logs are useful for context but are not automatically the current repository state.

An agent must verify:

* files
* branches
* schema
* migrations
* dependencies
* environment variables
* deployment configuration

before making decisions.

---

# 92. DEVELOPMENT BATCH SIZE

Use meaningful medium-sized development batches.

Preferred pattern:

```text
Plan batch
    ↓
Implement complete batch
    ↓
Run typecheck/build/tests
    ↓
Fix all related issues
    ↓
Deploy
    ↓
Verify
    ↓
Record progress
    ↓
Next batch
```

Avoid:

```text
one tiny edit
↓
build
↓
one tiny edit
↓
build
```

unless debugging a specific blocker.

---

# 93. DEPLOYMENT TESTING

All important production paths should ultimately be tested against:

```text
Cloudflare
+
OCI
```

Do not validate only against an unrelated deployment platform.

---

# 94. ENVIRONMENT STRATEGY

At minimum distinguish:

```text
Development
Preview/Test
Production
```

Environment-specific:

* databases
* API credentials
* payment credentials
* identity configuration
* Cloudflare resources
* OCI resources

must not be mixed accidentally.

---

# 95. MIGRATIONS

Database migrations must be:

* deterministic
* repeatable
* idempotent where practical
* tracked
* production-safe

Do not manually modify production schema without recording the corresponding migration.

---

# 96. DATABASE SAFETY

Before changing schema:

1. inspect current schema
2. inspect migration history
3. determine existing production state
4. create migration
5. test migration
6. apply migration
7. verify

Never assume a migration has not already been applied.

---

# 97. API DESIGN

API endpoints should:

* authenticate
* authorize
* validate input
* enforce tenant/project scope
* return predictable responses
* log safely
* avoid leaking internal errors
* handle idempotency where necessary

---

# 98. FRONTEND SECURITY

Never rely on:

* hidden UI elements
* disabled buttons
* frontend plan checks
* frontend tenant IDs

for security.

Backend authorization is authoritative.

---

# 99. ENTITLEMENT SYSTEM

Plan access must eventually be represented by an entitlement system.

Concept:

```text
Plan
 ↓
Entitlements
 ↓
Organization
 ↓
Workspace / Project
 ↓
Feature access
```

This is preferable to scattering:

```text
if plan === "pro"
```

throughout the codebase.

---

# 100. FEATURE FLAGS

Use feature flags where a capability is:

* experimental
* staged
* enterprise-only
* not yet generally available

Do not permanently encode temporary rollout logic into product architecture.

---

# 101. OBSERVABILITY

Production infrastructure should eventually provide:

* application logs
* worker logs
* deployment logs
* error tracking
* health checks
* usage metrics
* workflow execution status
* agent run status

Observability should not expose secrets or sensitive user data unnecessarily.

---

# 102. QUEUES / BACKGROUND JOBS

Use background jobs for workloads such as:

* long AI processing
* document ingestion
* media processing
* webhook processing
* payment reconciliation
* workflow jobs
* scheduled tasks

Do not make long-running operations depend entirely on browser requests.

---

# 103. RATE LIMITING

Rate limiting should eventually exist for:

* public APIs
* authentication
* AI execution
* workflow execution
* webhooks
* expensive operations

Limits should align with plan entitlements.

---

# 104. FILE STORAGE

File storage should be abstracted from application code where possible.

Current preferred ecosystem:

```text
Cloudflare R2
```

Use secure access mechanisms.

Do not expose unrestricted buckets.

---

# 105. CUSTOMER DOMAIN SECURITY

Customer domains must be treated as untrusted input.

Validate:

* hostname
* ownership
* certificate state
* routing state
* tenant ownership

Never allow arbitrary hostnames to bypass tenant routing.

---

# 106. ORIGIN SECURITY

Cloudflare should be the public edge.

The actual origin should not unnecessarily be exposed directly.

Future stronger architecture may include:

```text
Cloudflare
   ↓
Tunnel / protected routing
   ↓
OCI
```

The objective is to protect origin infrastructure rather than relying on obscurity.

---

# 107. `origin.mkety.com`

This hostname exists specifically for infrastructure/origin separation.

It should represent the actual Mkety origin/routing layer.

Do not:

* point it at a random server
* use it merely to satisfy a Cloudflare configuration
* mix it with the corporate website
* use it as a customer application namespace

---

# 108. ENTERPRISE CLOUD STRATEGY

Mkety should remain infrastructure-flexible.

A customer may eventually require:

```text
OCI
AWS
Azure
GCP
Customer infrastructure
```

The Platform architecture should support deployment abstractions rather than hard-coding every capability to one cloud provider.

---

# 109. MARKETPLACE / SOLUTIONHUB FUTURE

SolutionHub can eventually support:

* first-party Mkety solutions
* third-party solutions
* customer-created solutions
* templates
* paid solutions
* enterprise packages

Marketplace monetization should not be implemented until the underlying product model is ready.

---

# 110. ADMINISTRATION

Platform administration should eventually include:

```text
Administration
│
├── Users
├── Organizations
├── Projects
├── Plans
├── Subscriptions
├── Billing
├── Payments
├── Credits
├── Usage
├── Agents
├── Workflows
├── Deployments
├── Domains
├── Integrations
├── Audit Logs
└── System Health
```

Administrative operations must be protected by appropriate roles.

---

# 111. PLATFORM AI VS ADMIN AI

If administrative AI is eventually introduced, it must not bypass authorization.

An AI agent must operate within the same authorization model as a human operator.

---

# 112. AI RUNTIME SAFETY

Agent execution must include:

* bounded execution
* controlled tool access
* timeout handling
* error recording
* usage tracking
* token tracking
* authorization
* tenant isolation

Avoid unlimited autonomous execution.

---

# 113. AGENT VERSIONING

Published agents should be reproducible.

Version snapshots should capture sufficient configuration to reproduce the published state.

Do not allow changing a draft configuration to silently mutate an already published version.

---

# 114. PUBLISHING MODEL

Conceptually:

```text
Draft
 ↓
Test
 ↓
Version
 ↓
Publish
 ↓
Published Runtime
```

Published versions should be identifiable.

---

# 115. WORKFLOW VERSIONING

The same principle should eventually apply to workflows.

Do not let editing a workflow silently change historical executions or published automation.

---

# 116. AUDITABILITY

Important actions should be attributable to:

* user
* organization
* project
* system/worker
* timestamp
* action
* affected resource

---

# 117. LOGGING RULE

Logs should contain enough information to debug failures without exposing:

* API keys
* access tokens
* passwords
* payment credentials
* private secrets
* unnecessary personal information

---

# 118. DOCUMENTATION RULE

Whenever a major architecture decision changes:

1. update `agents.md`
2. update affected documentation
3. update implementation status
4. record migration requirements
5. remove contradictory instructions

This prevents architectural drift.

---

# 119. HISTORICAL INFORMATION

Historical files such as:

```text
mketyv1.txt
mketypricing.txt
```

remain useful references.

However:

```text
agents.md
```

is the current authority.

If a historical document contradicts this document, this document wins unless the architecture is explicitly revised again.

---

# 120. CODE OWNERSHIP MODEL

Core Mkety Platform code belongs conceptually to:

```text
mksaas
```

Enterprise/customer applications belong to their own repositories.

Do not move customer-specific code into the core repository merely because it uses Mkety services.

---

# 121. SHARED SERVICE PRINCIPLE

Build reusable shared services once.

Examples:

```text
Identity
Billing
Payments
Usage
Notifications
Storage
Deployment
Domains
```

Then expose stable interfaces to other products/projects.

---

# 122. PAYMENT REUSE PRINCIPLE

The Selar/NOWPayments integration should be implemented once as the Mkety payment infrastructure.

Other products should call the Mkety payment interface.

This is especially important for:

```text
Mkety Platform
Mkety Academy
mklms
Enterprise projects
Trading
```

where commercial processing is required.

---

# 123. AVOID SERVICE SPRAWL

Do not automatically add:

* Flowise
* n8n
* Activepieces
* Qdrant
* LiteLLM
* MTProto services
* additional databases
* additional queues
* additional cloud providers

unless an actual requirement justifies them.

Mkety should begin with a lean core.

---

# 124. CURRENT DAY-1 INFRASTRUCTURE

Preferred starting architecture:

```text
Cloudflare
│
├── mkety.com
├── app.mkety.com
├── api.mkety.com
├── origin.mkety.com
├── *.mkety.app
├── Workers
├── Pages
└── R2

OCI
│
└── Core VM
    ├── Coolify
    ├── PostgreSQL
    ├── Redis
    └── Mkety Worker
```

Add infrastructure only as requirements emerge.

---

# 125. PRODUCTION READINESS CHECKLIST

Before calling a major feature production-ready:

```text
[ ] Database schema verified
[ ] Migration tested
[ ] Tenant isolation verified
[ ] Authorization verified
[ ] API validation verified
[ ] Error handling verified
[ ] Usage tracking verified where applicable
[ ] Logs safe
[ ] Secrets safe
[ ] Cloudflare routing verified
[ ] OCI deployment verified
[ ] Domain behavior verified
[ ] Mobile/responsive UI verified
[ ] Build passes
[ ] Runtime smoke test passes
[ ] Failure path tested
[ ] Documentation updated
```

---

# 126. PUBLIC WEBSITE READINESS CHECKLIST

Before switching the live domain from the legacy site:

```text
[ ] Mkety branding complete
[ ] Navigation complete
[ ] Platform explained
[ ] Workspaces explained
[ ] SolutionHub explained
[ ] Academy explained
[ ] Pricing/Plans explained
[ ] Enterprise explained
[ ] Trading marked Custom/Enterprise
[ ] Public AI working
[ ] Sign-in flow working
[ ] Get Started flow working
[ ] Responsive layout verified
[ ] SEO basics complete
[ ] Metadata complete
[ ] Legal pages where required
[ ] Analytics where required
[ ] Cloudflare deployment verified
[ ] Production domain tested
```

Only then should the legacy `mkety` main site be replaced.

---

# 127. LEGACY CUTOVER RULE

The old:

```text
mkety
```

repository remains live until the replacement is ready.

Cutover sequence:

```text
Old Mkety site
      │
      │ remains live
      ▼
New mksaas Mkety site
      │
      ├── build
      ├── test
      ├── deploy
      ├── verify
      └── approve
             ↓
       DNS/domain cutover
             ↓
       New Mkety website
```

Never leave the public site broken during development.

---

# 128. AI AGENT WORKING RULES

Every coding agent working on Mkety must follow these rules.

## Rule 1

Read `agents.md` first.

## Rule 2

Inspect the actual repository before assuming implementation status.

## Rule 3

Do not recreate features that already exist.

## Rule 4

Do not introduce a new architectural pattern when an existing Mkety abstraction already solves the problem.

## Rule 5

Do not expose secrets.

## Rule 6

Do not modify the legacy `mkety` main branch.

## Rule 7

Do not reintroduce Vercel as the production target.

## Rule 8

Use Cloudflare + OCI as the current production architecture.

## Rule 9

Keep Trading visible but architecturally standalone.

## Rule 10

Keep mklms and future customer applications outside the core Platform application.

## Rule 11

Keep Plans, Workspaces, SolutionHub and Pricing semantically distinct.

## Rule 12

Do not turn Mkety into an AI-only product.

---

# 129. AI AGENT REPOSITORY WORKFLOW

Recommended workflow:

```text
1. Read agents.md
2. Inspect git status
3. Inspect branch
4. Inspect package.json
5. Inspect current architecture
6. Identify relevant existing modules
7. Plan the batch
8. Implement
9. Run typecheck
10. Run tests
11. Run production build
12. Verify deployment
13. Fix related issues
14. Update documentation/status
15. Commit
```

---

# 130. AI AGENT COMMUNICATION

When reporting development progress, an agent should state:

```text
What was requested
What was already present
What was changed
Files/modules affected
Database changes
Environment changes
Tests performed
Build result
Deployment result
Known remaining issues
Next recommended batch
```

Do not claim deployment or verification that did not actually occur.

---

# 131. DO NOT FABRICATE

Agents must never say:

* deployed when not deployed
* tested when not tested
* production-ready when not verified
* payment working when only mocked
* Cloudflare configured when not configured
* ZITADEL integrated when not integrated
* database migration complete when not applied

---

# 132. IMPLEMENTATION STATUS LEGEND

Use:

```text
PLANNED
IN PROGRESS
IMPLEMENTED
VERIFIED
PRODUCTION
BLOCKED
DEFERRED
```

Do not use `COMPLETE` merely because code exists.

---

# 133. CURRENT STATUS SNAPSHOT

## Public Website

```text
STATUS: NEXT MAJOR PRIORITY
```

Goal:

Convert mksaas visual foundation into Mkety public website.

---

## Multi-tenancy

```text
STATUS: IMPLEMENTED
```

---

## Projects

```text
STATUS: IMPLEMENTED
```

---

## Agents

```text
STATUS: IMPLEMENTED
```

---

## Agent Builder

```text
STATUS: IMPLEMENTED
```

---

## Agent Runtime

```text
STATUS: IMPLEMENTED
```

---

## AI Playground

```text
STATUS: IMPLEMENTED
```

---

## Tools

```text
STATUS: IMPLEMENTED
```

---

## Knowledge

```text
STATUS: IMPLEMENTED FOUNDATION
```

---

## Agent Versioning

```text
STATUS: IMPLEMENTED
```

---

## Publishing

```text
STATUS: IMPLEMENTED
```

---

## Automation

```text
STATUS: IMPLEMENTED FOUNDATION
STATUS: REQUIRES VERIFICATION
```

---

## Deployments

```text
STATUS: NEXT MAJOR BACKEND PHASE
```

---

## SolutionHub

```text
STATUS: ARCHITECTURE DEFINED
STATUS: IMPLEMENTATION REQUIRED
```

---

## Plans

```text
STATUS: ARCHITECTURE DEFINED
STATUS: IMPLEMENTATION REQUIRED
```

---

## Pricing

```text
STATUS: ARCHITECTURE DEFINED
STATUS: IMPLEMENTATION REQUIRED
```

---

## Billing

```text
STATUS: ARCHITECTURE DEFINED
STATUS: IMPLEMENTATION REQUIRED
```

---

## Selar

```text
STATUS: PROVIDER SELECTED
STATUS: REUSABLE MKETY PAYMENT IMPLEMENTATION REQUIRED
```

---

## NOWPayments

```text
STATUS: PROVIDER SELECTED
STATUS: REUSABLE MKETY PAYMENT IMPLEMENTATION REQUIRED
```

---

## ZITADEL

```text
STATUS: TARGET IDENTITY ARCHITECTURE
STATUS: CURRENT IMPLEMENTATION MUST BE VERIFIED
```

---

## Cloudflare

```text
STATUS: PRIMARY PRODUCTION EDGE
```

---

## OCI

```text
STATUS: PRIMARY DAY-1 PERSISTENT INFRASTRUCTURE
```

---

## Vercel

```text
STATUS: NOT PART OF TARGET PRODUCTION ARCHITECTURE
```

---

## Trading

```text
STATUS: FRONTEND WORKSPACE / ENTERPRISE
STATUS: CUSTOM PRICING
STATUS: STANDALONE APPLICATION
```

---

## mklms

```text
STATUS: ENTERPRISE/CUSTOMER PROJECT
STATUS: SEPARATE APPLICATION
```

---

# 134. FINAL TARGET PRODUCT MAP

The complete Mkety product structure is:

```text
                              MKETY
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
       CORE PRODUCTS                       ENTERPRISE
              │                                   │
      ┌───────┴────────┐                 ┌────────┴────────┐
      │                │                 │                 │
Mkety Platform   Mkety Academy       Trading          Customer Projects
      │                                      │               │
      │                                      │              mklms
      │                                      │
      │                                Standalone App
      │
      ├── Workspaces
      │     ├── AI
      │     ├── Automate
      │     ├── Deploy
      │     └── Trading*
      │
      ├── SolutionHub
      │
      ├── Projects
      │
      ├── Plans
      │
      ├── Pricing
      │
      ├── Usage
      │
      ├── Credits
      │
      ├── Billing
      │
      ├── Domains
      │
      ├── Integrations
      │
      ├── Teams
      │
      └── Administration

* Trading remains visible in the workspace interface,
  but its application architecture is standalone and
  its commercial model is Custom/Enterprise.
```

---

# 135. FINAL PLATFORM EXPERIENCE

The intended Mkety Platform experience is:

```text
                    MKETY PLATFORM
                          │
          ┌───────────────┼────────────────┐
          │               │                │
       WORKSPACES      SOLUTIONHUB       PROJECTS
          │               │                │
    ┌─────┼─────┐         │          ┌─────┴─────┐
    │     │     │         │          │           │
   AI  Automate Deploy   Solutions  Apps       Services
    │
    ├── Agents
    ├── Builder
    ├── Knowledge
    ├── Tools
    ├── Models
    └── AI Apps

          │
          ▼
      DEPLOY / RUN
          │
          ▼
       USAGE
          │
          ▼
     CREDITS / BILLING
          │
          ▼
       SCALE
```

---

# 136. FINAL MKETY INFRASTRUCTURE

```text
                           INTERNET
                               │
                               ▼
                         CLOUDFLARE
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
      mkety.com           app.mkety.com        customer domains
          │                    │                    │
     Public Site          Mkety Platform      Customer Apps
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                         api.mkety.com
                               │
                               ▼
                     MKETY APPLICATION/API
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
             Workers                     OCI Core
                 │                           │
                 │                 ┌─────────┼─────────┐
                 │                 │         │         │
                 │              PostgreSQL  Redis    Worker
                 │
                 └─────────────── Cloudflare R2
```

---

# 137. FINAL DOMAIN ARCHITECTURE

```text
mkety.com
    ↓
Public Mkety Website

app.mkety.com
    ↓
Mkety Platform

api.mkety.com
    ↓
Mkety API

origin.mkety.com
    ↓
Mkety Origin / Routing Layer

*.mkety.app
    ↓
Customer Production, Preview / Development Applications
    ↓

customer-domain.com
    ↓
Customer-Owned Production Domain
```

---

# 138. FINAL REPOSITORY ARCHITECTURE

```text
mksaas
│
├── Mkety Public Website
│
├── Mkety Platform
│   ├── Dashboard
│   ├── Workspaces
│   ├── AI
│   ├── Automate
│   ├── Deploy
│   ├── SolutionHub
│   ├── Projects
│   ├── Plans
│   ├── Pricing
│   ├── Usage
│   ├── Credits
│   ├── Billing
│   ├── Domains
│   ├── Integrations
│   ├── Teams
│   └── Administration
│
├── Shared Services
│   ├── Identity
│   ├── Billing
│   ├── Payments
│   ├── Usage
│   └── Infrastructure
│
├── AI Runtime
│
├── Automation Runtime
│
├── Deployment Layer
│
└── Documentation
    └── agents.md
```

---

# 139. FINAL ARCHITECTURAL PRINCIPLE

Mkety should ultimately feel like one coherent technology platform rather than a collection of unrelated products.

The customer experience should be:

```text
DISCOVER MKETY
      ↓
CHOOSE A PLAN
      ↓
ENTER THE PLATFORM
      ↓
CHOOSE A WORKSPACE
      ↓
BUILD OR CHOOSE A SOLUTION
      ↓
AUTOMATE / DEPLOY / USE AI
      ↓
OPERATE
      ↓
TRACK USAGE
      ↓
SCALE
```

At the same time:

```text
Mkety Academy
```

provides education, while:

```text
Enterprise / Customer Solutions
```

allows Mkety to build specialized systems such as Trading and mklms without polluting the core Platform architecture.

---

# 140. THE MKETY RULE

When making an architectural decision, ask:

> Does this make Mkety Platform more coherent, reusable, scalable and easier for customers to understand?

If yes, proceed.

If the change exists only because a particular customer/project needs it, prefer placing it behind an enterprise/customer boundary.

If the change duplicates an existing service, reuse the existing abstraction.

If the change makes Mkety appear to be only an AI product, reconsider the positioning.

If the change exposes unnecessary infrastructure complexity to customers, hide it behind the Platform experience.

---

# 141. END STATE

The final Mkety ecosystem should be understood as:

```text
                         MKETY
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
       PLATFORM         ACADEMY          ENTERPRISE
        │                                     │
        │                               ┌─────┴─────┐
        │                               │           │
        │                            Trading    Customer
        │                                         Projects
        │                                           │
        │                                         mklms
        │
        ├── Workspaces
        │     ├── AI
        │     ├── Automate
        │     ├── Deploy
        │     └── Trading*
        │
        ├── SolutionHub
        ├── Projects
        ├── Plans
        ├── Pricing
        ├── Billing
        ├── Credits
        ├── Usage
        ├── Domains
        ├── Integrations
        ├── Teams
        └── Administration

* Trading is visible as a workspace but remains
  a standalone Custom/Enterprise application.
```

**This is the architecture that the `mksaas` repository should progressively become.**

The next implementation work should therefore begin with the **public Mkety website conversion inside `mksaas`**, using the mksaas template's existing visual system while applying the finalized Mkety product architecture, terminology, navigation, Plans/Pricing/SolutionHub/Workspace language, and brand identity.

#####take notes of these plans/workspaces/pricing language for the frontend#####

# 16. STARTER WORKSPACE — REPOSITIONING

Starter should be essentially a **Pages-first website/publishing product**.

Do not market it as hosting with CPU/RAM.

### Customer value language

Starter  include controlled limits around:

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
Cloudflare Pages (no worker)
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

A  bundled plan such as Mkety One  combine standard Workspace capabilities, but its public value must be expressed in product limits and usage rather than physical server allocations.

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
- Telegram AI.
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

#####end:DO NOT REMOVE ANYTHING ON THIS DOCUMEMNET, ONLY ADD BELLOW HERE ANY OTHER THING:end###### 