# Mkety — AI Agent Continuation Blueprint

> **Purpose:** This document is the persistent hand-off / source-of-context document for any AI coding agent continuing Mkety development. Read this file before changing architecture, infrastructure, product scope, or major dependencies.
>
> **Last updated:** 2026-08-29
>
> **Repository:** `dudemkay/mksaas`
>
> **Primary product:** Mkety Platform
>
> **Related product repository planned:** `mklms` for the course/LMS product. The user intends to fork the selected LMS template into that repository and add the evergreen webinar template as a branch there.

---

## 0. AGENT RULES — READ FIRST

1. **Do not restart architecture discussions that have already been settled.** Preserve the decisions in this document unless the user explicitly asks to revisit them.
2. **Do not replace working infrastructure just because a different stack is fashionable.** Optimize for low operating cost, portability, maintainability, and startup-credit usage.
3. **Mkety must remain multi-tenant and customer-isolated.** Never introduce tenant-unsafe global queries, storage paths, secrets, workflows, agents, or billing records.
4. **Separate the platform control plane from customer workloads.** The Mkety application manages customers, projects, agents, deployments, billing, tools, etc.; customer workloads may run on managed/isolated infrastructure according to the product tier.
5. **Cloudflare is the preferred edge/application layer.** OCI is the current low-cost infrastructure/processing layer. Do not move everything to one vendor without a concrete reason.
6. **Video architecture is LOCKED:**
   `OCI Media Flow + OCI Object Storage → Cloudflare R2 → Cloudflare CDN/cache → Mkety Next.js/Cloudflare course & webinar platform`.
7. **Do not introduce YouTube/Vimeo/Gumlet/Bunny/Cloudflare Stream as the required production video origin for the current client.** They may be evaluated later, but they are not the selected architecture.
8. **The LMS and video layers are separate.** The LMS stores users, courses, enrollment, progress, certificates, etc. R2 stores/delivers production HLS media.
9. **The evergreen webinar is a separate product experience from the self-paced LMS**, but shares identity, database, media, payments/entitlements, and other platform services where appropriate.
10. **Do not expose infrastructure-provider details in public Mkety marketing unless intentionally required.** Customers should see a simple product experience, not a list of cloud vendors.
11. **Prefer simple implementations first.** Do not import a huge LMS/ERP/automation framework when a focused module will satisfy the requirement.
12. **Never commit secrets, API keys, service credentials, webhook secrets, or private customer media into Git.** Use environment variables/secrets.
13. **For future AI agents, preserve this file and update it when a major architectural decision is finalized.**
14. **When uncertain, distinguish between:** `IMPLEMENTED`, `VERIFIED`, `PLANNED`, `DECIDED`, and `DEFERRED` instead of inventing status.

---

# 1. MKETY PRODUCT VISION

Mkety is being built as a multi-tenant platform for:

- Creating and running AI agents.
- Building automations/workflows.
- Deploying applications.
- Managing cloud infrastructure/workloads.
- Providing custom business solutions.
- Providing training through Mkety Academy.
- Supporting specialized client solutions such as LMS/course portals, evergreen webinars, social automation, Telegram automation, and trading-related automation.

The product should be enterprise-capable underneath while remaining simple and non-technical for customers.

Initial market focus is Nigeria/Africa, with global-ready architecture. Pricing should support a Nigerian-friendly low-cost offer without publicly labeling it an “African edition”; the accepted public positioning is **Lite Offer** where applicable.

---

# 2. BRAND / PRODUCT STRUCTURE

## Mkety

Main brand and website.

The main Mkety site is intended to remain a multi-tab / multi-section Next.js experience rather than fragmenting the main brand into unnecessary separate sites.

## Mkety Academy

Training/education arm covering:

- Web/app development.
- Digital marketing.
- AI.
- Automation.
- Other digital technology skills.

The Academy should remain simple initially. A full LMS is treated as a reusable Solution/Blueprint rather than something that must bloat the core platform.

## Mkety Platform

Core SaaS/PaaS platform for:

- AI Agents.
- Workspaces.
- Projects.
- Automation/workflows.
- Tools.
- Knowledge.
- Deployment.
- Cloud/infrastructure management.
- Usage/billing.

## Mkety Trading

Trading-related service/solution area. Former standalone `tradecopier.mkety.com` concept was removed/integrated into Mkety Platform/Academy rather than remaining a separate public product.

---

# 3. CUSTOMER / OFFER STRUCTURE

Accepted service/product segmentation:

### Personal

For simple websites and lightweight apps.

### Creator

For custom management portals, business solutions, and custom applications through Solutions.

### Enterprise

For larger/custom work with enterprise requirements.

Do not collapse these into one generic offer without a business reason.

---

# 4. CORE PLATFORM ARCHITECTURE

High-level platform model:

```text
                           MKETY PLATFORM
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
     Workspaces                Projects                 Account
        │                         │                         │
        ├───────────────┐         │                         │
        │               │         │                         │
      Agents         Workflows  Deployments              Billing
        │               │         │                         │
        ├───────────────┼─────────┼─────────────────────────┤
        │               │         │                         │
     Tools          Knowledge   Runtime                  Usage
        │               │         │                         │
        └───────────────┴─────────┴─────────────────────────┘
                                  │
                              Control Plane
                                  │
                   ┌──────────────┼──────────────┐
                   │              │              │
              Cloudflare       Supabase          OCI
                   │              │              │
             Edge/App/API      DB/Auth*      Compute/Media
```

`*` Identity architecture is evolving toward the accepted ZITADEL + Cerbos model; see the identity section below. The current mksaas template contains Auth.js/Auth0 and Drizzle defaults, so migration must be deliberate rather than assumed complete.

---

# 5. CURRENT MKSAAS REPOSITORY STATE

Repository:

`dudemkay/mksaas`

Default branch:

`main`

The repository is private and currently contains the Mkety SaaS foundation.

Current known branches include:

- `main`
- `mkety-phase-1-ai-core-foundation`
- `workspace-team-routing`
- `feature/workspace-custom-domain`
- `chore/add-engines-field`
- `chore/consolidate-postgres-driver`
- `chore/update-nextjs-to-v16`

Recent repository work confirms substantial AI and automation implementation has already been performed.

## Verified recent implementation themes from Git history

### AI agent lifecycle

Implemented/committed work includes:

- Published agent versions made authoritative.
- Runtime execution against published versions.
- Agent Builder connected to version/publish lifecycle.
- Version controls added to Agent Builder.

### Workflow/automation runtime

Implemented/committed work includes:

- Workflow definitions and runs.
- Workflow execution history.
- Workflow schema export.
- Workflow persistence tables.
- Secure webhook workflows.
- Workflow webhook secrets.
- Workflow execution engine.
- Tenant-scoped workflow API.
- Authenticated workflow execution API.
- Webhook workflow trigger.
- Complete workflow CRUD API.
- Workflow lifecycle API.
- Workflow run history API.
- Bounded action retries.

The latest known commit also re-enabled Vercel deployment after the automation development batch.

### Existing template foundation

The current repository originated from a Next.js SaaS AI starter and contains a substantial baseline including:

- Multi-tenant architecture.
- Tenant-scoped routes.
- Admin panel.
- Roles/permissions foundation.
- Audit logging.
- Webhooks.
- File uploads.
- AI assistant/RAG foundation.
- PostgreSQL/pgvector.
- Drizzle ORM in the current template baseline.
- Auth.js/Auth0 in the current template baseline.
- GitHub integration architecture.
- CI/CD.
- Storybook.
- i18n.

**Important:** These are repository/template capabilities, not proof that every Mkety target architecture decision has been completed. Do not state a target component is production-ready merely because the starter contains a similar component.

---

# 6. PLATFORM ROADMAP / FEATURE MAP

The agreed platform progression is:

```text
Multi-tenancy                ✅
Workspace                    ✅
Projects                     ✅
Agent persistence            ✅
Agent Builder                ✅
                              ↓
Agent runtime                ✅ / implemented in current lifecycle work
                              ↓
AI test playground            NEXT / continue validation and UX
                              ↓
Tools + knowledge             NEXT
                              ↓
Versioning / publish          ✅ foundational lifecycle implemented
                              ↓
Workflow/automation runtime  ✅ substantial API/engine foundation
                              ↓
Deployment / applications    IN PROGRESS / continue platform integration
                              ↓
Billing / usage              INTEGRATION PHASE
```

Status should be updated as actual code is verified.

---

# 7. AI AGENT SYSTEM

The target agent architecture is persistent and versioned.

## Core concepts

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

## Desired lifecycle

```text
Create Agent
    ↓
Configure Agent
    ↓
Add model / instructions / tools / knowledge
    ↓
Save draft
    ↓
Test in Playground
    ↓
Create version
    ↓
Publish
    ↓
Published version becomes authoritative
    ↓
Runtime executes published version
    ↓
Observe usage/logs
    ↓
Create next version
    ↓
Publish / rollback
```

Never allow production runtime to silently execute an unpublished draft when a published version exists.

---

# 8. MIPX / TOOL REGISTRY / ACTION ENGINE

The accepted architecture introduced Mkety-first abstractions around:

- **MIPX** — Mkety integration/protocol abstraction used as the platform's internal integration model.
- **Tool Registry** — centralized definitions of tools/actions available to agents/workflows.
- **Action Engine** — executes registered actions with validation, authorization, retry/timeout policy, and telemetry.

Tools must be tenant-aware and permission-aware.

Actions should support:

- Validation.
- Authorization.
- Idempotency where possible.
- Bounded retries.
- Timeout.
- Failure state.
- Audit record.
- Usage accounting.
- Provider-specific implementation behind a stable Mkety interface.

---

# 9. WORKFLOW / AUTOMATION ENGINE

The repository already contains substantial workflow runtime work.

Target model:

```text
Workflow
  ├── Trigger
  ├── Steps / Actions
  ├── Conditions
  ├── Inputs
  ├── Outputs
  ├── Retry policy
  ├── Secrets
  └── Execution history
```

Supported/implemented foundations include:

- CRUD.
- Tenant scoping.
- Authenticated execution.
- Webhook triggers.
- Webhook secrets.
- Lifecycle endpoints.
- Run history.
- Execution history.
- Bounded retries.

Next work should focus on the **actual usable visual workflow builder, richer action catalog, durable execution, scheduling, observability, and customer-facing UX**, not redoing the already-created APIs.

---

# 10. AUTOMATION / INTEGRATION DIRECTION

Target integrations include:

- Telegram.
- Facebook.
- X.
- Instagram.
- WhatsApp.
- Email.
- Webhooks.
- APIs.
- GitHub.
- Cloud/deployment systems.

n8n/Activepieces/Flowise are useful technologies and may be used as managed/customer workloads or integration engines, but Mkety's control plane should not become permanently dependent on one third-party automation engine.

Customer-owned n8n model has previously been accepted for cases where the customer should own/control the automation runtime.

---

# 11. AI / MODEL PROVIDERS

Mkety should support a multi-provider model strategy rather than hard-coding one provider.

Accepted/considered model/provider ecosystem includes:

- OpenAI.
- Anthropic.
- Google Gemini.
- Groq.
- Open-source models.
- Azure OpenAI where startup credits make sense.
- Other providers through a model gateway.

## LiteLLM

LiteLLM is an accepted infrastructure component for unified model/provider routing and compatibility.

## Vercel AI SDK

Accepted for application-level AI streaming/tool calling where appropriate.

## AI Gateway

Vercel AI Gateway is an accepted option for provider routing/failover/cost tracking where useful, but do not introduce it where direct provider routing or LiteLLM already provides the required control.

---

# 12. KNOWLEDGE / RAG

Target knowledge system:

- Document/file ingestion.
- Chunking.
- Embeddings.
- Vector search.
- Tenant/workspace/project isolation.
- Agent-specific knowledge selection.
- Retrieval telemetry.

Accepted infrastructure includes:

- PostgreSQL + pgvector where sufficient.
- Qdrant for dedicated vector search workloads.

Flowise remains an accepted visual AI/flow tool and may be deployed as a managed/customer workload, but Mkety's agent abstraction should not be tied to Flowise.

---

# 13. IDENTITY / AUTHORIZATION

Accepted target identity architecture:

### ZITADEL

Identity provider / authentication / organization and account identity layer.

### Cerbos

Fine-grained authorization / policy decision layer.

### Prisma

Prisma is retained as the accepted ORM decision from the architecture discussion.

**Important migration note:** the current mksaas starter README still reflects Auth.js v5 + Auth0 + Drizzle. Do not assume the repository has already fully migrated to ZITADEL + Cerbos + Prisma. Verify code before changing or removing existing auth/ORM infrastructure.

Authorization must be:

- Tenant-aware.
- Workspace-aware.
- Project-aware where necessary.
- Role/permission aware.
- Resource-aware.
- Auditable.

---

# 14. DATABASE

Target data platform:

**PostgreSQL** as the primary relational database.

Use:

- Supabase PostgreSQL where appropriate for Mkety-managed application data.
- PostgreSQL/managed instances for infrastructure components as required.
- pgvector where it is the simplest fit.
- Qdrant for dedicated vector workloads.

Core domains include:

```text
Tenancy
├── tenants
├── workspaces
├── workspace_members
├── projects
└── domains

Identity
├── users
├── identities
├── roles
├── permissions
└── policies

AI
├── agents
├── agent_versions
├── agent_runs
├── conversations
├── tools
├── knowledge_sources
└── knowledge_chunks

Automation
├── workflows
├── workflow_versions
├── workflow_runs
├── workflow_steps
├── webhook_triggers
└── execution_events

Billing
├── plans
├── subscriptions
├── wallets
├── ledger
├── usage
├── invoices
├── credits
├── audit_logs
└── webhook_events

Deployments
├── applications
├── deployments
├── environments
├── domains
├── resources
└── deployment_events
```

Exact schema names should follow the existing repository schema where already implemented; do not duplicate tables just because this conceptual model uses a different name.

---

# 15. BILLING / CREDITS / USAGE

Desired Mkety Billing system:

- Plans.
- Wallet.
- Ledger.
- Subscriptions.
- AI credits.
- Deployment credits.
- Usage metering.
- Invoices.
- Audit logs.
- Webhook processor.
- Admin billing.

## Billing architecture decision

**Lago** is the preferred billing/usage engine for subscriptions, prepaid credit wallets, usage metering, and invoices.

Earlier discussions mentioned OpenMeter, but the accepted recommendation was subsequently **Lago over OpenMeter** for the full billing requirement. Treat Lago as the current preferred choice unless explicitly revisited.

## Payment gateways

### Selar

Default payment gateway for Nigerian/global-friendly payments where appropriate. Supports cards, bank transfers, and mobile money depending on market/payment configuration.

### NOWPayments

Accepted crypto payment gateway.

Do not expose gateway details in marketing unless needed.

---

# 16. PRICING DIRECTION

Known pricing direction:

- Keep entry pricing low enough for Nigerian SMBs.
- Example discussed: around **$19/month** for a low-cost platform tier, subject to final economics.
- Yearly pricing can include a first-year discount.
- Negotiation/custom enterprise pricing should remain possible.
- Lite Offer is the preferred public terminology for a lower-cost market-friendly offer rather than “African edition.”

Pricing must ultimately be tied to actual usage costs, especially:

- AI inference.
- Video processing.
- Storage.
- Deployment compute.
- Workflow execution.
- Email/SMS/communications.

---

# 17. CLOUD / INFRASTRUCTURE STRATEGY

The accepted strategy is **multi-cloud with startup/free credits first**, while avoiding unnecessary monthly spend from the user's own funds.

Priority:

1. Startup/free credits.
2. Cloudflare free/low-cost services.
3. OCI free/low-cost infrastructure.
4. Other startup-provider credits as they become available.
5. Paid infrastructure only when justified by real customers/usage.

Do not assume every provider discussed has been granted or is currently active. Verify account status before provisioning.

---

# 18. CLOUDFLARE ROLE

Cloudflare is the preferred edge/application layer.

Accepted uses:

- DNS.
- Pages.
- Workers.
- R2.
- CDN/cache.
- Edge access control.
- Custom domains.
- WAF/security where needed.

## Cloudflare Workers

Use Workers for:

- Lightweight API/business logic.
- Edge authorization.
- Signed media access.
- Webhook processing.
- Routing.
- Custom application logic.
- Managed integrations.
- Small custom customer workloads where economics make sense.

**Decision:** Do not put every heavy workload into Workers. Use Workers where they are economically and technically appropriate.

## Cloudflare Pages

Preferred for:

- Static/Next.js frontend delivery where compatible.
- Marketing/public pages.
- Edge-hosted application frontends as architecture permits.

## Cloudflare Containers

Containers are an option for heavier isolated workloads that fit Cloudflare's container offering. They are not automatically the default for every Mkety service.

## Growth principle

Use Cloudflare Workers/Containers for products and custom workloads when they make sense, but do not incur unnecessary managed costs before there are justifiable customers/usage.

---

# 19. OCI ROLE

OCI is currently the preferred low-cost infrastructure/processing layer.

Accepted OCI uses include:

- Object Storage.
- Media Flow.
- Compute/VM where needed.
- Application services that are cheaper/simpler to run there.
- Video processing pipeline.

OCI is especially important because startup/free credits can be used before committing personal cash.

---

# 20. VIDEO ARCHITECTURE — LOCKED

## The official selected architecture

```text
OCI Media Flow + OCI Object Storage
              ↓
        processed HLS/ABR
              ↓
       Cloudflare R2
              ↓
     Cloudflare CDN/cache
              ↓
    Mkety custom HLS player
              ↓
          Student
```

This is the current **Mkety video standard** for the course/webinar project.

## Roles

### OCI Object Storage

- Original source video.
- Media Flow input.
- Temporary/processing output.
- Optional archive.

### OCI Media Flow

- Managed transcoding.
- Adaptive bitrate processing.
- HLS/ABR packaging.
- 1080p/720p/480p/360p ladder as appropriate.

### Cloudflare R2

- Production HLS storage.
- Long-term media library.
- Delivery origin.
- Zero Internet egress charge under current R2 pricing model.

### Cloudflare CDN/cache

- Edge caching.
- Reduce repeated origin requests.
- Global delivery.

### Worker

- Authorization.
- Signed/tokenized access.
- Business rules.
- Course entitlement checks.
- Webinar access logic.

### Player

Use a mature HLS-compatible player library rather than reinventing video playback. Skin/customize it to the customer's brand.

---

# 21. VIDEO SECURITY

Do **not** expose the production R2 bucket as an unrestricted public video origin for paid content.

Target flow:

```text
Student
  ↓
Authenticated course/webinar page
  ↓
Worker checks entitlement
  ↓
Signed/tokenized media access
  ↓
Cloudflare/WAF/cache
  ↓
R2
```

Do not force every individual HLS segment through expensive application logic if Cloudflare's edge authorization/cache can handle it safely.

Requirements:

- Enrollment check.
- Course entitlement.
- Expiry/revocation.
- Tenant isolation.
- Hotlink protection where appropriate.
- Signed URLs/tokens.
- Audit/usage tracking at appropriate granularity.

---

# 22. VIDEO ADMIN UPLOAD FLOW

The customer/admin should not have to understand OCI.

UI should be:

```text
Admin Dashboard
  ↓
Course / Webinar
  ↓
Upload Video
  ↓
Uploading...
  ↓
Processing...
  ↓
Generating qualities...
  ↓
Publishing...
  ↓
READY
```

Recommended backend state machine:

```text
UPLOADED
PROCESSING
TRANSCODED
TRANSFERRING
PUBLISHED
FAILED
ARCHIVED
```

Use resumable/multipart upload for large source files.

Store media metadata in the Mkety database:

- asset ID.
- tenant ID.
- course/webinar ID.
- source object.
- processing job ID.
- HLS master URL/key.
- available renditions.
- duration.
- file size.
- status.
- created/updated timestamps.
- provider information.

---

# 23. SELF-PACED COURSE SYSTEM

The current client requirement:

- Advanced class hosted as a self-paced course.
- Exclusive access only to registered/paid users.
- Student completes course.
- Private community link is revealed only at full completion.
- Certificate is automatically generated and emailed.
- Mobile-friendly web access.
- Telegram can optionally act as an additional course interface.

## Course structure

```text
Course
├── Module
│   ├── Lesson
│   │   ├── Video
│   │   ├── Text
│   │   ├── Attachments
│   │   └── Completion rule
│   └── ...
└── Completion requirements
```

## Student flow

```text
Payment / enrollment
       ↓
Account
       ↓
Course access
       ↓
Lessons
       ↓
Progress tracking
       ↓
100% completion
       ↓
Certificate
       ↓
Private community unlock
```

---

# 24. LMS TEMPLATE DECISION

Selected template:

**`foyzulkarim/nextjs-lms-boilerplate`**

Repository:

`https://github.com/foyzulkarim/nextjs-lms-boilerplate`

Reason for selection:

- Next.js-based.
- Relatively simple compared with huge LMS platforms.
- Course/student/admin concepts already exist.
- Video/course UI foundation.
- Member/course management concepts.
- Suitable for deploying, editing, and integrating into Mkety rather than building an LMS from zero.

The user intends to fork/use this as the foundation for a new repository named:

**`mklms`**

The user also intends to add an evergreen webinar template as a branch in the same `mklms` repository.

### Important

The LMS template is a **starting UI/application shell**, not the authoritative Mkety architecture. Replace its storage/video/auth/payment assumptions as necessary.

Do not add Moodle/Open edX/Gumlet/etc. simply because they exist. The selected path is the lightweight Next.js LMS approach.

---

# 25. MKLMS REPOSITORY PLAN

Planned repository:

`mklms`

Suggested conceptual structure:

```text
mklms
├── main                    # self-paced LMS foundation
├── evergreen-webinar       # evergreen webinar template
└── docs/
    └── architecture.md
```

The user intends to fork the course template into `mklms` and add the evergreen webinar template as a branch.

The current `mksaas` repository should reference the LMS architecture, but LMS implementation should live in `mklms` once created.

---

# 26. AUTOMATIC CERTIFICATE SYSTEM — LOCKED REQUIREMENT

Certificates must require **zero manual certificate creation per student**.

Existing certificate image/PDF supplied by the client can be used as the visual template.

Use dynamic placeholders/overlay rendering, conceptually:

```text
{{ STUDENT_NAME }}
{{ COURSE_NAME }}
{{ COMPLETION_DATE }}
{{ CERTIFICATE_ID }}
{{ ISSUER }}
{{ VERIFICATION_URL }}
```

## Student name

The student account should have:

- Account name.
- Email.
- A dedicated **certificate name** field.

The certificate name should be explicitly confirmed by the student before completion so payment-account/business names do not accidentally appear on certificates.

## Automatic generation

```text
Course reaches 100%
       ↓
Completion event
       ↓
Generate unique certificate ID
       ↓
Render client certificate template
       ↓
Create PDF
       ↓
Store certificate
       ↓
Email student
       ↓
Expose verification page
       ↓
Unlock private community link
```

## Verification

Every certificate should ideally have a verification URL such as:

`https://mkety.com/verify/<certificate-id>`

The verification page should display:

- Certificate ID.
- Student name.
- Course name.
- Issue/completion date.
- Validity status.

Do not expose unnecessary personal information.

---

# 27. TELEGRAM COURSE INTEGRATION

Telegram is an optional second interface, not a second LMS.

Target architecture:

```text
                    SUPABASE / COURSE DB
                           │
              ┌────────────┴────────────┐
              │                         │
          Web LMS                  Telegram Bot
              │                         │
              └────────────┬────────────┘
                           │
                    Same enrollment
                    Same progress
                    Same certificate
```

## Telegram options

### Bot

- Registration/linking.
- Course notifications.
- Lesson reminders.
- Progress notifications.
- Certificate delivery.
- Community unlock.

### Telegram Mini App

Preferred for a rich Telegram course interface because it can reuse the web course portal experience.

Example:

```text
Telegram Bot
   ↓
🎓 My Course
   ↓
Telegram Mini App
   ↓
Next.js course UI
   ↓
Same Supabase data
```

Do not create an entirely separate Telegram course database.

---

# 28. EVERGREEN WEBINAR SYSTEM

This is a distinct client solution built alongside the LMS.

The client's intended experience:

1. A real Zoom class is hosted once.
2. The recording becomes an evergreen/on-demand webinar.
3. Visitors register.
4. They see a countdown/waiting experience.
5. The recorded webinar plays as though it is a scheduled/live event.
6. The original Zoom chat is replayed/synchronized to increase the perceived live experience.
7. There is a CTA to join/purchase the paid full course.
8. After purchase, the customer enters the self-paced course portal.

## Target flow

```text
Landing page
    ↓
Register
    ↓
Countdown / scheduled event
    ↓
Evergreen webinar
    ├── Recorded Zoom video
    ├── synchronized/replayed chat
    ├── event UI
    └── CTA
          ↓
      Purchase
          ↓
      Course enrollment
          ↓
      Self-paced LMS
```

## Important terminology

This is a **recorded/evergreen webinar experience**. The system should not falsely claim that the underlying video is a genuinely live broadcast. Product copy should be designed carefully to avoid deceptive claims while achieving the desired scheduled-event experience.

## Video architecture

Use the same locked video pipeline:

`OCI Media Flow → OCI Object Storage → R2 → Cloudflare CDN → custom player`

Do not create a second video stack for webinars.

---

# 29. EVERGREEN WEBINAR PLAYER REQUIREMENTS

Potential features:

- Scheduled start.
- Countdown.
- Autoplay where browser policy permits.
- Custom controls.
- Branding.
- Fullscreen.
- Mobile support.
- Progress/timeline behavior.
- Synchronized chat replay.
- CTA at configured timestamps.
- Registration gating.
- Course purchase CTA.
- Optional anti-skip / controlled seeking depending client requirement.
- Analytics.

The UI should be implemented in Next.js, not delegated to a third-party video SaaS.

---

# 30. CLIENT COURSE + WEBINAR ARCHITECTURE

Final conceptual stack:

```text
                     CLOUDFLARE
             Pages / Workers / R2 / CDN
                         │
          ┌──────────────┴──────────────┐
          │                             │
     Client Landing                 Course/Webinar
          │                             │
          └──────────────┬──────────────┘
                         │
                      Supabase
                         │
       ┌─────────────────┼─────────────────┐
       │                 │                 │
     Users           Courses          Enrollments
       │                 │                 │
       │              Progress        Certificates
       │                 │                 │
       └─────────────────┼─────────────────┘
                         │
                    Video asset
                         │
                    OCI Media Flow
                         │
                    OCI Object Storage
                         │
                         ▼
                         R2
                         │
                       CDN
                         │
                     HLS player
```

---

# 31. SOCIAL / TELEGRAM AUTOMATION WORK

Existing/previous Mkety work includes a Telegram AI assistant and userbot infrastructure.

Known requirements explored:

- Telegram channel/group signal copying.
- Source-channel monitoring.
- Reformatting signal text.
- Removing/moving TP/SL lines.
- Conditional edits.
- Live-price-aware logic.
- Media support.
- Private/subscribed channels.
- Bot API vs MTProto considerations.
- Telegram Business considerations.
- Webhook ingestion.
- Forwarding into downstream automation/MT5 systems.

A deployed Python/MTProto userbot has previously been running through Coolify and GitHub integration.

Known operational setup from prior work:

- Python MTProto project.
- Private GitHub repository/branch integration.
- Environment variables such as `SOURCE_CHANNELS`.
- Webhook ingest URL.
- Userbot listens to joined channels/groups and forwards raw text to webhook ingest.
- Runtime logs showed the userbot active and listening for signals.
- Telegram channel ID setup was completed during that work.

Do not mix this client-specific signal-forwarding infrastructure into the core Mkety LMS unless a reusable integration is explicitly required.

---

# 32. DEPLOYMENT / COOLIFY

Coolify has been accepted/used as an infrastructure management/deployment layer, especially on OCI VMs.

Previously established OCI VM environment included:

- Ubuntu 24.04.x.
- 4 CPU cores.
- ~15 GiB RAM.
- ~123 GB disk.
- Docker.
- Coolify.
- PostgreSQL.
- Redis.

Coolify was successfully installed and dashboard access was established.

Previous deployed workloads included the Telegram userbot.

Use Coolify when a persistent containerized service is better suited than Cloudflare Workers.

---

# 33. CORE INFRASTRUCTURE COMPONENTS DISCUSSED / ACCEPTED

The original Day-1 OCI-oriented stack included:

- Coolify.
- PostgreSQL.
- Redis.
- Qdrant.
- Flowise.
- Activepieces.
- LiteLLM.
- Uptime Kuma.

These are **accepted tools/components**, not a requirement that every service must run simultaneously on Day 1.

Use only what is justified by the current feature.

---

# 34. FRONTEND / APPLICATION TECHNOLOGY

Primary application technology:

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui where useful.

The current mksaas template is Next.js-based and has a mature component/application structure.

Mkety should favor:

- Server-side authorization.
- Tenant-scoped routing/data access.
- Reusable feature modules.
- Typed API contracts.
- Good mobile UX.
- Accessible components.
- Minimal client-side secrets.

---

# 35. EXISTING ADMIN ROUTES / VERIFIED UI PROGRESS

During development the following admin/application routes were reported as accessible/working:

```text
/app
/app/admin
/app/admin/users
/app/blogs
/app/categories
/app/files
/settings
```

These should be treated as **reported working**, not as a guarantee that every route is fully production-complete. Verify before modifying.

---

# 36. DEPLOYMENT HISTORY / LESSONS

There have been Vercel deployment/build issues, including a `pnpm install --no-frozen-lockfile` failure during one deployment batch.

Later repository commits show deployment automation was re-enabled after development batches.

When debugging deployments:

1. Check package manager/version.
2. Check lockfile consistency.
3. Check Node/pnpm versions.
4. Check environment variables.
5. Check build logs.
6. Check provider-specific runtime constraints.
7. Verify locally/preview before production.

Do not assume a deployment failure is an application-code failure until install/build/runtime logs are inspected.

---

# 37. GITHUB / SOURCE CONTROL

Primary repo:

`dudemkay/mksaas`

Planned LMS repo:

`mklms`

The user intends to fork the selected LMS template and maintain the evergreen webinar template as a branch in `mklms`.

Use feature branches for major work.

Recommended branch concepts:

```text
main
feature/<feature>
fix/<issue>
chore/<maintenance>
```

Do not rewrite `main` history unless explicitly requested.

---

# 38. VERCEL / CLOUDFLARE DEPLOYMENT STRATEGY

Vercel has been used for deployment/testing and remains a valid development/deployment provider where appropriate.

However, the current strategic preference is:

- Cloudflare Pages/Workers for edge/application components where practical.
- OCI/Coolify for persistent/heavy workloads.
- Vercel as an available platform rather than the only infrastructure dependency.

Do not publicly market Mkety as a “Vercel product.”

---

# 39. AZURE / STARTUP CREDITS

Microsoft Founders Hub / Azure startup credits have been part of the infrastructure strategy.

Previously discussed stages include:

- Ideate: $1k.
- Develop: $5k.
- Grow: $25k.
- Scale: $150k+.

Azure/OpenAI/GitHub Enterprise were considered as credit-funded resources.

The user wants to consume startup credits before personal funds whenever practical.

Do not assume current Azure credit balance or program eligibility; verify account status when provisioning.

---

# 40. OTHER STARTUP / CLOUD PROVIDERS

Providers discussed/considered:

- Cloudflare Startups.
- Oracle Cloud Infrastructure (OCI).
- Microsoft Azure / Founders Hub.
- Google Cloud / startup programs.
- NVIDIA/startup resources.
- YC/startup resources.
- Other startup credits.

The architecture is intentionally multi-cloud and portable.

---

# 41. WEBSITE / DOMAIN STRATEGY

Main domain:

`mkety.com`

Cloudflare is the DNS/edge layer.

The main website should remain a multi-tab/multi-section Next.js experience where practical.

Possible application/subdomain patterns have included:

- `app.mkety.com`
- `platform.mkety.com`
- `mkety.app`
- wildcard `*.mkety.com`

Do not create unnecessary subdomains when a tab/route inside the main application is sufficient.

---

# 42. DEPLOYMENT PRODUCT MODEL

Mkety offers three broad capabilities:

```text
Create AI Agents
Deploy Applications
Automate Workflows
Manage Cloud Infrastructure
```

Deployment architecture should eventually support:

- Application creation.
- Repository connection.
- Build/deploy.
- Environment variables.
- Domains.
- Deployment history.
- Logs/status.
- Rollbacks.
- Resource tracking.
- Customer ownership/isolation.

Static/lightweight sites can use Cloudflare Pages.

Dynamic/containerized applications can use Coolify/OCI or another appropriate runtime.

---

# 43. ERP / BUSINESS SOLUTIONS

ERPNext was previously accepted as a Solution/Blueprint option.

Architecture preference:

- One codebase/bench pattern where appropriate.
- Provision isolated fresh ERPNext sites per customer.
- Templates for repeatable deployments.
- Customer isolation.

Do not make ERPNext part of Mkety Core unless there is a direct product requirement.

---

# 44. OPEN EDX DECISION

Open edX was explicitly removed from Mkety Core v1.

If required later, treat it as:

- A Solution.
- A Blueprint.
- A customer-specific deployment.

Do not add Open edX to the core platform simply because it is an LMS.

---

# 45. COURSE / LMS PRODUCT POSITIONING

Mkety Academy should initially be simple.

A full reusable LMS is being developed as a **Solution/Blueprint** using the `mklms` repository.

The course product should support:

- Paid enrollment.
- Student accounts.
- Course modules.
- Lessons.
- Video.
- Progress.
- Completion rules.
- Certificates.
- Email notifications.
- Private community unlock.
- Telegram integration.
- Mobile browser experience.
- Custom branding.

---

# 46. VIDEO COST PRINCIPLE

The video architecture was selected primarily because high-volume video egress is the major cost risk.

The desired model is:

```text
Processing cost = OCI Media Flow
Storage cost    = R2 storage
Viewer egress   = R2 zero Internet egress
Edge delivery   = Cloudflare cache/CDN
```

Do not casually switch to per-minute/per-view video SaaS pricing without comparing the actual customer traffic.

Initial use case discussed:

- 2 webinars.
- Up to ~100 views/day in the reduced scenario.
- Up to 2 hours per session.
- 720p/1080p adaptive playback.

The architecture should be benchmarked with real recordings before declaring production scale guarantees.

---

# 47. MEDIA FLOW TEST PLAN

Before production certification of the video pipeline, test:

1. Upload a real 1–2 hour Zoom recording.
2. Store source in OCI Object Storage.
3. Run OCI Media Flow.
4. Verify HLS/ABR outputs.
5. Verify 1080p/720p/480p/360p as configured.
6. Transfer/copy processed HLS package to R2.
7. Configure R2 custom domain/cache.
8. Play from a custom HLS player.
9. Test iOS Safari.
10. Test Android Chrome.
11. Test desktop Chrome/Edge/Safari.
12. Test seeking.
13. Test autoplay policy behavior.
14. Test fullscreen.
15. Test signed/tokenized access.
16. Test unauthorized access.
17. Test expired enrollment.
18. Test cache behavior.
19. Test concurrent viewers.
20. Measure R2 operations.
21. Measure OCI Media Flow processing cost.
22. Record actual HLS output size.
23. Document real cost per finished hour/video.

Only after this should production traffic assumptions be finalized.

---

# 48. OBSERVABILITY

Accepted/desired observability tools:

- Uptime Kuma.
- Provider logs.
- Application logs.
- Workflow execution history.
- Audit logs.
- Deployment history.
- Media processing status.

Every major asynchronous operation should have a visible state and failure reason.

Examples:

```text
Video processing: PROCESSING
Workflow run: FAILED — reason
Deployment: BUILDING
Agent run: COMPLETED
Certificate: GENERATED
```

---

# 49. AUDIT / SECURITY

Security is a platform requirement, not a later add-on.

Track sensitive events such as:

- Login/security events.
- Permission changes.
- Tenant membership changes.
- Agent publish/unpublish.
- Workflow execution.
- Secret changes.
- Billing changes.
- Deployment changes.
- Media access/security events where appropriate.
- Certificate issuance.

Use least privilege.

Never trust tenant IDs supplied directly by clients without resolving them from authenticated context and authorized memberships.

---

# 50. MULTI-TENANCY RULES

Every customer resource must be scoped to its tenant/workspace/project.

Examples:

```text
tenant_id
workspace_id
project_id
```

Storage paths should also be isolated:

```text
/<tenant>/<workspace>/<project>/...
```

Video:

```text
r2://media/<tenant>/<course>/<lesson>/...
```

Never allow one tenant to guess another tenant's object key and obtain content.

---

# 51. CUSTOMER DATA OWNERSHIP / PORTABILITY

Avoid architecture that makes migration impossible.

Important data should have stable internal IDs and provider-independent abstractions.

For example:

```text
media_asset.provider = r2
media_asset.provider_asset_id = ...
```

This allows future migration to another media provider without rewriting the LMS/business logic.

The same principle applies to:

- AI providers.
- Deployment providers.
- Automation engines.
- Payment providers.
- Identity providers.

---

# 52. CUSTOMER-FACING SIMPLICITY

The underlying system can be complex; the user interface should not be.

Instead of exposing:

> OCI Media Flow / R2 / HLS / Workers

show:

> **Upload Video** → **Processing** → **Ready**

Instead of:

> Configure deployment runtime/container/region

show:

> **Deploy App** → **Connect Repository** → **Deploy**

Instead of:

> Configure model provider / API gateway

show:

> **Choose AI Model**

---

# 53. TESTING STANDARD

For each major feature:

1. Type-check.
2. Lint.
3. Unit tests where appropriate.
4. Integration tests for APIs/data boundaries.
5. Browser verification for important UI flows.
6. Mobile browser check for customer-facing flows.
7. Verify authorization with both allowed and denied users.
8. Verify tenant isolation.
9. Verify failure states.
10. Verify deployment build.

Do not declare a feature complete from a successful build alone.

---

# 54. AI AGENT DEVELOPMENT WORKFLOW

When another AI model continues work:

### Step 1 — Read

- `agents.md`.
- Repository README.
- Existing docs.
- Relevant feature code.
- Recent commits.

### Step 2 — Determine actual state

Use:

- Git history.
- Existing schema.
- Routes.
- Tests.
- Deployment logs.

Do not infer completion solely from this blueprint.

### Step 3 — Preserve architecture

Use the locked decisions in this document.

### Step 4 — Implement smallest correct increment

Avoid broad rewrites.

### Step 5 — Verify

Run appropriate checks and browser verification.

### Step 6 — Update documentation

If a decision changes, update this file.

---

# 55. CURRENT PRIORITY ORDER

Recommended continuation order based on the project state:

## A. Finish/verify AI runtime UX

- AI test playground.
- Agent run UI.
- Tool invocation visibility.
- Runtime errors.
- Usage tracking.

## B. Tools + knowledge

- Tool Registry UI.
- Tool permissions.
- Knowledge sources.
- Ingestion.
- Retrieval.
- Agent knowledge attachment.

## C. Workflow product UX

- Visual workflow builder.
- Trigger/action catalog.
- Conditions.
- Scheduling.
- Execution history UI.
- Retry/error handling.

## D. Deployment product

- Application creation.
- GitHub connection.
- Environment variables.
- Deployment status.
- Logs.
- Domains.
- Rollback.

## E. Billing

- Plans.
- Entitlements.
- Wallet/credits.
- Usage events.
- Lago integration.
- Selar/NOWPayments.
- Invoices.

## F. Course/LMS

- Fork selected template to `mklms`.
- Connect Supabase.
- Implement enrollment.
- Implement course progress.
- Implement R2/OCI video pipeline.
- Implement certificate generation.

## G. Evergreen webinar

- Create separate template branch in `mklms`.
- Registration.
- Countdown.
- Evergreen player.
- Replay chat.
- CTA.
- Course purchase/enrollment integration.

## H. Telegram

- Account linking.
- Course Mini App.
- Notifications.
- Completion/certificate.
- Private community unlock.

---

# 56. WHAT NOT TO DO

Do not:

- Add Open edX to Mkety Core v1.
- Replace the locked video architecture with YouTube/Vimeo for paid production media.
- Add Gumlet/Bunny/Cloudflare Stream just because they simplify video without checking economics.
- Build a giant LMS into the core Mkety SaaS.
- Build a second independent Telegram course database.
- Put paid course videos in a public R2 bucket without access control.
- Hard-code one AI provider.
- Make production runtime execute arbitrary agent drafts when a published version exists.
- Create cross-tenant queries.
- Store secrets in Git.
- Couple the entire platform to one cloud provider.
- Spend paid cloud budget before using available startup credits when equivalent capacity is available.
- Rewrite stable existing code without inspecting it first.
- Claim “production-ready” without actual verification.

---

# 57. RESOURCE / TOOL INVENTORY

## Core application

- Next.js.
- React.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.

## Data

- PostgreSQL.
- Supabase.
- pgvector.
- Qdrant.
- Prisma — accepted ORM target.

## Identity/security

- ZITADEL.
- Cerbos.

## AI

- Vercel AI SDK.
- LiteLLM.
- Flowise.
- Gemini.
- OpenAI.
- Anthropic.
- Groq.
- Open-source models.

## Automation

- Mkety Workflow Engine.
- Activepieces.
- n8n.
- Telegram Bot API / MTProto where appropriate.

## Infrastructure

- Cloudflare Pages.
- Cloudflare Workers.
- Cloudflare R2.
- Cloudflare CDN/cache.
- Cloudflare Containers where justified.
- OCI Object Storage.
- OCI Media Flow.
- OCI Compute.
- Coolify.
- Docker.
- Redis.
- Uptime Kuma.

## Billing/payments

- Lago.
- Selar.
- NOWPayments.

## Source/deployment

- GitHub.
- GitHub Actions.
- Vercel where useful.
- Cloudflare deployment.
- Coolify deployment.

## Education/client solutions

- `foyzulkarim/nextjs-lms-boilerplate`.
- `mklms` planned repository.
- Evergreen webinar template branch planned in `mklms`.
- Moodle/Open edX considered but not selected for this current implementation.

---

# 58. IMPORTANT RESOURCE LINKS

Selected LMS template:

- https://github.com/foyzulkarim/nextjs-lms-boilerplate

Cloudflare R2 documentation:

- https://developers.cloudflare.com/r2/

OCI Media Services / Media Flow:

- https://docs.oracle.com/en-us/iaas/Content/media-services/overview.htm

OCI pricing:

- https://www.oracle.com/cloud/price-list/

Lago:

- https://www.getlago.com/

Supabase:

- https://supabase.com/

Cloudflare:

- https://www.cloudflare.com/

GitHub:

- https://github.com/

---

# 59. STATUS LEGEND

Use these labels in future updates:

- **DECIDED** — architecture/product decision accepted by the user.
- **IMPLEMENTED** — code exists in the repository.
- **VERIFIED** — actually tested/observed working.
- **IN PROGRESS** — active implementation.
- **PLANNED** — accepted future work.
- **DEFERRED** — intentionally postponed.
- **REVISIT** — intentionally left open for a later cost/technical review.

Example:

```text
Video architecture: DECIDED
OCI Media Flow integration: PLANNED
R2 production bucket: PLANNED
HLS player: PLANNED
Certificate engine: PLANNED
Agent version lifecycle: IMPLEMENTED
Workflow execution API: IMPLEMENTED
```

---

# 60. MASTER BLUEPRINT — ONE-PAGE VIEW

```text
                               MKETY
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
   Mkety Platform          Mkety Academy            Solutions
        │                        │                        │
        │                   Courses/LMS            Custom apps
        │                   Certificates            ERPNext
        │                   Telegram               Webinars
        │                        │                   Trading
        ▼                        ▼                        ▼
 ┌─────────────┐        ┌──────────────┐        ┌──────────────┐
 │ Workspaces  │        │    MKLMS     │        │ Client apps  │
 │ Projects    │        │ Next.js      │        │ / deployments│
 │ Agents      │        │ Supabase     │        │              │
 │ Workflows   │        │ Video        │        │              │
 │ Tools       │        │ Certificates │        │              │
 │ Knowledge   │        │ Telegram     │        │              │
 │ Deployments │        └──────┬───────┘        └──────────────┘
 │ Billing     │               │
 └──────┬──────┘               │
        │                      │
        ▼                      ▼
 Cloudflare                VIDEO PIPELINE
 Pages/Workers/R2               │
 CDN/Edge                       │
        │               OCI Object Storage
        │                       │
        │                 OCI Media Flow
        │                       │
        │                       ▼
        │                      HLS
        │                       │
        └───────────────────────▼
                               R2
                               │
                              CDN
                               │
                              User
```

---

# 61. FINAL ARCHITECTURAL PRINCIPLE

Mkety should behave like a **portable control plane** rather than a collection of vendor-specific products.

The application owns:

- Identity.
- Tenancy.
- Workspaces.
- Projects.
- Agents.
- Versions.
- Runtime policy.
- Workflows.
- Tools.
- Knowledge.
- Deployments.
- Billing.
- Course access.
- Certificates.
- Customer experience.

Cloud providers supply infrastructure primitives.

Third-party tools supply specialized capabilities.

Mkety provides the **orchestration, UX, policy, data model, and customer-facing product**.

The goal is to start extremely cost-efficiently using startup/free resources, prove customer demand, and only introduce higher-cost managed services when customer volume makes the economics and reliability justification clear.

---

# 62. HAND-OFF INSTRUCTION TO THE NEXT AI

If you are a new AI agent continuing Mkety:

> **Read this entire file first.**
>
> Do not ask the user to repeat the architecture already documented here.
>
> Inspect the repository and recent commits to determine what is actually implemented.
>
> Preserve the locked decisions, especially:
>
> **`OCI Media Flow + OCI Object Storage → R2 → Cloudflare CDN → Next.js/Cloudflare course & webinar platform`**
>
> and:
>
> **`mklms` = course/LMS repository; evergreen webinar = branch in the same repository.**
>
> Continue from the current codebase rather than rebuilding from zero.

---

_Last maintained as a living Mkety development hand-off document._
