# Mkety AI Enterprise Capability Map

## Purpose

Mkety AI Enterprise is a separate paid enterprise product/add-on from the normal AI Workspace. It is designed as an extensible AI operating layer for organizations across industries rather than as a single chat product.

This capability map is intentionally broader than the first production release. It defines the solution surface that the platform architecture should be able to support without weakening tenant isolation, PBAC, commercial accounting, reliability, auditability, or provider portability.

Capabilities are not automatically enabled for every tenant. They are entitlement-, policy-, role-, project-, environment-, model-, region-, and budget-gated.

## Product invariants

Every Enterprise AI capability must preserve these invariants:

- tenant and project isolation by default
- least-privilege PBAC and explicit service identities
- auditable human and machine actions
- atomic commercial admission before paid provider work
- configurable budgets, quotas, rate limits, concurrency, and hard stops
- customer-controlled data retention and deletion
- model/provider portability with explicit routing policies
- no plaintext provider/customer secrets in application tables
- safe replay/idempotency for commercial and tool actions
- human approval gates for consequential actions
- versioned agents, prompts, tools, workflows, policies, and knowledge
- observable cost, quality, latency, errors, and policy decisions
- deterministic rollback/disable controls
- environment separation for test/staging/live
- accessibility, localization, timezone, and locale awareness
- feature flags and entitlements for progressive activation

## 1. Enterprise administration and organization control

Support organization structures that businesses commonly need:

- organization, subsidiary, business unit, department, team, workspace, project, environment, and region scopes
- owners, admins, builders, developers, analysts, knowledge managers, channel managers, finance admins, auditors, security admins, reviewers, and custom roles
- custom PBAC roles and permission bundles
- service accounts and machine identities
- temporary/delegated access
- approval chains
- separation-of-duties policies
- IP/network allowlists
- SSO/SAML/OIDC
- SCIM lifecycle provisioning
- MFA/step-up authentication for sensitive actions
- session and device controls
- emergency break-glass access with enhanced audit
- tenant-level feature policies
- project-level overrides where permitted
- regional/data-residency controls
- environment promotion controls
- tenant export, archive, suspension, and secure deletion

## 2. AI workspace and conversational experiences

Enterprise users should be able to operate AI through:

- private chats
- team/shared conversations
- project conversations
- persistent workspaces
- conversation folders, labels, search, and pinning
- reusable instructions and profiles
- conversation branching
- editable drafts
- citations and source inspection
- file/image/audio/video inputs
- document generation and transformation
- tables, structured output, forms, and JSON
- voice input/output
- real-time and asynchronous jobs
- multilingual interaction
- tone/style controls
- reusable prompt templates
- prompt variables
- organization-approved prompt libraries
- conversation retention policies
- legal hold/export where required
- sensitive-conversation restrictions
- share links with policy controls
- internal-only and external-safe response modes

## 3. Agents and digital workers

Agents should support both simple assistants and long-running enterprise digital workers:

- agent creation from templates or from scratch
- versioned system instructions
- model selection and routing policies
- knowledge attachments
- tool permissions
- memory policies
- schedules and triggers
- event-driven execution
- multi-step plans
- stateful execution
- resumable runs
- bounded autonomy
- human approval checkpoints
- agent-to-agent delegation
- supervisor/worker agent patterns
- multi-agent teams
- role-specialized agents
- task queues
- retries with idempotency
- dead-letter handling
- pause/resume/cancel
- run history and replay
- run comparison
- deterministic test mode
- agent scoring/evaluations
- canary releases
- rollback to prior versions
- environment-specific configuration
- per-agent budgets and concurrency
- per-agent safety policies
- agent ownership and maintainers
- agent catalogs/marketplace inside a tenant
- clone/import/export
- white-label embedded agents

## 4. Workflow automation and orchestration

Enterprise AI should operate inside business processes, not only chat:

- visual and code-based workflows
- event triggers
- schedules/cron
- webhooks
- form submissions
- email/message triggers
- database changes
- CRM/helpdesk events
- file arrival
- approval outcomes
- third-party events
- conditional branching
- loops and batch processing
- parallel steps
- waits/delays
- human tasks
- SLA timers
- escalation paths
- compensation/rollback steps
- retry policies
- idempotency keys
- deduplication
- concurrency controls
- workflow variables and secrets
- subflows
- reusable components
- environment promotion
- versioning and rollback
- test fixtures and dry runs
- audit trail per step
- cost attribution per workflow
- policy checks before consequential actions

## 5. Enterprise knowledge and RAG

Knowledge should support organization-grade governance:

- files, folders, websites, wikis, databases, CRM records, tickets, catalogs, policies, manuals, contracts, and structured datasets
- connectors and scheduled sync
- incremental indexing
- chunking strategies
- embeddings/model selection
- metadata enrichment
- access-control-aware retrieval
- tenant/project/department/document permissions
- document versions
- source freshness
- duplicate detection
- language detection
- OCR where appropriate
- table extraction
- image/diagram understanding
- citation generation
- source confidence
- retrieval filters
- hybrid lexical/vector search
- reranking
- query rewriting
- knowledge graph/relationship support
- entity extraction
- taxonomy and ontology support
- retention/deletion
- legal hold
- personally identifiable information classification
- sensitive-data tagging
- knowledge quality dashboards
- stale-source alerts
- broken-connector alerts
- evaluation datasets for retrieval quality

## 6. Tool use and business actions

AI tools may include read-only and write actions. Consequential actions require explicit policy:

- internal API tools
- customer-defined HTTP tools
- database queries
- safe database mutations
- CRM actions
- ERP actions
- helpdesk actions
- HRIS actions
- project-management actions
- calendar actions
- email actions
- messaging actions
- document actions
- spreadsheet actions
- storage actions
- finance/accounting actions
- commerce/order actions
- logistics actions
- marketing actions
- developer/CI actions
- infrastructure actions
- custom MCP-compatible tools where supported
- function calling
- structured tool schemas
- tool credential isolation
- per-tool permissions
- read/write classification
- allow/deny lists
- required approvals
- parameter validation
- output validation
- timeout/retry policy
- idempotency
- transaction/compensation support
- tool audit logs
- sandbox/test credentials
- rate limits and quotas

## 7. Channels and omnichannel delivery

Enterprise AI should be usable through the channels businesses already operate:

- Mkety web app
- public/embedded web chat
- authenticated customer portals
- mobile apps
- email
- SMS
- WhatsApp
- Telegram
- Slack
- Microsoft Teams
- Discord where relevant
- voice/telephony
- contact-center integrations
- social messaging connectors
- in-product SDKs
- API
- webhooks
- browser extension
- internal dashboards
- kiosk/terminal experiences
- QR/deep-link entry points

Channel controls should include identity mapping, opt-in/consent, templates, session routing, escalation, business hours, language, handoff, retention, and per-channel policy/budget controls.

## 8. Customer support and contact-center capabilities

Common cross-industry support needs include:

- FAQ/knowledge answers
- ticket triage
- intent classification
- sentiment signals
- priority/SLA classification
- suggested replies
- autonomous low-risk resolution
- escalation to humans
- handoff summaries
- customer identity/context
- conversation history
- multilingual support
- agent assist
- quality assurance
- call/chat summarization
- disposition codes
- next-best action
- refund/credit approval workflows
- complaint handling
- knowledge gap detection
- deflection and containment analytics
- CSAT/NPS follow-up workflows
- supervisor review queues
- regulated-script enforcement

## 9. Sales, marketing, and customer-success capabilities

Support teams may need:

- lead qualification
- enrichment
- account research
- prospect summaries
- outreach drafting
- follow-up automation
- CRM note generation
- meeting preparation
- meeting summaries
- objection handling
- proposal/RFP assistance
- quote support
- product recommendations
- cross-sell/upsell suggestions
- churn-risk workflows
- renewal assistance
- onboarding journeys
- campaign content generation
- segmentation assistance
- localization
- brand voice enforcement
- approved-claims policy
- campaign performance summaries
- customer-success health summaries

## 10. Finance, procurement, and operations capabilities

Potential enterprise workflows include:

- invoice extraction
- expense classification
- reconciliation assistance
- collections reminders
- payable/receivable workflows
- budget explanations
- variance summaries
- procurement intake
- vendor comparison
- purchase-request routing
- contract metadata extraction
- inventory analysis
- demand planning assistance
- operations reporting
- SOP assistance
- incident summaries
- maintenance triage
- scheduling
- capacity planning
- exception detection
- approval routing
- audit preparation

AI-generated financial actions should remain approval-gated unless a tenant explicitly configures a safe automation policy.

## 11. HR and workforce capabilities

Organizations may use Enterprise AI for:

- employee helpdesk
- policy Q&A
- onboarding
- training assistants
- role-based learning
- job-description drafting
- interview-kit preparation
- candidate summarization subject to applicable law/policy
- performance-review drafting support
- manager coaching prompts
- internal mobility assistance
- workforce survey summarization
- scheduling
- leave/policy workflows
- compliance training
- knowledge transfer
- offboarding checklists

High-impact employment decisions must support human review, policy controls, auditability, and jurisdiction-specific restrictions.

## 12. Legal, risk, compliance, and security capabilities

Potential capabilities include:

- contract summarization
- clause extraction
- playbook comparison
- obligation tracking
- policy Q&A
- regulatory-change ingestion
- compliance evidence collection
- audit preparation
- risk registers
- control mapping
- incident summarization
- security alert triage
- phishing/security-awareness assistance
- data classification
- sensitive-data detection
- redaction
- retention-policy enforcement
- eDiscovery/export support
- policy violations and review queues

The platform should never silently convert AI output into a final legal/compliance decision when tenant policy requires professional review.

## 13. Developer and technical operations capabilities

Technical teams may need:

- coding assistance
- repository-aware chat
- code explanation
- test generation
- review assistance
- migration drafting
- runbook assistance
- incident response
- log summarization
- infrastructure documentation
- API generation
- SDK examples
- CI/CD workflow assistance
- release notes
- dependency analysis
- security review assistance
- issue triage
- architecture knowledge
- environment-aware assistants
- tool-calling into approved developer systems
- sandbox execution where explicitly supported

## 14. Multimodal document and media intelligence

The platform should be able to support:

- PDF understanding
- document extraction
- forms
- invoices
- receipts
- contracts
- images
- charts
- screenshots
- diagrams
- scanned documents
- audio transcription
- speaker separation where supported
- video summarization
- frame/key-moment extraction
- image classification
- visual question answering
- document comparison
- structured field extraction
- translation
- redaction
- generated reports and presentations

## 15. Model and provider management

Enterprise customers commonly need:

- managed Mkety models
- customer BYOK providers
- approved model catalog
- provider connections
- model aliases
- default models
- per-task routing
- capability-aware routing
- latency-aware routing
- cost-aware routing
- region-aware routing
- reliability-aware routing
- policy-aware routing
- fallback chains
- circuit breakers
- health checks
- canary models
- A/B evaluation
- model retirement
- pinned versions
- model allow/deny lists
- context/output limits
- temperature/reasoning policies
- structured-output enforcement
- tool-capability enforcement
- provider outage controls
- gateway observability

No customer BYOK failure should silently fall back to Mkety-paid credentials unless an explicit commercial policy authorizes it.

## 16. FinOps, credits, budgets, and commercial controls

Support hierarchical enterprise spend controls:

- tenant budgets
- department/workspace budgets
- project budgets
- agent/workflow budgets
- API-key budgets
- channel budgets
- model/provider budgets
- daily/weekly/monthly/custom periods
- request limits
- token limits
- credit limits
- concurrency limits
- soft thresholds
- hard stops
- alert thresholds
- approval-to-exceed workflows
- temporary budget increases
- rollover rules where commercially supported
- cost centers
- tags
- showback/chargeback
- invoices/usage exports
- raw provider-cost visibility where contractually appropriate
- Mkety credit consumption
- forecasted spend
- anomaly detection
- budget exhaustion alerts
- reservation/settlement accounting
- failed-request release
- reconciliation and repair workflows

## 17. Reliability, performance, and scale

Enterprise runtime behavior should include:

- bounded provider timeouts
- retry policy only where safe
- idempotent retries
- explicit fallback
- circuit breakers
- load shedding
- queueing for async workloads
- dead-letter queues
- backpressure
- per-tenant/project/key rate limits
- concurrency limits
- streaming controls
- request cancellation
- resumable async jobs
- tenant-safe caching
- semantic cache where policy permits
- response cache where policy permits
- cache invalidation/versioning
- availability monitoring
- provider health
- latency percentiles
- error budgets
- SLO/SLA reporting
- regional failover where supported
- maintenance/degraded-mode messaging

## 18. Observability, analytics, and governance

Enterprise administrators should be able to answer who used AI, what happened, why, and what it cost:

- request traces
- agent/workflow run traces
- tool-call traces
- model/provider selection
- routing decision
- policy decision
- latency
- token/credit usage
- cache behavior
- errors/retries/fallback
- human approvals
- data sources/citations
- security events
- admin changes
- budget events
- exportable audit log
- dashboards
- custom date ranges
- filters by tenant/project/team/user/agent/model/key/channel
- anomaly detection
- adoption analytics
- quality analytics
- support containment
- workflow success
- business KPI attribution where configured

## 19. AI quality, evaluations, and release management

Organizations should be able to test AI before trusting it:

- evaluation datasets
- golden answers
- retrieval evaluations
- tool-call evaluations
- structured-output evaluations
- regression tests
- safety tests
- adversarial tests
- latency tests
- cost tests
- model comparisons
- prompt comparisons
- agent version comparisons
- offline evaluations
- shadow traffic where permitted
- canary release
- approval before production promotion
- rollback
- quality thresholds
- drift monitoring
- human grading
- automated grading with explicit limitations

## 20. Safety and policy controls

Enterprise policies may require:

- prohibited-use rules
- topic restrictions
- data-loss prevention
- PII/secret detection
- redaction
- prompt-injection defenses
- retrieval source trust policies
- tool-call allowlists
- URL/domain restrictions
- file-type restrictions
- external-sharing restrictions
- jailbreak monitoring
- abuse/rate controls
- content moderation
- age/region policies where relevant
- human approval for high-impact actions
- safe completion behavior
- tenant-configurable policy layers
- immutable platform minimum safeguards

## 21. Data governance and privacy

Support enterprise data requirements such as:

- configurable retention
- deletion schedules
- user/tenant export
- data classification
- regional storage controls
- encryption
- secret references
- access logging
- consent tracking where applicable
- customer content isolation
- training-use controls
- audit/legal hold
- source lineage
- backup/restore policies
- secure connector credentials
- revocation propagation
- data minimization
- policy-driven masking/redaction

## 22. Integration platform and extensibility

Mkety AI Enterprise should be able to integrate broadly without embedding vendor-specific assumptions into the core:

- first-party connectors
- OAuth integrations
- API keys/secrets
- webhooks
- custom HTTP connectors
- database connectors
- file/storage connectors
- CRM
- ERP
- accounting
- helpdesk
- HRIS
- collaboration
- project management
- commerce
- analytics
- data warehouses
- developer tools
- identity providers
- custom enterprise systems
- connector marketplace
- tenant-private connectors
- versioned connector schemas
- sync jobs
- connection health
- credential rotation
- connector audit logs

## 23. Embedded, white-label, and developer platform

Businesses may want to ship Mkety AI inside their own products:

- REST/OpenAI-compatible APIs where appropriate
- SDKs
- web components
- chat widgets
- mobile SDKs
- authenticated embeds
- tenant/project API keys
- service accounts
- scoped keys
- short-lived tokens
- usage webhooks
- custom domains
- branding
- themes
- localization
- custom legal text
- customer identity handoff
- per-end-user limits
- per-customer subaccounts/projects
- webhook events
- audit exports

## 24. Industry solution packs

The core should remain horizontal while allowing policy/templates/connectors/workflows to form industry packs, for example:

- retail and ecommerce
- professional services
- financial services
- insurance
- healthcare operations
- education
- hospitality
- travel
- logistics and transportation
- manufacturing
- construction
- real estate
- telecommunications
- media
- government/public-sector workflows where permitted
- nonprofits
- energy/utilities
- agriculture
- legal services
- accounting
- technology/SaaS

Industry packs should reuse the same core runtime, PBAC, audit, knowledge, workflow, budget, evaluation, and integration primitives rather than fork the platform.

## 25. Human-in-the-loop behaviors

Human agency should be first-class:

- approve/reject
- edit before send
- edit before tool execution
- request more information
- assign to reviewer
- escalate
- pause automation
- require dual approval
- require role-specific approval
- approval expiration
- override with reason
- audit override
- sample-based review
- confidence-based review
- policy-based mandatory review

## 26. Enterprise behavior expectations

Across all capabilities, Enterprise Mkety AI should behave predictably:

- explain when required information is missing
- distinguish retrieved facts from generated analysis
- cite enterprise sources when configured
- avoid claiming actions succeeded before confirmation
- surface partial failures
- preserve idempotency on retries
- respect business hours/timezones where configured
- use customer terminology/taxonomy
- follow brand voice where configured
- ask for approval before consequential actions when policy requires
- fail closed on authorization/commercial uncertainty
- degrade gracefully on provider/tool outage
- never cross tenant/project boundaries
- make cost/routing behavior observable to authorized admins
- preserve an auditable record of consequential actions

## Implementation rule

New product features should be built by composing shared primitives—identity/PBAC, entitlements, projects, knowledge, agents, workflows, tools, channels, runtime routing, usage/credits, budgets, audit, evaluations, integrations, and observability—rather than creating industry-specific security or billing silos.

This lets Mkety AI Enterprise become highly feature-rich across industries while keeping the security and commercial core understandable, testable, and reliable.


## 2026-09-28 launch composition

The first Enterprise AI product composition must include:

- outcome-first business console for non-technical customers;
- plan/subscription/usage/credit visibility;
- full white-label brand controls when entitled;
- managed `*.mkety.app` customer hostname;
- Cloudflare for SaaS customer-owned hostname path with simple CNAME onboarding;
- provider-neutral domain purchase/reseller path;
- Website, WhatsApp Business, Telegram, Instagram Direct, Facebook Messenger, Slack, Discord, LinkedIn Page Community, Microsoft Teams outbound workflow/webhook and custom webhook/API channel families;
- LinkedIn Page Community is limited to approved organization community/comment workflows; it is not unrestricted LinkedIn inbox/DM automation;
- Microsoft Teams inbound remains outside the launch contract until Bot Framework identity verification is implemented; current Teams support is outbound workflow/webhook;
- human-handoff capability on conversational channels;
- provider-neutral managed inference with exact prepaid admission and settlement;
- internal provider-cost and margin telemetry separated from customer billing.

Adding a channel, domain or brand never creates a second tenant or identity system.

## Implemented channel media input

Telegram is the first Enterprise channel with implemented multimodal inbound handling: photos/images are visually interpreted and voice/audio notes are transcribed before the selected assistant answers. Media is fetched only server-side from Telegram using the encrypted bot credential, with bounded file size/type/duration and the same tenant, entitlement, commercial-admission, cost-envelope, audit and human-handoff controls as text messages.

The channel registry now distinguishes actual `supportsImageInput` and `supportsAudioInput` capability from general channel availability. Other channels remain text-only until their provider-specific inbound media contracts are implemented and tested.
