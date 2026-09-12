# Mkety Public Site Production Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the `mkety.com` public website, docs, public assistant boundary, CMS content, SEO/legal/trust surfaces and Cloudflare deployment path so Mkety can expose the replacement public site for real production-domain testing independently of unfinished `app.mkety.com` Platform branches.

**Architecture:** Work from `main` through `feat/mkety-public-site-production`. Reuse the existing platform-content CMS, mksaas visual system, vinext Cloudflare runtime and the connected Supabase PostgreSQL development database. Keep public-site release independent from draft Auth/Webhooks/Billing/Entitlements/Usage/Wallet branches; never introduce Vercel, Supabase Auth, or unrelated database changes.

**Tech Stack:** Next.js 16.2.4, React 19.2, TypeScript 5.9, Tailwind CSS 4, vinext, Cloudflare Workers, Drizzle ORM, PostgreSQL/Supabase development DB, Jest, Zod.

**Governing references:** `AGENTS.md`, `docs/MKETY_DEVELOPMENT_CONTINUATION.md`, `docs/superpowers/specs/2026-09-05-mkety-public-site-cms-design.md`, `docs/MKETY_PUBLIC_CMS_ROLLOUT_CHECKLIST.md`.

## Global Constraints

- Do not modify `AGENTS.md` for routine progress tracking.
- `AGENTS.md` remains authoritative and this plan must conform to it.
- Public branch is `feat/mkety-public-site-production`, based on `main`.
- Public site must remain independently deployable from draft `app.mkety.com` feature branches.
- Use the connected Supabase project only as Mkety development PostgreSQL; do not replace Mkety/ZITADEL identity with Supabase Auth.
- Database work must be scoped to the `saas_template` Mkety schema and only tables required by this milestone.
- Never run destructive reset/fresh/unsafe push operations on the shared Supabase development project.
- Never commit or print Cloudflare, ZITADEL, database or AI-provider secret values.
- Cloudflare + vinext is the public production runtime. Do not add Vercel.
- Preserve legacy public site availability until the new candidate is externally verified.
- Trading remains visible only as Custom/Enterprise.
- `mklms` remains an enterprise/customer-project example, not a core product.
- Public content must distinguish currently available functionality from planned/future capabilities.
- Public Mkety AI must never have tenant-private access or unrestricted tool execution.

---

### Task 1: Lock the public route and content contract

**Files:**

- Create: `src/features/platform-content/public-routes.ts`
- Create: `src/features/platform-content/public-routes.test.ts`
- Modify: `src/features/platform-content/defaults.ts`
- Modify as needed: `src/features/platform-content/schemas.ts`
- Reference: `src/features/platform-content/server/queries.ts`

**Interfaces:**

- Produces `MKETY_PUBLIC_ROUTES` as the code-owned canonical list of routes that belong to the `mkety.com` public surface.
- Produces helpers that distinguish public sitemap routes from authenticated/admin routes.

- [ ] **Step 1: Write failing route-contract tests**

Tests must require at least:

```ts
[
  '/',
  '/platform',
  '/workspaces',
  '/solutions',
  '/academy',
  '/pricing',
  '/enterprise',
  '/about',
  '/docs',
  '/privacy',
  '/terms',
  '/contact',
];
```

Tests must also prove routes beginning with `/t/`, `/admin`, `/api`, `/app`, `/create-workspace` and authenticated tenant paths are not public sitemap pages.

- [ ] **Step 2: Run targeted tests and confirm RED**

```bash
pnpm test -- --runTestsByPath src/features/platform-content/public-routes.test.ts
```

- [ ] **Step 3: Implement the route registry**

Use a typed immutable registry with fields such as:

```ts
export interface MketyPublicRoute {
  path: string;
  key: string;
  label: string;
  sitemap: boolean;
  priority?: number;
}
```

Do not store secrets, auth assumptions or deployment behavior here.

- [ ] **Step 4: Align default navigation/footer destinations**

Ensure defaults use route paths where dedicated pages now exist while homepage anchors may remain as progressive-enhancement links if useful.

- [ ] **Step 5: Run targeted tests GREEN**

- [ ] **Step 6: Commit**

```bash
git add src/features/platform-content/public-routes.ts src/features/platform-content/public-routes.test.ts src/features/platform-content/defaults.ts src/features/platform-content/schemas.ts
git commit -m "feat: define Mkety public route contract"
```

---

### Task 2: Remove public legacy-template metadata and establish Mkety metadata utilities

**Files:**

- Modify: `src/app/layout.tsx`
- Create: `src/features/platform-content/metadata.ts`
- Create: `src/features/platform-content/metadata.test.ts`
- Modify: `src/features/platform-content/server/queries.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**

- Produces `buildMketyMetadata(...)` and canonical base `https://mkety.com`.
- Consumes `PlatformSiteSettingsInput` and page SEO records.

- [ ] **Step 1: Write failing metadata tests**

Require:

- no `Next.js SaaS AI Template` text;
- default title starts with or identifies Mkety;
- canonical URLs use `https://mkety.com`;
- Open Graph site name is Mkety;
- description comes from CMS/default Mkety settings;
- optional social image is included only when valid.

- [ ] **Step 2: Run tests RED**

- [ ] **Step 3: Replace root template metadata**

Remove old root metadata:

```text
Next.js SaaS AI Template | AI-Native Skills Management
```

and use Mkety metadata.

Prefer `generateMetadata` where CMS values are required; do not make every internal authenticated route depend on a failing public CMS lookup.

- [ ] **Step 4: Add safe page metadata helper**

The helper must normalize canonical paths and avoid allowing arbitrary absolute CMS canonical URLs to become the authoritative Mkety canonical domain.

- [ ] **Step 5: Verify homepage metadata uses CMS/page fallback safely**

- [ ] **Step 6: Run targeted tests + typecheck**

```bash
pnpm test -- --runTestsByPath src/features/platform-content/metadata.test.ts
pnpm type-check
```

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/page.tsx src/features/platform-content/metadata.ts src/features/platform-content/metadata.test.ts src/features/platform-content/server/queries.ts
git commit -m "fix: replace template metadata with Mkety public metadata"
```

---

### Task 3: Complete the reusable public-site shell

**Files:**

- Create: `src/features/platform-content/components/public/MketyPublicShell.tsx`
- Create: `src/features/platform-content/components/public/MketyPublicHeader.tsx`
- Create: `src/features/platform-content/components/public/MketyPublicFooter.tsx`
- Create tests for each component
- Modify: `src/features/platform-content/components/public/MketyHomePage.tsx`

**Interfaces:**

- Consumes published header navigation, site settings and footer groups.
- Produces one consistent responsive public shell for homepage and dedicated public pages.

- [ ] **Step 1: Write failing shell/header/footer tests**

Require:

- Mkety brand link to `/`;
- desktop navigation;
- accessible mobile navigation trigger/menu;
- Sign In destination;
- Get Started destination;
- legal/footer links;
- keyboard-reachable navigation;
- external-link treatment where configured.

- [ ] **Step 2: Run tests RED**

- [ ] **Step 3: Extract current homepage header/footer into reusable shell**

Keep mksaas visual language. Do not perform an unrelated full design-system rewrite.

- [ ] **Step 4: Add responsive mobile navigation**

Use existing Radix/UI primitives where practical.

- [ ] **Step 5: Refactor homepage to consume shell**

- [ ] **Step 6: Run targeted tests + existing public component tests**

- [ ] **Step 7: Commit**

---

### Task 4: Move homepage hard-coded product content into validated CMS section payloads

**Files:**

- Modify: `src/features/platform-content/schemas.ts`
- Modify: `src/features/platform-content/defaults.ts`
- Modify: `src/features/platform-content/server/queries.ts`
- Modify: `src/features/platform-content/components/public/MketyHomePage.tsx`
- Modify: `scripts/seed-mkety-platform-content.ts`
- Modify: `scripts/smoke-mkety-platform-content.ts`
- Tests: platform-content schema/query/homepage tests

**Interfaces:**

- Add validated sections for Platform overview, SolutionHub, Academy, Enterprise and Trust/Public AI presentation as appropriate.

- [ ] **Step 1: Write schema/query tests for the missing homepage section types**

The current DB has only `hero`, `workspaces`, `faq`, `footer`; tests must prove the new content types are individually validated and have safe defaults.

- [ ] **Step 2: Run tests RED**

- [ ] **Step 3: Add Zod section schemas and typed inputs**

Do not introduce unvalidated arbitrary React/HTML payload execution.

- [ ] **Step 4: Extend `getPublishedHomepageContent()`**

Read these sections from published CMS records; preserve fallback defaults.

- [ ] **Step 5: Refactor `MketyHomePage.tsx` to render passed content instead of embedded business copy**

Keep component-only layout/icon logic in code.

- [ ] **Step 6: Extend seed script idempotently**

Create only missing section records; do not overwrite deliberate current published values.

- [ ] **Step 7: Extend DB smoke script**

Require every launch-critical homepage section to load successfully.

- [ ] **Step 8: Run tests/typecheck/content smoke against configured dev DB**

```bash
pnpm test
pnpm type-check
pnpm db:smoke:mkety-content
```

- [ ] **Step 9: Commit**

---

### Task 5: Implement CMS-backed dedicated public pages

**Files:**

- Create public page components under `src/features/platform-content/components/public/pages/`
- Create routes:
  - `src/app/platform/page.tsx`
  - `src/app/workspaces/page.tsx`
  - `src/app/solutions/page.tsx`
  - `src/app/academy/page.tsx`
  - `src/app/pricing/page.tsx`
  - `src/app/enterprise/page.tsx`
  - `src/app/about/page.tsx`
  - `src/app/contact/page.tsx`
- Extend: `src/features/platform-content/server/queries.ts`
- Extend: `scripts/seed-mkety-platform-content.ts`
- Extend tests/smoke coverage

**Interfaces:**

- Produce `getPublishedPageContent(slug)` or equivalent typed server boundary.
- Dedicated pages use `MketyPublicShell` and CMS content/defaults.

- [ ] **Step 1: Write query/route tests for page lookup and missing-page behavior**

- [ ] **Step 2: Run RED**

- [ ] **Step 3: Implement reusable published-page loader**

Require page status `published` and `enabled=true`; validate section payloads by section type.

- [ ] **Step 4: Implement routes one product family at a time**

Recommended grouping:

1. Platform + Workspaces
2. Solutions + Enterprise
3. Academy
4. Pricing
5. About + Contact

Each route must have meaningful content, metadata and CTA behavior.

- [ ] **Step 5: Seed missing page records idempotently**

- [ ] **Step 6: Add route smoke tests**

- [ ] **Step 7: Run tests/build**

- [ ] **Step 8: Commit**

---

### Task 6: Complete Pricing/Plans public presentation without inventing backend entitlements

**Files:**

- Modify: pricing public components/routes
- Modify: `src/features/platform-content/defaults.ts`
- Modify: `scripts/seed-mkety-platform-content.ts`
- Modify tests
- Development DB data: only `saas_template.platform_pricing_plans` and `platform_pricing_features` as required

**Interfaces:**

- Public pricing content remains display data; it does not become the authoritative Billing/Entitlements implementation.

- [ ] **Step 1: Write content tests enforcing approved commercial language**

Require:

- no public CPU/RAM/VPS-slice promises for ordinary plans;
- no `African edition` wording;
- Trading is Custom/Enterprise;
- Plans/Pricing/Credits/Usage are not used interchangeably;
- no entitlement claim unsupported by current Platform state.

- [ ] **Step 2: Correct deterministic plan ordering**

Current development DB records all have `sort_order=0`; seed/update only the known Mkety pricing rows to deterministic values while preserving plan identity and unrelated data.

- [ ] **Step 3: Polish pricing route and homepage summary**

- [ ] **Step 4: Run pricing tests/content smoke**

- [ ] **Step 5: Commit**

---

### Task 7: Finish Mkety public docs launch set and quarantine public legacy-template docs

**Files:**

- Modify: `src/app/(docs)/docs/page.tsx`
- Modify: `src/app/(docs)/docs/[...slug]/page.tsx`
- Modify docs public components as needed
- Modify: `src/features/platform-content/defaults.ts`
- Modify: `scripts/seed-mkety-platform-content.ts`
- Modify public docs tests
- Do not blindly rewrite every internal engineering file in `docs/`

**Interfaces:**

- `/docs` and public article routes must read Mkety CMS/default content.

- [ ] **Step 1: Inventory what is actually reachable from `/docs`**

Do not treat internal repository Markdown as public merely because it exists.

- [ ] **Step 2: Add regression tests that public docs do not render template/Auth.js/OpenNext/Vercel claims**

Forbidden public-launch phrases include contextually invalid claims such as:

```text
Next.js SaaS AI Template
Auth.js v5 as Mkety current auth
Auth0 as Mkety current provider
Vercel as Mkety production target
OpenNext as current runtime
```

- [ ] **Step 3: Expand CMS launch docs**

Minimum useful categories/articles should cover:

- Getting Started / What is Mkety
- Platform / Projects & Workspaces
- AI Workspace
- Automation Workspace
- Deploy Workspace direction
- SolutionHub
- Plans/Pricing/Usage/Credits terminology
- Academy
- Enterprise/Trading boundary
- Security/tenant isolation high-level overview

Do not claim unfinished implementation is available today.

- [ ] **Step 4: Verify docs navigation/mobile/article rendering**

- [ ] **Step 5: Run docs tests and DB smoke**

- [ ] **Step 6: Commit**

---

### Task 8: Implement legal/contact/trust pages

**Files:**

- Create: `src/app/privacy/page.tsx`
- Create: `src/app/terms/page.tsx`
- Modify/create CMS page content/defaults
- Modify: site settings/legal links defaults and seed
- Add route/component tests

**Interfaces:**

- Legal copy should be CMS/page-backed where normal content editing is expected.

- [ ] **Step 1: Add privacy/terms route tests and metadata tests**

- [ ] **Step 2: Implement pages with production-safe draft copy**

The legal text must describe actual practices. Do not assert certifications, retention periods, data-sharing rules or service commitments that are not approved facts.

- [ ] **Step 3: Connect footer legal links**

- [ ] **Step 4: Configure public contact destination**

Current CMS `contact_email` is null; set only an approved Mkety contact value supplied/confirmed by the project owner, or retain a safe contact page that does not invent an address.

- [ ] **Step 5: Run tests**

- [ ] **Step 6: Commit**

---

### Task 9: Add sitemap, robots and canonical indexing controls

**Files:**

- Create: `src/app/sitemap.ts`
- Create: `src/app/robots.ts`
- Tests: sitemap/robots route helpers
- Modify metadata utilities if required

**Interfaces:**

- Consumes `MKETY_PUBLIC_ROUTES`.

- [ ] **Step 1: Write failing sitemap/robots tests**

Require sitemap includes public marketing/legal/docs entry routes and excludes:

```text
/api
/t/*
/admin
/create-workspace
authenticated app routes
```

- [ ] **Step 2: Implement sitemap with `https://mkety.com` canonical origin**

- [ ] **Step 3: Implement robots policy**

Do not accidentally block the entire production public site. Disallow private/admin/application paths as appropriate.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

---

### Task 10: Decide and implement the Public Mkety AI launch boundary

**Files:**

- Add under `src/features/public-assistant/` if implementation proceeds
- Add API route under a clearly public path, e.g. `src/app/api/public/assistant/route.ts`
- Add homepage/public component
- Add security/rate-limit tests
- Update privacy page if storage/processing requires disclosure

**Interfaces:**

- Public AI is separate from authenticated Agent Builder and tenant assistant data.

- [ ] **Step 1: Verify an approved provider/runtime is configured for public use**

Secret names only; never print values.

- [ ] **Step 2: Write security tests before route implementation**

Require:

- bounded body/message length;
- no tenant ID accepted as authorization/context;
- no tenant-private retrieval;
- no arbitrary tools;
- bounded model execution;
- safe error responses;
- rate-limit contract;
- no raw provider error/secret leakage.

- [ ] **Step 3: Implement minimal public Mkety knowledge assistant**

Prefer a small curated/public product context boundary first. Do not connect the public endpoint to general tenant knowledge tables.

- [ ] **Step 4: Add UI and safe fallback state**

- [ ] **Step 5: If requirements cannot be met safely, feature-flag/hide the interactive assistant**

The site must not simulate a working assistant.

- [ ] **Step 6: Run targeted/full tests**

- [ ] **Step 7: Commit**

---

### Task 11: Add public error/fallback observability without breaking CMS fallback resilience

**Files:**

- Modify: `src/features/platform-content/server/queries.ts`
- Add tests around fallback behavior
- Modify logging utility usage as appropriate
- Review: `src/app/global-error.tsx`, `src/app/not-found.tsx`

**Interfaces:**

- Keep user-facing fallback content available when appropriate.
- Make server logs/observability distinguish missing content from database/runtime failure.

- [ ] **Step 1: Write tests proving fallback still works**

- [ ] **Step 2: Add safe structured logging for caught CMS read failures**

Never log `DATABASE_URL`, credentials, tokens or sensitive query payloads.

- [ ] **Step 3: Ensure 404/global error screens use Mkety branding**

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

---

### Task 12: Verify the Supabase Mkety content database safely

**Database:** connected project `Mkety Digital` (`vdblajgxrfndjesoyayy`)  
**Allowed scope:** Mkety `saas_template` tables required by this milestone.

- [ ] **Step 1: Record pre-change counts for public-content tables**

- [ ] **Step 2: Inspect migration status before any schema action**

Do not assume migrations are absent merely because repository files exist.

- [ ] **Step 3: Apply only required repository-controlled changes**

Never run `db:reset`, `db:fresh` or `db:push:unsafe` against this shared project.

- [ ] **Step 4: Seed/update only known Mkety public CMS records**

Idempotent operations only; do not overwrite unrelated tables.

- [ ] **Step 5: Run repository content smoke**

```bash
pnpm db:smoke:mkety-content
```

with `STAGING_DATABASE_URL` configured securely.

- [ ] **Step 6: Run Supabase security/performance advisors if DDL was changed**

Review findings relevant to changed objects; do not “fix” unrelated schemas/tables as collateral work.

- [ ] **Step 7: Record exact Mkety tables modified in handoff**

---

### Task 13: Add a durable public-site Cloudflare candidate deployment workflow

**Files:**

- Create/modify durable workflow under `.github/workflows/`
- Modify: `wrangler.jsonc` only as required for an isolated candidate/production routing contract
- Modify package scripts only if required
- Add deployment documentation/handoff

**Interfaces:**

- Consumes GitHub secret `CLOUDFLARE_API_TOKEN` and account identifier variable/secret.
- Uses `STAGING_DATABASE_URL` or deployment-specific database secret without exposing it.

- [ ] **Step 1: Define deployment gate**

The deploy job must depend on successful:

```text
install
unit/integration tests
type-check
lint
vinext check
production build
Cloudflare dry-run/package validation
```

- [ ] **Step 2: Ensure candidate deployment is non-destructive**

Do not route `mkety.com` during first candidate deployment.

- [ ] **Step 3: Deploy candidate Worker/environment**

- [ ] **Step 4: Record exact URL + SHA**

- [ ] **Step 5: Smoke all public routes on candidate**

- [ ] **Step 6: Commit durable workflow/config**

---

### Task 14: Run complete public quality gate on the actual Cloudflare candidate

**No new feature work unless a defect is found.**

- [ ] **Step 1: Desktop/mobile/tablet visual smoke**

- [ ] **Step 2: Keyboard/accessibility smoke**

- [ ] **Step 3: Broken-link crawl of public routes**

- [ ] **Step 4: Verify every CTA destination**

- [ ] **Step 5: Verify metadata/canonical/OG/sitemap/robots**

- [ ] **Step 6: Verify docs**

- [ ] **Step 7: Verify Public AI security/fallback if enabled**

- [ ] **Step 8: Verify DB failure/fallback behavior in controlled test where possible**

- [ ] **Step 9: Verify no template branding appears on public responses**

- [ ] **Step 10: Run full repository gates on immutable candidate SHA**

```bash
pnpm test
pnpm type-check
pnpm lint
pnpx vinext check
pnpm build
pnpm db:smoke:mkety-content
```

- [ ] **Step 11: Record evidence in handoff**

---

### Task 15: Cut over `mkety.com` safely

**Cloudflare/domain change only after Task 14 passes.**

- [ ] **Step 1: Inspect current DNS/origin configuration**

Do not alter unrelated zones/domains.

- [ ] **Step 2: Confirm rollback target for legacy live site**

- [ ] **Step 3: Bind the verified Worker/site to `mkety.com`**

- [ ] **Step 4: Configure/verify `www.mkety.com` canonical redirect behavior if used**

- [ ] **Step 5: Verify SSL/certificate**

- [ ] **Step 6: External production smoke**

Verify:

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
404
sitemap.xml
robots.txt
```

and Public AI if enabled.

- [ ] **Step 7: Mark status PRODUCTION / PUBLIC TESTING only after success**

- [ ] **Step 8: Preserve rollback instructions**

---

### Task 16: Public-site final handoff and resume app.mkety.com

**Files:**

- Update: `docs/MKETY_DEVELOPMENT_CONTINUATION.md`
- Create/update: `docs/HANDOFF_MKETY_PUBLIC_SITE_2026-09-08.md` (use actual completion date if later)

- [ ] **Step 1: Record final public-site SHA and production route evidence**

- [ ] **Step 2: Record exact Supabase tables touched**

- [ ] **Step 3: Record Cloudflare configuration names, never secret values**

- [ ] **Step 4: Record any non-blocking public backlog**

- [ ] **Step 5: Change public milestone status to `PRODUCTION` only if actual `mkety.com` verification passed**

- [ ] **Step 6: Declare next active Platform action**

Resume:

```text
Auth #16 external preview/promotion
→ Webhooks #15
→ Billing #21
→ Entitlements #22
→ Usage/Credits #23
→ Wallet implementation
```

Do not skip prerequisite promotion order.

- [ ] **Step 7: Commit handoff**

```bash
git add docs/MKETY_DEVELOPMENT_CONTINUATION.md docs/HANDOFF_MKETY_PUBLIC_SITE_*.md
git commit -m "docs: hand off production Mkety public site"
```

---

## Current Execution Marker

```text
Branch: feat/mkety-public-site-production
Status: PLANNED
Completed planning:
  - September 8 repository/public-site audit
  - connected Supabase inventory
  - durable continuation roadmap
  - this implementation plan
Next task:
  Task 1 — lock public route/content contract
Then:
  Task 2 — remove legacy template metadata and establish Mkety metadata utilities
```
