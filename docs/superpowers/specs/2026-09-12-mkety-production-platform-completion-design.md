# Mkety Production + Platform Completion Design

**Date:** 2026-09-12  
**Repository:** `MketyDigital/mksaas`  
**Status:** Approved direction, implementation gated by sub-project plans  
**Authority:** `AGENTS.md` remains the architectural source of truth. This design supplements it and must not override it.

## 1. Goal

Complete the `mksaas` repository into a production-grade Mkety public website and a production-ready Mkety Platform foundation without flattening existing architectural boundaries, bypassing security gates, or modifying the standalone Trading repository.

The finished system must present Mkety as a credible, coherent technology company with complete public pages, accurate product language, correct navigation and conversion flows, safe Public AI, human-support escalation, authenticated Platform access, provider-neutral billing/entitlements/usage architecture, and a verified Cloudflare/ZITADEL runtime.

No section may remain as an attractive but non-functional placeholder. Every visible CTA, text link, card action, pricing action, plan action, support action, and product handoff must resolve to a real destination or be intentionally disabled with truthful wording.

## 2. Non-negotiable architecture

Preserve the current Mkety boundaries:

```text
Mkety
├── mkety.com public website
├── app.mkety.com Mkety Platform
├── api.mkety.com API boundary
├── Mkety Academy
└── Enterprise / Customer Solutions
    ├── Trading
    ├── mklms
    └── future customer systems
```

Trading remains visible as a Mkety Enterprise/Custom solution but is architecturally standalone.

The Trading repository must not be edited, rebased, merged, deployed, or otherwise modified as part of this work. Only shared ZITADEL-side configuration required for Mkety identity interoperability may be created or adjusted.

The application identity boundary remains:

```text
Application
  ↓
Mkety Auth Core
  ↓
ZITADEL OIDC adapter
  ↓
ZITADEL
```

Mkety owns application sessions, internal users, organizations, tenant membership, roles, permissions, billing state, entitlements, usage, and product authorization. ZITADEL supplies external identity and authentication.

Cloudflare Workers + vinext remain the target application runtime. Do not introduce Vercel as the production baseline.

## 3. Delivery decomposition

This programme is intentionally split into independently reviewable sub-projects. Each sub-project receives its own implementation plan and verification evidence before the next dependent promotion.

```text
A. Repository reconciliation + Auth/ZITADEL promotion
        ↓
B. Public website production excellence
        ↓
C. Automation Webhooks promotion
        ↓
D. Billing promotion
        ↓
E. Entitlements promotion
        ↓
F. Usage/Credits promotion + presentation
        ↓
G. Remaining Platform product completion
        ↓
H. Final production acceptance/cutover gates
```

Public-site polish may be developed in parallel conceptually, but Platform dependency promotion must preserve:

```text
Auth #16
  ↓
Automation Webhooks #15
  ↓
Billing #21
  ↓
Entitlements #22
  ↓
Usage/Credits #23
```

## 4. Sub-project A — Repository reconciliation + Auth/ZITADEL promotion

### 4.1 Reconcile current main into Auth

Use the existing Auth work rather than rebuilding it.

Required actions:

- reconcile current `main` (including merged public-site PR #24) into `feat/mkety-auth-zitadel-vinext` through the existing integration path represented by PR #25;
- resolve conflicts without weakening Auth invariants;
- preserve provider-neutral Mkety Auth and the ZITADEL adapter boundary;
- re-run the complete internal Auth verification on the reconciled head;
- re-confirm Drizzle migration order and forward-generation consistency;
- do not promote downstream branches until Auth external verification is complete.

### 4.2 ZITADEL management automation

The repository now has user-provided ZITADEL management access via a GitHub repository secret.

Implementation must use that secret only inside GitHub Actions/runtime automation and must never print, persist, commit, or expose its value.

The management workflow must be idempotent and capable of:

- identifying or creating the Mkety ZITADEL project required for `mksaas`;
- identifying or creating the Mkety OIDC application required for `app.mkety.com` and preview authentication;
- configuring Authorization Code + PKCE;
- reading non-secret application/project identifiers for later steps;
- registering exact preview callback URI `<preview-url>/api/auth/callback`;
- registering exact preview post-logout URI `<preview-url>/login`;
- registering production callback/logout URIs only when the production domain gate is explicitly authorized;
- preserving unrelated ZITADEL projects/applications;
- avoiding destructive replacement when a compatible resource already exists;
- recording only non-secret evidence.

If the repository secret name differs from the workflow's canonical secret binding, the workflow must isolate that naming difference in one environment binding rather than spreading secret-name assumptions through application code.

### 4.3 Trading identity boundary

For Trading, only ZITADEL-side resources that are actually required for shared Mkety identity may be created or adjusted.

Allowed examples:

- a dedicated Trading OIDC application under the approved Mkety identity project;
- approved redirect/logout URIs supplied by the Trading integration contract;
- organization/project roles required for shared identity interoperability.

Not allowed:

- opening or editing Trading repository source;
- changing Trading application behavior;
- copying Trading implementation into `mksaas`;
- making Trading a normal self-service Mkety workspace.

### 4.4 External Auth verification

A real isolated `mkety-platform-preview` Worker must be deployed.

Record:

- exact immutable branch SHA;
- exact workers.dev URL;
- Worker name;
- Cloudflare account identifier in non-secret form;
- ZITADEL issuer;
- ZITADEL project/application IDs where safe;
- callback/logout URIs;
- CI run IDs.

Real browser/runtime smoke must verify:

```text
login
→ ZITADEL authorization
→ callback validation
→ Mkety-owned session creation
→ protected route
→ current tenant membership authorization
→ logout
→ Mkety session revocation
→ post-logout redirect
```

Auth promotion fails closed if any step cannot be proven.

## 5. Sub-project B — Public website production excellence

The merged public website is a foundation, not an excuse to stop auditing. Every public route must be evaluated as if Mkety were being reviewed by a customer, enterprise buyer, accelerator, partner, developer, payment provider, cloud provider, or security-conscious prospect.

### 5.1 Legacy Mkety repository as reference only

The legacy `MketyDigital/Mkety` repository may be inspected for product concepts, historical positioning, page ideas, SolutionHub presentation, Resource Wallet/Mkety Credits explanations, Public AI behavior, support handoff ideas, Academy presentation, pricing concepts, and useful visual/product language.

It is not authoritative for current pricing, production claims, technical architecture, security claims, or product availability.

Useful legacy concepts should be revalidated against:

1. `AGENTS.md`;
2. current `mksaas` implementation;
3. current billing/entitlement/usage architecture;
4. current company/product decisions;
5. actual production availability.

### 5.2 Public information architecture

The public route set must be complete and production-quality:

```text
/
/platform
/workspaces
/solutions
/academy
/pricing
/enterprise
/about
/docs
/privacy
/terms
/contact
```

Add additional public routes only when they materially improve product clarity and have complete content/ownership.

No public route should feel like a single hero plus filler. Each page needs enough structure to answer what the product is, who it is for, what it does, how it relates to other Mkety products, what the next action is, and where the user goes for support.

### 5.3 Public copy audit

Audit every public-facing sentence for:

- correctness;
- grammar and wording quality;
- unnecessary jargon;
- vague claims;
- outdated template language;
- unsupported claims;
- inconsistent product naming;
- inconsistent capitalization;
- duplicated wording;
- confusing differences between Platform, Workspaces, SolutionHub, Academy, Enterprise, Trading, plans, credits, and usage;
- statements that imply unavailable production capabilities;
- accidental references to internal architecture where customer-facing language is more appropriate.

The tone should be premium, clear, technical when necessary, and understandable to non-engineers.

### 5.4 Link and CTA contract

Every interactive public element must have an explicit destination contract.

Examples:

- `Sign In` → authenticated Platform login entry;
- `Get Started` → correct signup/onboarding entry rather than a generic dead page;
- `Explore Workspaces` → `/workspaces`;
- workspace-specific actions → the correct authenticated Platform route or onboarding flow;
- `SolutionHub` actions → `/solutions` publicly, then authenticated SolutionHub/product flow when the user chooses a solution;
- `Pricing` → `/pricing`;
- plan purchase/select actions → provider-neutral checkout creation for the selected plan/version;
- `Mkety One` → its exact plan selection/checkout flow;
- Enterprise/Trading → Enterprise qualification/contact flow, never self-service checkout unless explicitly supported;
- Academy → approved Academy destination;
- docs links → exact relevant public documentation;
- support/contact → human-support route/channel;
- Public AI suggestions → only destinations the assistant is allowed to recommend.

Automated tests must crawl internal links and verify the public CTA registry against real routes or explicitly approved external URLs.

### 5.5 SolutionHub presentation

SolutionHub must be presented as a meaningful product capability, not a small generic card group.

Public presentation should explain:

- what a solution/blueprint is;
- how a solution differs from a Workspace;
- solution categories;
- how solutions can combine AI, Automation, Deploy, integrations, and business logic;
- ready-made vs configurable vs Enterprise/custom solutions;
- what happens after a user selects a solution;
- how authentication, plan eligibility, entitlements, deployment, and support fit into the flow.

Use useful concepts from the legacy marketplace/SolutionHub where still truthful, but do not publish solution cards that imply a production-ready deliverable if no corresponding implementation or delivery path exists.

### 5.6 Usage, Credits and Resource Wallet presentation

The public site and docs must clearly explain the commercial model without exposing internal accounting implementation details.

Public language must distinguish:

- subscription plan;
- plan allowance;
- measured usage;
- Mkety Credits;
- credit consumption;
- top-up/purchased credits if and when implemented;
- plan upgrade;
- usage limits/throttling behavior where applicable;
- billing period;
- Enterprise/custom commercial terms.

The legacy `Resource Wallet` idea may be retained if it remains useful, but current implementation terminology must be consistent across public site, Platform, billing screens, usage screens, docs, and support.

Do not advertise overages, purchasable top-ups, expiry, refunds, or wallet capabilities before those behaviors are implemented and verified.

### 5.7 Pricing and payment journey

The pricing page must be a real decision surface.

It must:

- explain Starter, individual Workspaces, Mkety One, and Enterprise clearly;
- show current price/period/currency from the authoritative Mkety pricing source;
- show meaningful included capabilities/allowances;
- distinguish plan access from metered credits;
- explain which plan fits which customer;
- state Enterprise as custom where appropriate;
- route self-service plan actions into the correct checkout path;
- route Enterprise into qualification/contact;
- return users from payment into an authoritative settlement/provisioning state rather than trusting browser success alone;
- avoid hard-coded provider-specific assumptions in public components.

### 5.8 Enterprise page

Enterprise must be a complete commercial page, not a generic contact card.

It should explain:

- custom systems and integrations;
- managed implementations;
- specialized infrastructure;
- Trading as a Custom/Enterprise solution;
- dedicated support/implementation options;
- discovery/scoping process;
- commercial proposal/payment process;
- security/architecture review availability where truthful;
- expected next steps after enquiry;
- clear contact/qualification CTA.

The page must not claim certifications, SLAs, geographic coverage, 24/7 support, regulated status, or capabilities that have not been formally established.

### 5.9 Public AI experience and human handoff

Public Mkety AI is a visitor assistant, not the authenticated Platform Agent Builder.

It may:

- explain Mkety;
- explain Platform/Workspaces/SolutionHub/Academy/Enterprise;
- explain plans, usage, credits, and billing using approved public information;
- help users navigate;
- recommend relevant public pages;
- help users choose the appropriate next action;
- offer human-support escalation.

It must not:

- access tenant-private data;
- expose internal prompts/secrets;
- execute arbitrary tools;
- invent prices or availability;
- provide unsupported legal/security/commercial commitments;
- impersonate a human support agent.

Human escalation flow:

```text
visitor question
→ Public AI answers from approved public knowledge
→ detects support/sales/enterprise/account/billing issue or user asks for human
→ summarizes the user's intent without sensitive data
→ offers the approved human-support channel(s)
→ sends user to /contact or approved live-support destination
→ preserves an optional safe conversation summary/reference for the human team only if consented and technically supported
```

If live chat is not implemented, the assistant should say that clearly and present the real contact method instead of pretending a human has joined the chat.

Rate-limit/failure behavior must also provide a real human-support path.

### 5.10 Public contact and support model

`/contact` should route people by intent:

- product/general;
- sales/plans;
- Enterprise/Trading;
- Academy;
- account/billing support;
- technical/support enquiries;
- partnerships.

Only channels Mkety actually monitors should be published.

Sensitive secrets, passwords, API keys, recovery codes, and payment credentials must never be requested through general contact forms or Public AI.

### 5.11 Public production quality

Every page must pass:

- responsive desktop/tablet/mobile review;
- keyboard navigation;
- visible focus states;
- semantic heading order;
- accessible labels;
- contrast review;
- no horizontal overflow;
- loading/fallback/error behavior;
- broken-link crawl;
- metadata/canonical/OG review;
- sitemap/robots inclusion rules;
- 404/not-found behavior;
- real external CTA verification;
- performance and large-asset review;
- no placeholder text;
- no empty sections;
- no dead buttons;
- no unhandled `#` links;
- no production claims unsupported by implementation.

## 6. Sub-project C — Automation Webhooks promotion

After Auth is promoted, rebase/reconcile Webhooks #15 onto the promoted Auth ancestry.

Preserve:

- opaque endpoint identifiers;
- HMAC-SHA256 raw-body authentication;
- encrypted webhook secret storage;
- duplicate/event replay protection;
- bounded body/media validation;
- tenant/project scoping;
- shared workflow execution path;
- fail-closed authorization.

Re-run full verification on the new ancestry. Historical green evidence is not sufficient after ancestry changes.

## 7. Sub-project D — Billing promotion

Promote Billing #21 only after Webhooks is promoted.

Preserve the provider-neutral billing domain:

- Plans;
- immutable Plan Versions;
- Subscriptions;
- Billing Periods;
- Checkouts;
- verified Settlements;
- append-only Ledger entries;
- capability-driven renewal;
- audited manual/offline fallback.

Selar/NOWPayments remain adapters, not application truth.

Browser checkout success never grants access. Only verified settlement/application state may advance billing state.

Public pricing and checkout must consume the same authoritative plan/version model.

## 8. Sub-project E — Entitlements promotion

Promote Entitlements #22 after Billing.

Entitlements remain the authorization bridge between commercial state and product access.

Requirements:

- versioned plan entitlements;
- tenant grant/deny overrides;
- deny-by-default resolver;
- current tenant membership authorization;
- no direct provider-webhook-to-feature access;
- consistent workspace/product guards across server/API/UI.

## 9. Sub-project F — Usage/Credits promotion + presentation

Promote Usage/Credits #23 after Entitlements.

Preserve:

- stable meter vocabulary;
- tenant-scoped bigint accounting;
- plan-version allowances;
- immutable usage events;
- append-only credit ledger;
- transactional/idempotent grants;
- concurrent debit protection;
- entitlement check before charge where required;
- no floating-point credit arithmetic.

Then connect this domain to:

- Platform usage page;
- billing summary;
- plan allowance presentation;
- Resource Wallet/Credits terminology chosen for the product;
- public docs;
- support/Public AI knowledge.

Do not silently invent purchased-pack behavior if it is not implemented.

## 10. Sub-project G — Remaining Platform product completion

After the foundational commercial/auth stack is promoted, audit the authenticated Platform against `AGENTS.md` and classify every major capability as:

```text
production-ready
implemented but incomplete
foundation only
planned/not implemented
obsolete/superseded
```

Areas to audit include:

- organization/tenant onboarding;
- teams/members/invites;
- projects;
- AI Workspace;
- agents;
- knowledge;
- tools;
- models;
- AI applications/runs/versioning;
- Automation Workspace;
- webhook triggers;
- workflow execution/history;
- Deploy Workspace;
- domains;
- SolutionHub;
- usage/credits;
- billing;
- entitlements;
- settings;
- Platform Control Center/admin;
- notifications/support;
- docs/help;
- auditability/observability.

Only capabilities required by the current Mkety blueprint should be completed. Do not invent large speculative subsystems merely to fill menus.

## 11. Data and migration safety

Use only the Mkety-owned database schema and repository-controlled migrations.

Do not:

- run broad destructive resets on the shared database;
- modify unrelated schemas/projects;
- replace Mkety Auth with Supabase Auth;
- add broad RLS policies merely to silence advisory output;
- rewrite historical migrations after they have become authoritative;
- bypass migration integrity checks.

Every promoted branch must prove forward migration consistency from the current promoted ancestry.

## 12. Security requirements

Across all sub-projects:

- secrets only in approved GitHub/Cloudflare secret stores;
- no plaintext secret logging;
- no provider tokens in browser bundles;
- state/nonce/PKCE validation for OIDC;
- server-side authorization for protected actions;
- tenant scope enforced from current DB state;
- webhook signatures verified over exact bytes;
- billing settlement verification provider-side and database-authoritative;
- idempotency on externally retryable operations;
- bounded request sizes and execution;
- rate limits on abuse-prone public endpoints;
- safe Public AI tool boundary;
- no cross-tenant reads;
- no security claims in public copy that exceed actual controls.

## 13. Testing and evidence model

No feature is considered complete because code exists.

For relevant sub-projects require:

- targeted tests;
- full test suite;
- TypeScript type-check;
- lint;
- migration integrity;
- Drizzle consistency;
- vinext compatibility;
- production build;
- Cloudflare dry-run;
- real isolated preview deployment when runtime behavior matters;
- browser/runtime smoke for user-facing flows;
- immutable SHA evidence;
- exact run IDs;
- no reuse of stale green evidence after ancestry/code changes.

Public-site work additionally requires link crawling, accessibility smoke, metadata/SEO validation, CTA destination tests, and responsive visual review.

## 14. Production cutover boundary

Implementation approval is not automatic authorization to mutate live production routing.

Live `mkety.com` or `app.mkety.com` cutover must occur only through the repository's explicit production gate after exact-SHA verification succeeds.

Existing rollback paths must be recorded before changing production routes.

## 15. Definition of done

The programme is complete when:

- `mkety.com` presents a complete, polished, truthful, world-class Mkety public experience;
- every public page is substantive and production-ready;
- every CTA/link has an intentional working destination;
- SolutionHub is clearly presented and connected to real user flows;
- pricing/payment/plan journeys are coherent and authoritative;
- usage/credits terminology and presentation match the implemented accounting model;
- Enterprise and Trading positioning are complete and truthful;
- Public AI safely answers public questions and escalates to real human support;
- Auth/ZITADEL works end-to-end on real Cloudflare runtime;
- downstream Webhooks → Billing → Entitlements → Usage/Credits are promoted in order with fresh evidence;
- authenticated Platform capabilities are audited and all launch-required gaps are completed;
- no half-built public sections, dead buttons, placeholder flows, stale template branding, or misleading capability claims remain;
- production deployment/cutover is independently verified and rollback-safe.

## 16. Implementation planning rule

This master design is not executed as one giant change. Produce separate implementation plans in this order:

1. Auth/ZITADEL reconciliation and external promotion.
2. Public website production excellence and legacy-content reconciliation.
3. Webhooks promotion.
4. Billing promotion and public checkout integration.
5. Entitlements promotion.
6. Usage/Credits promotion and product presentation.
7. Remaining Platform completion audit and implementation batches.
8. Final production acceptance and cutover.

Each plan must use TDD where behavior changes, preserve immutable evidence, and end in a reviewable working state before the next dependent plan begins.
