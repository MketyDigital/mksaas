# Mkety Public Site CMS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the production-ready `mkety.com` public customer/marketing/sales/info site and global `/docs` experience, with public content editable by approved Mkety admins without changing application code.

**Architecture:** Add a platform-level content feature backed by Drizzle/PostgreSQL tables for site settings, pages, sections, navigation, pricing, docs, and revisions. Public pages and docs render from published content through typed loaders with seeded Mkety fallbacks; admin routes manage drafts, preview, publishing, and audit-safe revision history. Reuse the existing mksaas landing and docs visual systems instead of replacing the design language.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5.9, Drizzle ORM 0.45, PostgreSQL, Zod, Tailwind 4, existing shadcn/Radix UI components, existing Auth.js/session and tenant admin infrastructure.

**Spec:** `docs/superpowers/specs/2026-09-05-mkety-public-site-cms-design.md`

## Global Constraints

- Mkety is a technology platform, not an AI-only product.
- Public site must present Platform, AI Workspace, Automation Workspace, Deploy Workspace, Trading Workspace, SolutionHub, Academy, Pricing/Plans, Enterprise, Docs, and About.
- Trading must stay visible but must be labeled Custom/Enterprise, not a normal self-service feature.
- Admin can edit public website and documentation content, navigation, pricing display, FAQ, CTAs, metadata, and site settings; admin must not edit source code or backend business logic.
- Global platform public content must not be stored inside `tenants.settings`.
- Public pages must render safe blueprint-aligned fallback content when database content is absent.
- All admin writes must be server-authorized; never trust tenant IDs from the browser.
- Content changes must create revision records and audit-sensitive events.
- Keep Plans, Pricing, Credits, Usage, Workspaces, and SolutionHub semantically distinct.
- Use existing mksaas visual DNA, components, tokens, responsive patterns, and docs template.
- Avoid hardcoding public copy directly into page components except fallback seed data.
- Do not use Vercel-specific production assumptions; Cloudflare + OCI remain the production target.
- Run `pnpm lint`, `pnpm type-check`, `pnpm test`, and `pnpm build` before claiming implementation is verified.

---

## File Structure

Create the new platform content feature under `src/features/platform-content/` so it is not confused with tenant settings or normal customer workspace data.

Planned files:

- `src/shared/db/schema/platform-content.ts` — Drizzle tables/enums for global public content.
- `src/shared/db/schema/index.ts` or current schema barrel — export the new schema file if the repo uses a barrel.
- `src/features/platform-content/types.ts` — shared TypeScript types for pages, sections, docs, navigation, pricing, revisions.
- `src/features/platform-content/schemas.ts` — Zod schemas for section payloads, docs body input, pricing, navigation, and settings.
- `src/features/platform-content/defaults.ts` — production-safe Mkety fallback content from the master blueprint.
- `src/features/platform-content/server/queries.ts` — public read loaders for published content with fallbacks.
- `src/features/platform-content/server/actions.ts` — admin server actions for draft save, publish, unpublish, ordering, and revision creation.
- `src/features/platform-content/server/authorization.ts` — platform-admin authorization guard.
- `src/features/platform-content/components/public/*` — public rendering components for hero, platform, workspaces, SolutionHub, Academy, enterprise, pricing, FAQ, public AI, footer.
- `src/features/platform-content/components/admin/*` — admin forms and editors for pages, sections, nav, pricing, docs, and settings.
- `src/app/page.tsx` — render the Mkety homepage through platform content loaders.
- `src/app/_landing-components/*` — keep or adapt existing visual components where useful.
- `src/app/(docs)/docs/page.tsx` — global docs landing page.
- `src/app/(docs)/docs/[...slug]/page.tsx` — docs article rendering from published platform docs.
- `src/app/(docs)/docs/layout.tsx` — Mkety metadata and docs layout wiring.
- `src/app/(tenant)/t/[tenant]/admin/public-site/page.tsx` — admin public-site dashboard.
- `src/app/(tenant)/t/[tenant]/admin/public-site/pages/page.tsx` — page/section editor entry.
- `src/app/(tenant)/t/[tenant]/admin/public-site/navigation/page.tsx` — navigation editor.
- `src/app/(tenant)/t/[tenant]/admin/public-site/pricing/page.tsx` — pricing editor.
- `src/app/(tenant)/t/[tenant]/admin/public-site/docs/page.tsx` — docs editor.
- `src/app/(tenant)/t/[tenant]/admin/public-site/settings/page.tsx` — site settings editor.
- `src/__tests__/platform-content/*.test.ts` — schema, fallback, loader, authorization, and publish behavior tests.
- `docs/MKETY_PUBLIC_SITE_CMS.md` — operational documentation for maintaining public content.

---

### Task 1: Add Platform Content Schema and Types

**Files:**
- Create: `src/shared/db/schema/platform-content.ts`
- Modify: schema export file if present after inspection
- Create: `src/features/platform-content/types.ts`
- Test: `src/__tests__/platform-content/platform-content-schema.test.ts`

**Interfaces:**
- Produces Drizzle tables: `platformSiteSettings`, `platformPages`, `platformPageSections`, `platformNavigationItems`, `platformPricingPlans`, `platformPricingFeatures`, `platformDocsCategories`, `platformDocsArticles`, `platformContentRevisions`.
- Produces enums/types: `PlatformContentStatus`, `PlatformPageSectionType`, `PlatformNavigationArea`, `PlatformRevisionEntityType`.

- [ ] **Step 1: Inspect existing schema export pattern**

Run:

```bash
ls src/shared/db/schema
sed -n '1,220p' src/shared/db/schema/index.ts 2>/dev/null || true
sed -n '1,80p' src/shared/db/schema/schema.ts
```

Expected: identify where `appSchema` is exported and how schema files are discovered.

- [ ] **Step 2: Write failing schema tests**

Create `src/__tests__/platform-content/platform-content-schema.test.ts`:

```ts
import {
  platformContentStatusEnum,
  platformDocsArticles,
  platformNavigationItems,
  platformPageSections,
  platformPages,
  platformPricingPlans,
  platformSiteSettings,
} from '@/shared/db/schema/platform-content';

describe('platform content schema', () => {
  it('defines platform-level public content tables', () => {
    expect(platformSiteSettings).toBeDefined();
    expect(platformPages).toBeDefined();
    expect(platformPageSections).toBeDefined();
    expect(platformNavigationItems).toBeDefined();
    expect(platformPricingPlans).toBeDefined();
    expect(platformDocsArticles).toBeDefined();
  });

  it('supports draft and published content status values', () => {
    expect(platformContentStatusEnum.enumValues).toEqual(['draft', 'published', 'archived']);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
pnpm test src/__tests__/platform-content/platform-content-schema.test.ts --runInBand
```

Expected: FAIL because `@/shared/db/schema/platform-content` does not exist.

- [ ] **Step 4: Implement schema**

Create `src/shared/db/schema/platform-content.ts` with Drizzle tables using existing `appSchema`. Include timestamps and indexes. Use JSON text columns only where the payload is intentionally section-specific, and validate payloads in the feature layer.

Required shapes:

```ts
import { index, integer, text, timestamp, uniqueIndex, uuid, varchar, boolean } from 'drizzle-orm/pg-core';
import { appSchema } from './schema';
import { users } from './auth';

export const platformContentStatusEnum = appSchema.enum('platform_content_status', ['draft', 'published', 'archived']);
export const platformNavigationAreaEnum = appSchema.enum('platform_navigation_area', ['header', 'footer']);
export const platformSectionTypeEnum = appSchema.enum('platform_section_type', [
  'hero',
  'platform_overview',
  'workspaces',
  'solution_hub',
  'academy',
  'enterprise',
  'public_ai',
  'trust',
  'pricing',
  'faq',
  'footer_cta',
  'custom',
]);
export const platformRevisionEntityTypeEnum = appSchema.enum('platform_revision_entity_type', [
  'site_settings',
  'page',
  'section',
  'navigation_item',
  'pricing_plan',
  'pricing_feature',
  'docs_category',
  'docs_article',
]);

export const platformSiteSettings = appSchema.table('platform_site_settings', {
  id: uuid('id').defaultRandom().primaryKey(),
  environment: varchar('environment', { length: 40 }).notNull().default('production'),
  status: platformContentStatusEnum('status').notNull().default('draft'),
  brandName: varchar('brand_name', { length: 120 }).notNull().default('Mkety'),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: varchar('primary_color', { length: 7 }).notNull().default('#6D28D9'),
  secondaryColor: varchar('secondary_color', { length: 7 }).notNull().default('#8B5CF6'),
  accentColor: varchar('accent_color', { length: 7 }).notNull().default('#22D3EE'),
  defaultSeoTitle: varchar('default_seo_title', { length: 180 }).notNull(),
  defaultSeoDescription: text('default_seo_description').notNull(),
  socialImageUrl: text('social_image_url'),
  contactEmail: varchar('contact_email', { length: 255 }),
  legalLinksJson: text('legal_links_json'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex('platform_site_settings_environment_status_idx').on(table.environment, table.status)]);
```

Create the remaining tables with matching fields from the spec: page slug/status, section key/type/sort/enabled/contentJson, nav area/parent/href/external, pricing plans/features, docs categories/articles, and revisions with before/after JSON snapshots.

- [ ] **Step 5: Export schema if needed**

If the repo uses a schema barrel, add:

```ts
export * from './platform-content';
```

- [ ] **Step 6: Run test and type-check**

Run:

```bash
pnpm test src/__tests__/platform-content/platform-content-schema.test.ts --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/schema src/features/platform-content/types.ts src/__tests__/platform-content/platform-content-schema.test.ts
git commit -m "feat(platform-content): add public content schema"
```

---

### Task 2: Add Zod Schemas and Mkety Default Content

**Files:**
- Create: `src/features/platform-content/schemas.ts`
- Create: `src/features/platform-content/defaults.ts`
- Create: `src/features/platform-content/index.ts`
- Test: `src/__tests__/platform-content/platform-content-defaults.test.ts`

**Interfaces:**
- Produces `platformSiteSettingsSchema`, `navigationItemSchema`, `pricingPlanSchema`, `docsArticleSchema`, and `sectionContentSchemas`.
- Produces `getDefaultPlatformSiteSettings()`, `getDefaultHomepagePage()`, `getDefaultNavigationItems()`, `getDefaultPricingPlans()`, `getDefaultDocsCategories()`, `getDefaultDocsArticles()`.

- [ ] **Step 1: Write failing fallback/default tests**

Create `src/__tests__/platform-content/platform-content-defaults.test.ts`:

```ts
import {
  getDefaultDocsArticles,
  getDefaultHomepagePage,
  getDefaultNavigationItems,
  getDefaultPricingPlans,
} from '@/features/platform-content/defaults';
import { heroSectionSchema, workspaceSectionSchema } from '@/features/platform-content/schemas';

describe('Mkety public content defaults', () => {
  it('ships a blueprint-aligned homepage hero', () => {
    const page = getDefaultHomepagePage();
    const hero = page.sections.find((section) => section.type === 'hero');
    expect(hero).toBeDefined();
    expect(heroSectionSchema.parse(hero?.content).headline).toContain('Build');
    expect(heroSectionSchema.parse(hero?.content).headline).toContain('Mkety');
  });

  it('keeps Trading visible as Custom or Enterprise', () => {
    const page = getDefaultHomepagePage();
    const workspaces = page.sections.find((section) => section.type === 'workspaces');
    const parsed = workspaceSectionSchema.parse(workspaces?.content);
    const trading = parsed.items.find((item) => item.title.includes('Trading'));
    expect(trading?.badge).toMatch(/Custom|Enterprise/);
  });

  it('uses approved navigation language', () => {
    const labels = getDefaultNavigationItems().map((item) => item.label);
    expect(labels).toEqual(expect.arrayContaining(['Platform', 'Workspaces', 'SolutionHub', 'Academy', 'Pricing', 'Enterprise', 'Docs']));
  });

  it('includes docs content for the global Mkety system', () => {
    const docs = getDefaultDocsArticles();
    expect(docs.map((article) => article.slug)).toEqual(expect.arrayContaining(['getting-started/what-is-mkety', 'platform/overview', 'workspaces/ai-workspace']));
  });

  it('does not publicly use African edition language', () => {
    const content = JSON.stringify({ plans: getDefaultPricingPlans(), docs: getDefaultDocsArticles() });
    expect(content).not.toMatch(/African edition/i);
    expect(content).toMatch(/Lite Offer/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/platform-content/platform-content-defaults.test.ts --runInBand
```

Expected: FAIL because schemas/defaults are missing.

- [ ] **Step 3: Implement `schemas.ts`**

Define Zod schemas for each public section. Minimum required schemas:

```ts
import { z } from 'zod';

export const ctaSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'outline']).default('primary'),
});

export const heroSectionSchema = z.object({
  badge: z.string().min(1),
  headline: z.string().min(1),
  subheadline: z.string().min(1),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema,
  previewCards: z.array(z.object({ title: z.string(), description: z.string() })).min(1),
});

export const workspaceSectionSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  items: z.array(z.object({
    title: z.string().min(1),
    description: z.string().min(1),
    badge: z.string().optional(),
    capabilities: z.array(z.string().min(1)).default([]),
  })).min(1),
});
```

Add schemas for platform overview, SolutionHub, Academy, Enterprise, Public AI, Trust, Pricing, FAQ, footer CTA, nav, settings, docs categories, and docs articles.

- [ ] **Step 4: Implement `defaults.ts`**

Seed Mkety defaults from the spec. Required content must include:

```ts
export function getDefaultHomepagePage() {
  return {
    slug: 'home',
    title: 'Mkety',
    seoTitle: 'Mkety | Build, automate, deploy, and operate modern business systems',
    seoDescription: 'Mkety is a technology platform for AI agents, workflows, applications, websites, integrations, deployments, business solutions, and training.',
    sections: [
      {
        key: 'hero',
        type: 'hero',
        sortOrder: 10,
        enabled: true,
        content: {
          badge: 'Mkety Platform',
          headline: 'Build, automate, deploy, and operate with Mkety.',
          subheadline: 'Mkety is a technology platform for creating AI agents, workflows, applications, websites, integrations, and business solutions from one unified workspace.',
          primaryCta: { label: 'Get Started', href: '/login', variant: 'primary' },
          secondaryCta: { label: 'Explore Docs', href: '/docs', variant: 'outline' },
          previewCards: [
            { title: 'AI Workspace', description: 'Agents, knowledge, tools, models, runs, versions, and publishing.' },
            { title: 'Automation Workspace', description: 'Triggers, actions, conditions, webhooks, transformations, and run history.' },
            { title: 'Deploy Workspace', description: 'Apps, websites, APIs, environments, domains, and releases.' },
            { title: 'SolutionHub', description: 'Ready-made solutions, templates, workflows, and enterprise blueprints.' },
          ],
        },
      },
    ],
  };
}
```

Complete every section required by the spec.

- [ ] **Step 5: Export public API**

Create `src/features/platform-content/index.ts`:

```ts
export * from './defaults';
export * from './schemas';
export * from './types';
```

- [ ] **Step 6: Run tests**

```bash
pnpm test src/__tests__/platform-content/platform-content-defaults.test.ts --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/platform-content src/__tests__/platform-content/platform-content-defaults.test.ts
git commit -m "feat(platform-content): add Mkety public defaults"
```

---

### Task 3: Add Public Content Loaders with Safe Fallbacks

**Files:**
- Create: `src/features/platform-content/server/queries.ts`
- Create: `src/features/platform-content/server/normalizers.ts`
- Test: `src/__tests__/platform-content/platform-content-loaders.test.ts`

**Interfaces:**
- Produces `getPublishedPlatformSiteSettings()`, `getPublishedPageBySlug(slug: string)`, `getPublishedNavigation(area?: 'header' | 'footer')`, `getPublishedPricingPlans()`, `getPublishedDocsTree()`, `getPublishedDocsArticle(slug: string)`.
- All loaders return typed fallback content when database content is absent or invalid.

- [ ] **Step 1: Write failing loader tests**

Create tests that mock the database access layer and verify fallback behavior:

```ts
import { getPublishedPageBySlug, getPublishedDocsArticle } from '@/features/platform-content/server/queries';

describe('platform content public loaders', () => {
  it('returns the default homepage when no published page exists', async () => {
    const page = await getPublishedPageBySlug('home');
    expect(page.slug).toBe('home');
    expect(page.sections.some((section) => section.type === 'hero')).toBe(true);
  });

  it('returns a default docs article for getting started', async () => {
    const article = await getPublishedDocsArticle('getting-started/what-is-mkety');
    expect(article?.title).toMatch(/Mkety/i);
    expect(article?.bodyMarkdown).toMatch(/Platform/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/platform-content/platform-content-loaders.test.ts --runInBand
```

Expected: FAIL because server loaders are missing.

- [ ] **Step 3: Implement loaders**

Use existing DB client import pattern from nearby server services. Wrap database reads in safe try/catch and validate content JSON with schemas. Do not swallow errors silently; log server-side with existing logger if available, then return safe fallbacks for public pages.

Example interface:

```ts
export async function getPublishedPageBySlug(slug: string): Promise<PlatformPageView> {
  const fallback = slug === 'home' ? getDefaultHomepagePage() : getDefaultHomepagePage();
  try {
    // Query published page and enabled sections.
    // Validate each section content by section type.
    return normalizedPage;
  } catch (error) {
    logger.warn({ error, slug }, 'Falling back to default platform page content');
    return fallback;
  }
}
```

- [ ] **Step 4: Run tests and type-check**

```bash
pnpm test src/__tests__/platform-content/platform-content-loaders.test.ts --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/platform-content/server src/__tests__/platform-content/platform-content-loaders.test.ts
git commit -m "feat(platform-content): load published public content"
```

---

### Task 4: Convert the Public Homepage to Mkety Content-Driven Rendering

**Files:**
- Modify: `src/app/page.tsx`
- Modify/Create: `src/features/platform-content/components/public/MketyHomePage.tsx`
- Create: `src/features/platform-content/components/public/sections/*.tsx`
- Modify: `src/shared/components/brand/Logo.tsx`
- Test: `src/__tests__/platform-content/mkety-homepage-rendering.test.tsx`

**Interfaces:**
- Consumes `getPublishedPageBySlug('home')`, `getPublishedNavigation('header')`, `getPublishedPricingPlans()`.
- Produces rendered homepage sections from section payloads.

- [ ] **Step 1: Write failing render tests**

Create a component test verifying Mkety content appears and unsafe template wording is gone:

```tsx
import { render, screen } from '@testing-library/react';
import { MketyHomePage } from '@/features/platform-content/components/public/MketyHomePage';
import { getDefaultHomepagePage } from '@/features/platform-content/defaults';

describe('MketyHomePage', () => {
  it('renders Mkety positioning and workspace language', () => {
    render(<MketyHomePage page={getDefaultHomepagePage()} />);
    expect(screen.getByRole('heading', { name: /Build, automate, deploy/i })).toBeInTheDocument();
    expect(screen.getByText(/AI Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Automation Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Deploy Workspace/i)).toBeInTheDocument();
    expect(screen.getByText(/Trading Workspace/i)).toBeInTheDocument();
  });

  it('does not render old A8n template language in the homepage body', () => {
    render(<MketyHomePage page={getDefaultHomepagePage()} />);
    expect(screen.queryByText(/A8n Hub/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Next.js SaaS AI Template/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/platform-content/mkety-homepage-rendering.test.tsx --runInBand
```

Expected: FAIL because `MketyHomePage` does not exist.

- [ ] **Step 3: Build public rendering components**

Create section components:

```text
HeroSection.tsx
PlatformOverviewSection.tsx
WorkspacesSection.tsx
SolutionHubSection.tsx
AcademySection.tsx
EnterpriseSection.tsx
PublicAiSection.tsx
TrustSection.tsx
PricingSection.tsx
FaqSection.tsx
FooterCtaSection.tsx
```

Each component must:
- Accept validated content props.
- Use existing UI components and Tailwind tokens.
- Preserve premium card/tab/animation feel.
- Avoid embedding business copy that belongs in defaults/admin content.

- [ ] **Step 4: Update `src/app/page.tsx`**

Make the root page a thin server component:

```tsx
import { MketyHomePage } from '@/features/platform-content/components/public/MketyHomePage';
import { getPublishedPageBySlug } from '@/features/platform-content/server/queries';

export default async function Home() {
  const page = await getPublishedPageBySlug('home');
  return <MketyHomePage page={page} />;
}
```

Preserve current authenticated user/dashboard behavior only where it still matches the Mkety public site requirements.

- [ ] **Step 5: Update default logo brand**

Change default display name in `src/shared/components/brand/Logo.tsx` from `A8n Hub` to `Mkety`, while preserving tenant custom logo behavior.

- [ ] **Step 6: Run homepage tests**

```bash
pnpm test src/__tests__/platform-content/mkety-homepage-rendering.test.tsx --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx src/features/platform-content/components/public src/shared/components/brand/Logo.tsx src/__tests__/platform-content/mkety-homepage-rendering.test.tsx
git commit -m "feat(public-site): render Mkety homepage from content"
```

---

### Task 5: Convert Global Docs to Mkety Blueprint Docs

**Files:**
- Modify: `src/app/(docs)/docs/page.tsx`
- Modify: `src/app/(docs)/docs/layout.tsx`
- Modify: `src/app/(docs)/docs/[...slug]/page.tsx`
- Modify/Create: `src/features/docs/components/*` only where needed
- Use: `src/features/platform-content/server/queries.ts`
- Test: `src/__tests__/platform-content/mkety-docs-rendering.test.tsx`

**Interfaces:**
- Consumes `getPublishedDocsTree()` and `getPublishedDocsArticle(slug)`.
- Produces `/docs` homepage and `/docs/[...slug]` article pages from global content defaults or database content.

- [ ] **Step 1: Inspect current docs dynamic route and docs lib**

Run:

```bash
sed -n '1,240p' 'src/app/(docs)/docs/[...slug]/page.tsx'
find src/features/docs -maxdepth 3 -type f | sort
```

Expected: understand current markdown/file loader before replacing or adapting.

- [ ] **Step 2: Write failing docs tests**

Create `src/__tests__/platform-content/mkety-docs-rendering.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { DocsArticleView } from '@/features/platform-content/components/public/DocsArticleView';
import { getDefaultDocsArticles } from '@/features/platform-content/defaults';

describe('Mkety docs rendering', () => {
  it('renders global Mkety docs instead of template docs', () => {
    const article = getDefaultDocsArticles().find((item) => item.slug === 'getting-started/what-is-mkety');
    expect(article).toBeDefined();
    render(<DocsArticleView article={article!} />);
    expect(screen.getByRole('heading', { name: /What is Mkety/i })).toBeInTheDocument();
    expect(screen.getByText(/technology platform/i)).toBeInTheDocument();
    expect(screen.queryByText(/Next.js SaaS AI Template/i)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
pnpm test src/__tests__/platform-content/mkety-docs-rendering.test.tsx --runInBand
```

Expected: FAIL because docs view is missing or old docs content is still rendered.

- [ ] **Step 4: Implement docs rendering**

Add public docs components in platform-content or adapt existing docs components:

```text
DocsHomePage.tsx
DocsArticleView.tsx
DocsSidebar.tsx
DocsSearchShell.tsx
```

Docs must include these default categories: Getting Started, Platform, Workspaces, AI, Automation, Deployments, SolutionHub, Plans/Pricing/Billing/Usage, Academy, Enterprise, Security and Operations, Administration.

- [ ] **Step 5: Wire docs routes**

`/docs` should render a real Mkety docs landing page or redirect to `getting-started/what-is-mkety`, not old template docs.

`/docs/[...slug]` should join the slug array and load the corresponding published or default article:

```ts
const articleSlug = params.slug.join('/');
const article = await getPublishedDocsArticle(articleSlug);
if (!article) notFound();
```

- [ ] **Step 6: Update metadata**

Set docs metadata to Mkety language:

```ts
export const metadata = {
  title: 'Docs | Mkety',
  description: 'Documentation for Mkety Platform, Workspaces, SolutionHub, Academy, Enterprise solutions, deployment, billing, usage, and administration.',
};
```

- [ ] **Step 7: Run tests and type-check**

```bash
pnpm test src/__tests__/platform-content/mkety-docs-rendering.test.tsx --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add 'src/app/(docs)/docs' src/features/platform-content src/features/docs src/__tests__/platform-content/mkety-docs-rendering.test.tsx
git commit -m "feat(docs): render global Mkety documentation"
```

---

### Task 6: Add Admin Public Site CMS Screens and Actions

**Files:**
- Create: `src/features/platform-content/server/authorization.ts`
- Create/Modify: `src/features/platform-content/server/actions.ts`
- Create: `src/features/platform-content/components/admin/PublicSiteAdminDashboard.tsx`
- Create: `src/features/platform-content/components/admin/PageSectionEditor.tsx`
- Create: `src/features/platform-content/components/admin/NavigationEditor.tsx`
- Create: `src/features/platform-content/components/admin/PricingEditor.tsx`
- Create: `src/features/platform-content/components/admin/DocsEditor.tsx`
- Create: `src/features/platform-content/components/admin/SiteSettingsEditor.tsx`
- Create: `src/app/(tenant)/t/[tenant]/admin/public-site/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/admin/public-site/pages/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/admin/public-site/navigation/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/admin/public-site/pricing/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/admin/public-site/docs/page.tsx`
- Create: `src/app/(tenant)/t/[tenant]/admin/public-site/settings/page.tsx`
- Test: `src/__tests__/platform-content/platform-content-admin.test.ts`

**Interfaces:**
- Produces `requirePlatformContentAdmin(tenantSlug: string)`.
- Produces server actions: `savePlatformPageDraft`, `publishPlatformPage`, `saveNavigationItem`, `savePricingPlan`, `saveDocsArticleDraft`, `publishDocsArticle`, `savePlatformSiteSettingsDraft`.

- [ ] **Step 1: Write failing authorization/action tests**

Create `src/__tests__/platform-content/platform-content-admin.test.ts`:

```ts
import { requirePlatformContentAdmin } from '@/features/platform-content/server/authorization';

describe('platform content admin authorization', () => {
  it('rejects unauthenticated content edits', async () => {
    await expect(requirePlatformContentAdmin('customer-tenant')).rejects.toThrow(/Unauthorized|Forbidden/);
  });
});
```

Extend after inspecting current auth test utilities.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test src/__tests__/platform-content/platform-content-admin.test.ts --runInBand
```

Expected: FAIL because authorization module is missing.

- [ ] **Step 3: Implement authorization guard**

The guard must:
- Read the current session server-side.
- Verify the user has an admin role.
- Verify the tenant is an approved Mkety administrative tenant, not just any customer tenant.
- Throw a server-side error before any write when unauthorized.

Initial implementation may use an environment variable such as `MKETY_PLATFORM_ADMIN_TENANT_SLUGS` parsed through existing env validation, or a dedicated DB flag if already available. Do not grant all tenant admins access by default.

- [ ] **Step 4: Implement server actions**

Each server action must:
- Call `requirePlatformContentAdmin` first.
- Validate input with Zod.
- Write draft/published content.
- Insert a `platformContentRevisions` row with actor, entity type, entity id, action, before JSON, after JSON.
- Revalidate affected public paths such as `/`, `/docs`, `/docs/[slug]`, and pricing anchors.

- [ ] **Step 5: Build admin UI routes**

Create route pages as thin server components that call the guard and render admin components. Admin components can start as structured forms using existing inputs/cards/buttons, not a full visual page builder.

Minimum production-acceptable controls:
- Page list and status.
- Section editor with section type, sort order, enabled toggle, JSON/rich structured fields based on schema.
- Navigation editor.
- Pricing editor.
- Docs category/article editor.
- Settings editor.
- Save Draft and Publish actions.

- [ ] **Step 6: Run tests and type-check**

```bash
pnpm test src/__tests__/platform-content/platform-content-admin.test.ts --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/platform-content src/app/(tenant)/t/[tenant]/admin/public-site src/__tests__/platform-content/platform-content-admin.test.ts
git commit -m "feat(admin): manage public site content"
```

---

### Task 7: Seed, Migrate, and Document Operations

**Files:**
- Create/Modify: Drizzle migration generated for platform content tables
- Create: `src/features/platform-content/server/seed.ts`
- Modify: seed script entry if the repo has one
- Create: `docs/MKETY_PUBLIC_SITE_CMS.md`
- Test: `src/__tests__/platform-content/platform-content-seed.test.ts`

**Interfaces:**
- Produces idempotent seed logic that creates Mkety defaults only when content does not already exist.

- [ ] **Step 1: Inspect migration and seed conventions**

Run:

```bash
find . -maxdepth 3 -type d -name migrations -o -name drizzle
find . -maxdepth 3 -type f | grep -E 'seed|drizzle.config|migrate'
```

Expected: know the correct migration output path and seed entry point.

- [ ] **Step 2: Write failing seed test**

Create `src/__tests__/platform-content/platform-content-seed.test.ts`:

```ts
import { getDefaultHomepagePage, getDefaultDocsArticles } from '@/features/platform-content/defaults';

describe('platform content seed data', () => {
  it('contains enough content to render production homepage and docs before admin edits', () => {
    expect(getDefaultHomepagePage().sections.length).toBeGreaterThanOrEqual(8);
    expect(getDefaultDocsArticles().length).toBeGreaterThanOrEqual(12);
  });
});
```

- [ ] **Step 3: Generate migration**

Run:

```bash
pnpm db:generate
```

Expected: a deterministic migration adds platform content enums and tables.

- [ ] **Step 4: Implement idempotent seed**

`seed.ts` should insert platform defaults only if there is no published/default row for that entity. It must not overwrite admin-edited published content.

- [ ] **Step 5: Add operational docs**

Create `docs/MKETY_PUBLIC_SITE_CMS.md` explaining:
- What admins can edit.
- What admins cannot edit.
- Draft/preview/publish flow.
- How fallback content works.
- How docs content is structured.
- How pricing display differs from entitlements/billing logic.
- Required checks before production deployment.

- [ ] **Step 6: Run tests and migration check**

```bash
pnpm test src/__tests__/platform-content/platform-content-seed.test.ts --runInBand
pnpm type-check
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/platform-content docs/MKETY_PUBLIC_SITE_CMS.md drizzle src/__tests__/platform-content/platform-content-seed.test.ts
git commit -m "feat(platform-content): seed Mkety public content"
```

---

### Task 8: Final Verification and Production Readiness Gate

**Files:**
- Modify only files required to fix verification failures.
- Update: `docs/MKETY_PUBLIC_SITE_CMS.md` with verified status and known limitations.

**Interfaces:**
- Produces verified implementation evidence.

- [ ] **Step 1: Run focused tests**

```bash
pnpm test src/__tests__/platform-content --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: PASS or documented pre-existing failures not caused by this work.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 4: Run type-check**

```bash
pnpm type-check
```

Expected: PASS.

- [ ] **Step 5: Run production build**

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 6: Verify required public routes locally**

Run:

```bash
pnpm dev
```

Open and verify:
- `/`
- `/docs`
- `/docs/getting-started/what-is-mkety`
- `/t/<admin-tenant>/admin/public-site`
- `/t/<admin-tenant>/admin/public-site/docs`
- `/t/<admin-tenant>/admin/public-site/pricing`

Expected: public routes render without old template positioning; admin routes require admin access.

- [ ] **Step 7: Final production-readiness notes**

Update `docs/MKETY_PUBLIC_SITE_CMS.md` with:
- Tests run.
- Build result.
- Admin authorization mechanism used.
- Migration name.
- Any production environment variables required.
- Any deployment verification still required on Cloudflare/OCI.

- [ ] **Step 8: Commit verification fixes/docs**

```bash
git add docs/MKETY_PUBLIC_SITE_CMS.md
git commit -m "docs(public-site): record CMS verification requirements"
```

---

## Self-Review

- Spec coverage: Covered public homepage, global docs, admin-editable public content, database schema, rendering, docs rendering, admin UI/actions, seeding, revisions, and production verification.
- Placeholder scan: No task depends on unspecified implementation-only placeholders; every task defines files, interfaces, test command, implementation target, and commit command.
- Type consistency: Shared names are consistent across tasks: `platform-content`, `getDefaultHomepagePage`, `getPublishedPageBySlug`, `getPublishedDocsArticle`, `requirePlatformContentAdmin`, `MketyHomePage`.
- Scope control: The plan intentionally excludes admin editing of source code or backend business logic and keeps billing/entitlements logic separate from public pricing display.
