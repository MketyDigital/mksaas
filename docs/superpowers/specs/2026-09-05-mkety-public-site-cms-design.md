# Mkety Public Site, Global Docs, and Admin CMS Design

> **Status:** SPECIFICATION
> **Date:** 2026-09-05
> **Repository:** `MketyDigital/mksaas`
> **Branch:** `spec/mkety-public-site-cms`
> **Authority:** Implements the current `AGENTS.md` master blueprint for the first major frontend batch.

---

## 1. Goal

Build the production-ready public Mkety customer, marketing, sales, and information site for `mkety.com`, plus a complete global documentation experience, using the existing mksaas visual system while making all public-facing content manageable from admin without routine code changes.

The work must convert the current generic SaaS AI template presentation into the official Mkety public experience.

---

## 2. Scope

This specification covers three connected surfaces:

1. **Public website**
   - `mkety.com` customer/marketing/sales/info experience.
   - Root homepage and supporting public information sections/pages.
   - Clear presentation of Mkety Platform, Workspaces, SolutionHub, Academy, Pricing/Plans, Enterprise, and Trading as Custom/Enterprise.

2. **Global docs**
   - `/docs` as a polished public documentation portal using the existing mksaas docs template.
   - Content rewritten from the master blueprint and current product architecture.
   - Docs must explain the planned Mkety system, not the old generic template.

3. **Admin-editable content system**
   - Admin users must be able to edit public website and docs content from the application UI.
   - Frontend public pages must render from the content system with safe fallbacks.
   - Content updates must not require changing source code for normal copy, navigation, page sections, pricing language, FAQs, docs entries, or call-to-action text.

---

## 3. Current Repository Findings

The existing repository already has:

- A root public landing page at `src/app/page.tsx`.
- Landing components under `src/app/_landing-components/`.
- Landing copy/data in `src/app/landing-data.ts`.
- A docs route group at `src/app/(docs)/docs`.
- File-backed docs content under `src/features/docs/content/en` and `src/features/docs/content/es`.
- Tenant admin routes under `src/app/(tenant)/t/[tenant]/admin`.
- Tenant settings stored on the `tenants.settings` text field and parsed through `src/shared/lib/tenant-settings.ts`.

The current public site and docs still reflect the original template and must be converted to Mkety.

---

## 4. Product Positioning Requirements

The public site must communicate that Mkety is a broader technology platform, not an AI-only company.

Primary positioning:

> Mkety is a technology platform for building, automating, deploying, integrating, and operating modern business systems with AI, workflows, cloud infrastructure, and ready-made solutions.

Core language:

- Build
- Automate
- Deploy
- Use AI
- Integrate
- Operate

Mkety must be presented as:

- A platform for customers and businesses.
- A credible technology company.
- A customer solution provider.
- A training and enablement company through Mkety Academy.
- A provider of enterprise/custom solutions.

Avoid presenting Mkety as only:

- A chatbot product.
- A generic AI startup.
- A hosting reseller.
- A template marketplace without platform depth.

---

## 5. Public Site Information Architecture

The top-level navigation should be compact and product-led:

- Home
- Platform
- Workspaces
- SolutionHub
- Academy
- Pricing
- Enterprise
- Docs
- About
- Sign In
- Get Started

The public website may be implemented first as a rich, tab-oriented single-page experience with anchored sections, then expanded into dedicated route pages where necessary. The architecture must support both.

Required public sections:

1. **Hero**
   - Mkety brand promise.
   - Primary CTA: Get Started.
   - Secondary CTA: Explore Platform or View Docs.
   - Visual preview of Platform, Workspaces, SolutionHub, and Docs.

2. **Platform Overview**
   - Explain Mkety Platform as the core SaaS/PaaS product.
   - Show how Projects, Workspaces, AI, Automation, Deployment, Usage, Credits, Billing, and Teams fit together.

3. **Workspaces**
   - AI Workspace.
   - Automation Workspace.
   - Deploy Workspace.
   - Trading Workspace visible as Custom/Enterprise.

4. **SolutionHub**
   - Ready-made business solutions and templates.
   - Classification between shared-platform solutions and enterprise/custom solutions.

5. **Academy**
   - Training, courses, workshops, webinars, certifications, and enterprise training.
   - Academy must be visible but not dominate the homepage.

6. **Pricing / Plans**
   - Use approved language: Plans, Pricing, Credits, Usage, Custom, Enterprise, Lite Offer where applicable.
   - Do not sell CPU/RAM/server slices for normal plans.
   - Do not use “African edition” as public plan language.

7. **Enterprise**
   - Custom systems, specialized implementations, trading infrastructure, customer projects, and enterprise support.

8. **Public Mkety AI**
   - Present a public-facing Mkety assistant for visitor questions and navigation.
   - Keep this concept separate from the authenticated Platform Agent Builder.

9. **Trust / Readiness**
   - Explain security, tenant isolation, Cloudflare + OCI target, controlled deployment, and production maturity without overclaiming unverified production status.

10. **FAQ**
   - Product, pricing, workspaces, solutions, Academy, Enterprise, docs, and support questions.

11. **Footer**
   - Product links, company links, docs links, legal links, sign-in and get-started links.

---

## 6. Global Docs Information Architecture

The `/docs` experience must become the public Mkety documentation hub.

Required docs categories:

1. **Getting Started**
   - What Mkety is.
   - Who Mkety is for.
   - How the public site, app, API, and customer apps relate.
   - High-level path: Discover → Choose Plan → Enter Platform → Choose Workspace → Build or Choose Solution → Deploy/Operate → Track Usage → Scale.

2. **Platform**
   - Organizations.
   - Users.
   - Teams.
   - Projects.
   - Workspaces.
   - SolutionHub.
   - Usage.
   - Credits.
   - Billing.
   - Administration.

3. **Workspaces**
   - AI Workspace.
   - Automation Workspace.
   - Deploy Workspace.
   - Trading Workspace as Custom/Enterprise.

4. **AI**
   - Agents.
   - Agent Builder.
   - Knowledge.
   - Tools.
   - Models.
   - AI Applications.
   - Runs.
   - Versions.
   - Publishing.

5. **Automation**
   - Triggers.
   - Workflows.
   - Actions.
   - Conditions.
   - Transformations.
   - Webhooks.
   - Manual execution.
   - Run history.
   - Bounded retries.

6. **Deployments**
   - Applications.
   - Environments.
   - Preview.
   - Production.
   - Domains.
   - Custom domains.
   - Cloudflare.
   - OCI.
   - `*.mkety.app` customer application domains.

7. **SolutionHub**
   - Ready-made solutions.
   - AI solutions.
   - Automation solutions.
   - Deployment solutions.
   - Business solutions.
   - Industry solutions.
   - Enterprise solutions.

8. **Plans, Pricing, Billing, Usage**
   - Plans vs Pricing vs Credits vs Usage vs Entitlements.
   - Lite Offer terminology.
   - Enterprise/Custom pricing rules.
   - Ledger-backed wallet and credits concept.

9. **Academy**
   - Courses.
   - Lessons.
   - Webinars.
   - Registrations.
   - Certificates.
   - Enterprise training.

10. **Enterprise**
    - Trading.
    - mklms.
    - Customer projects.
    - Shared services.
    - Deployment boundaries.

11. **Security and Operations**
    - Tenant isolation.
    - Authorization.
    - Secrets.
    - Audit logs.
    - Rate limiting.
    - Observability.
    - Safe logging.
    - Production readiness.

12. **Administration**
    - How admins manage public site content.
    - How admins manage docs content.
    - How admins manage brand, pricing, navigation, FAQs, and legal links.

The docs homepage must be rewritten from a generic “template documentation” entry into a Mkety platform documentation landing page.

---

## 7. Admin Content Management Requirements

The admin must be able to manage public website and docs content without changing code.

Required admin capabilities:

1. **Global Site Settings**
   - Brand name.
   - Logo URL.
   - Favicon URL.
   - Primary, secondary, and accent colors.
   - Default metadata title and description.
   - Social/share image.
   - Public contact links.
   - Legal links.

2. **Navigation Management**
   - Header nav items.
   - Footer nav groups.
   - CTA labels and destinations.
   - Visibility controls.
   - Sort order.

3. **Homepage Sections**
   - Hero content.
   - Badge text.
   - Headline.
   - Subheadline.
   - CTA buttons.
   - Product preview labels.
   - Trust cards.
   - Workspaces tabs.
   - SolutionHub content.
   - Academy section.
   - Enterprise section.
   - Pricing/Plans cards.
   - FAQ.
   - Footer content.

4. **Page Management**
   - Create/edit public pages.
   - Slug control.
   - Draft/published states.
   - SEO metadata.
   - Section ordering.
   - Enable/disable page.

5. **Docs Management**
   - Create/edit docs categories.
   - Create/edit docs articles.
   - Slug control.
   - Markdown or rich text body.
   - Sidebar order.
   - Draft/published states.
   - SEO metadata.

6. **Pricing Management**
   - Plans.
   - Plan descriptions.
   - Feature bullets.
   - Usage/credit limits.
   - CTA labels.
   - Highlighted plan.
   - Custom/Enterprise contact language.
   - Public/private visibility.

7. **Review and Publishing**
   - Draft state.
   - Preview state.
   - Published state.
   - Last published timestamp.
   - Author/editor attribution.
   - Audit events for create, update, publish, unpublish, and delete.

8. **Fallbacks**
   - If no database content exists, public pages must render from seeded Mkety defaults.
   - Defaults must be blueprint-aligned and safe to show publicly.

---

## 8. Content Storage Model

Do not store the full public website inside `tenants.settings`. The public Mkety website is a platform-level/global property, not a normal customer tenant customization.

Create a platform content feature with explicit tables and typed schemas.

Proposed tables:

1. `platform_site_settings`
   - Singleton or environment-scoped settings record.
   - Stores brand, metadata, public contact, social/share, and legal link configuration.

2. `platform_pages`
   - Public pages such as home, platform, pricing, enterprise, about, and docs landing.
   - Fields: id, slug, title, status, seoTitle, seoDescription, publishedAt, createdBy, updatedBy, createdAt, updatedAt.

3. `platform_page_sections`
   - Ordered sections for each page.
   - Fields: pageId, sectionKey, sectionType, sortOrder, enabled, contentJson, createdAt, updatedAt.
   - `contentJson` must be validated by Zod schemas per `sectionType`.

4. `platform_navigation_items`
   - Header and footer navigation.
   - Fields: area, label, href, sortOrder, enabled, external, parentId.

5. `platform_pricing_plans`
   - Plan cards and pricing display.
   - Fields: key, name, priceLabel, billingLabel, description, highlighted, ctaLabel, ctaHref, sortOrder, status.

6. `platform_pricing_features`
   - Ordered feature bullets per plan.

7. `platform_docs_categories`
   - Docs sidebar categories.
   - Fields: key, title, description, sortOrder, status.

8. `platform_docs_articles`
   - Docs articles.
   - Fields: categoryId, slug, title, excerpt, bodyMarkdown, status, seoTitle, seoDescription, sortOrder, publishedAt, createdBy, updatedBy.

9. `platform_content_revisions`
   - Append-oriented revision history for pages, sections, pricing, navigation, docs, and settings.
   - Must store entity type, entity id, before/after JSON snapshots, actor, action, and timestamp.

The model must support global platform content first. Tenant-specific public-site theming or customer-owned microsites can be added later through a separate tenant content model if required.

---

## 9. Rendering Architecture

Public rendering must follow this flow:

```text
Request mkety.com
  ↓
Load published platform site settings
  ↓
Load published page by slug
  ↓
Load enabled published sections in sort order
  ↓
Validate section payloads with Zod
  ↓
Render section components using mksaas design system
  ↓
Fallback to seeded Mkety defaults when content is absent
```

Docs rendering must follow this flow:

```text
Request /docs or /docs/[...slug]
  ↓
Load published docs categories and articles
  ↓
Render docs layout/sidebar/search using mksaas docs template
  ↓
Render selected article body
  ↓
Fallback to blueprint-aligned seeded docs if content is absent
```

Admin editing must follow this flow:

```text
Authorized admin
  ↓
Open Platform Administration → Public Site
  ↓
Edit content form
  ↓
Validate input with Zod
  ↓
Save draft
  ↓
Preview
  ↓
Publish
  ↓
Audit event + revision snapshot
  ↓
Public site revalidates and renders updated content
```

---

## 10. Admin Location and Authorization

Use existing tenant admin structure initially, but conceptually distinguish this from customer tenant administration.

Initial route proposal:

- `/admin` continues redirecting authenticated admins.
- Add public-site management under tenant admin while platform-level administration is still maturing:
  - `/t/[tenant]/admin/public-site`
  - `/t/[tenant]/admin/public-site/pages`
  - `/t/[tenant]/admin/public-site/navigation`
  - `/t/[tenant]/admin/public-site/pricing`
  - `/t/[tenant]/admin/public-site/docs`
  - `/t/[tenant]/admin/public-site/settings`

Authorization requirements:

- Only authenticated users with an admin role in an approved Mkety administrative tenant may manage platform public content.
- Do not allow normal customer tenant admins to edit `mkety.com` public content.
- Server-side authorization is mandatory for every read/write admin endpoint.
- Browser-provided tenant IDs must not be trusted without server-side verification.

Future platform administration can move these routes to a dedicated `/platform-admin` or `/admin/platform-content` structure after the broader administration model is finalized.

---

## 11. Design Requirements

Use the existing mksaas visual DNA:

- Premium SaaS visual language.
- Modern typography.
- Card systems.
- Animations and transitions.
- Hover effects.
- Responsive layouts.
- Strong hierarchy.
- Technical/product aesthetic.

Apply Mkety identity:

- Brand name: Mkety.
- Violet/purple primary direction.
- White and technical dark tones.
- Compact, intelligent, credible, modern look.
- Avoid generic AI startup visuals.

Respect current design rules:

- Theme tokens live in `src/app/globals.css`.
- Avoid unnecessary hardcoded hex values.
- Use semantic tokens and existing components where possible.
- Keep gradient usage intentional.
- Maintain responsive and accessible layouts.

---

## 12. Public Site Content Defaults

Seeded default content must be good enough for production display before admin edits.

Default homepage messaging:

- Headline: “Build, automate, deploy, and operate with Mkety.”
- Subheadline: “Mkety is a technology platform for creating AI agents, workflows, applications, websites, integrations, and business solutions from one unified workspace.”
- Primary CTA: “Get Started.”
- Secondary CTA: “Explore Docs.”

Default workspace summaries:

- **AI Workspace:** Build agents, connect knowledge, choose models, test, version, publish, and monitor AI applications.
- **Automation Workspace:** Create workflows from triggers, actions, conditions, webhooks, transformations, and agent steps.
- **Deploy Workspace:** Publish websites, lightweight applications, APIs, portals, and serverless workloads with domains and deployment history.
- **Trading Workspace:** Specialized Enterprise/Custom solution for trading automation, signal workflows, integrations, execution infrastructure, monitoring, and deployments.

Default SolutionHub summary:

- Discover ready-made solutions, templates, AI assistants, workflows, deployment starters, business automations, industry blueprints, and enterprise packages.

Default Academy summary:

- Learn practical technology, AI, automation, cloud, and business implementation skills through courses, workshops, webinars, certifications, and enterprise training.

Default Enterprise summary:

- Mkety builds custom systems and specialized infrastructure for companies and customer projects, including Trading, mklms-style learning systems, and future enterprise applications.

---

## 13. Docs Default Content

Seeded docs must cover the same categories listed in Section 6. Each article should be concise, accurate, and aligned with `AGENTS.md`.

Initial docs articles:

- Getting Started / What is Mkety?
- Getting Started / Product Map
- Platform / Organizations, Teams, and Projects
- Platform / Workspaces
- Platform / SolutionHub
- AI / Agents and Agent Builder
- AI / Knowledge, Tools, Models, and Runs
- Automation / Workflows and Executions
- Deploy / Applications, Environments, and Domains
- Pricing / Plans, Credits, Usage, and Entitlements
- Academy / Learning and Training
- Enterprise / Customer Solutions
- Security / Tenant Isolation and Authorization
- Operations / Cloudflare, OCI, Workers, R2, Redis, PostgreSQL, and Mkety Worker
- Administration / Managing Public Site Content

Docs must not claim unfinished backend features are production-ready. Use status language consistent with `AGENTS.md`: PLANNED, IN PROGRESS, IMPLEMENTED, VERIFIED, PRODUCTION, BLOCKED, DEFERRED.

---

## 14. API and Server Actions

Create server-side actions or route handlers for admin content management.

Required behavior:

- Authenticate user.
- Authorize platform-content admin access server-side.
- Validate input payloads with Zod.
- Save drafts.
- Publish content.
- Record audit events.
- Record revision snapshots.
- Revalidate public paths after publish.
- Return predictable errors.
- Never leak internal stack traces or secrets.

Suggested module boundaries:

- `src/features/platform-content/schemas/`
- `src/features/platform-content/services/`
- `src/features/platform-content/components/admin/`
- `src/features/platform-content/components/public/`
- `src/features/platform-content/lib/`
- `src/shared/db/schema/platform-content.ts`

---

## 15. Migration and Seeding Requirements

Database changes must be deterministic and tracked through migrations.

Migration must add platform content tables under the existing schema namespace unless an intentional schema migration is separately approved.

Seed script must insert blueprint-aligned default content only when records do not already exist.

Seeded content must be idempotent:

- Re-running seed must not duplicate pages, sections, nav items, plans, docs categories, or articles.
- Existing admin edits must not be overwritten unless an explicit reset command is used.

---

## 16. Public AI Requirement

The public site must include a public Mkety AI assistant section or entry point, but this first public-site batch does not need to implement a full production chat runtime unless the implementation plan explicitly includes it and verification is possible.

Minimum production-safe first version:

- Render a public Mkety AI marketing card or assistant-style interface.
- Explain that it helps visitors understand Mkety, products, plans, solutions, and docs.
- CTA may link to docs, contact, or sign-in.

Future interactive version:

- Dedicated public assistant route/API.
- Strict rate limiting.
- Safe system instructions.
- No tenant-private data access.
- Logs safe and privacy-aware.
- Optional retrieval from published docs and public site content only.

Do not confuse public Mkety AI with the Platform Agent Builder.

---

## 17. Production Readiness Requirements

Before calling this feature production-ready:

- Type-check passes.
- Unit tests pass.
- Relevant admin form tests pass.
- Public rendering tests pass.
- Docs rendering tests pass.
- Build passes.
- Draft/publish flow works.
- Public fallback content works.
- Admin authorization is verified server-side.
- Invalid payloads are rejected.
- Audit/revision records are created.
- Published content revalidates public pages.
- Mobile responsive layout is verified.
- Metadata and SEO basics are set.
- No secrets are exposed.
- No unfinished backend capability is described as production.

Deployment verification requires access to the actual target environment. If Cloudflare/OCI credentials or deployment access are not available in the working session, deployment must be reported as not verified.

---

## 18. Implementation Decomposition

This is too large to implement safely as one giant change. It should be implemented in production-oriented batches that each leave the repo better than before.

Recommended batches:

### Batch 1 — Static Mkety public site conversion

- Convert current hardcoded landing page and landing data to Mkety public positioning.
- Rebrand logo defaults from A8n Hub to Mkety.
- Rework navigation, hero, sections, pricing language, footer, and metadata.
- Keep data hardcoded only as temporary defaults.
- Tests: render homepage and key section content.

### Batch 2 — Global docs conversion

- Rewrite `/docs` homepage, metadata, sidebar, and initial docs articles using the master blueprint.
- Preserve the existing docs template and routing.
- Tests: docs index redirects correctly, docs article renders, Mkety docs categories exist.

### Batch 3 — Platform content schema and seed defaults

- Add database schema for platform content.
- Add migrations.
- Add idempotent seeds for public site, navigation, pricing, and docs content.
- Tests: schema/service tests and seed idempotency tests.

### Batch 4 — Public rendering from content system

- Replace hardcoded page data with published platform content loaded server-side.
- Add safe fallback to seeded defaults.
- Add revalidation after publish.
- Tests: published content renders, fallback renders when DB has no content.

### Batch 5 — Admin content editor

- Add admin UI for pages, sections, navigation, pricing, docs, settings.
- Add draft, preview, publish, unpublish.
- Add server-side authorization and validation.
- Tests: admin permissions, form validation, save/publish flows.

### Batch 6 — Production hardening

- Add audit/revision coverage.
- Add metadata/SEO final pass.
- Add accessibility/responsive verification.
- Add docs explaining admin content management.
- Run type-check, tests, build.
- Record deployment limitations if Cloudflare/OCI cannot be verified.

---

## 19. Non-Negotiable Constraints

- Do not modify the legacy `mkety` main branch.
- Do not reintroduce Vercel as the production target.
- Do not remove Trading from public/frontend presentation.
- Do not position Trading as a normal self-service subscription feature.
- Do not turn mklms into a third core Mkety product.
- Do not present Mkety as AI-only.
- Do not confuse Plans, Pricing, Credits, Usage, Workspaces, and SolutionHub.
- Do not advertise backend entitlements that cannot be enforced.
- Do not store secrets in source code, docs, logs, frontend bundles, or admin-editable content.
- Do not rely on frontend-only permissions.
- Do not claim deployment or production readiness until verified.

---

## 20. Acceptance Criteria

The feature is accepted when:

1. `mkety.com` public homepage no longer reads like the original template and clearly presents Mkety.
2. The public navigation reflects Mkety Platform, Workspaces, SolutionHub, Academy, Pricing, Enterprise, Docs, About, Sign In, and Get Started.
3. Trading remains visible and marked Custom/Enterprise.
4. Pricing uses approved Mkety terminology.
5. `/docs` becomes a Mkety documentation portal based on the master blueprint.
6. Public site and docs have seeded production-safe default content.
7. Admin can edit public site content, docs, navigation, pricing, CTAs, FAQs, metadata, and site settings without code changes.
8. Draft/publish, preview, audit, and revision history are implemented.
9. Server-side authorization protects all admin content writes.
10. Public pages render published content and fall back safely when content is missing.
11. Type-check, tests, and production build pass.
12. Any unverified deployment item is clearly reported as unverified rather than claimed.

---

## 21. Self-Review

- Placeholder scan: no TBD/TODO placeholders remain.
- Scope check: the work is intentionally decomposed into six implementation batches because homepage, docs, CMS schema, admin editor, and production hardening are too large for one safe code batch.
- Consistency check: public site, docs, admin, database, authorization, and production readiness requirements align with the current `AGENTS.md` blueprint.
- Ambiguity check: “admin can edit everything” is interpreted as all public site/docs content, navigation, pricing, FAQs, CTAs, metadata, brand settings, and published docs content; not arbitrary application source code or backend business logic.
