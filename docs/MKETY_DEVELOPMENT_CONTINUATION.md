# Mkety Development Continuation Roadmap

**Status:** ACTIVE OPERATIONAL HANDOFF  
**Updated:** 2026-09-08  
**Repository:** `MketyDigital/mksaas`  
**Current public-site branch:** `feat/mkety-public-site-production`  
**Base:** `main` at `95b6759dc45120f2276ad2129b1bc3918bed99ab`

## 1. Purpose

This is the operational continuation document for Mkety development.

Future agents should use this file to understand **what is done, what is in progress, what comes next, what may be deployed, and how to hand work off** without reconstructing project history from old conversations or every historical implementation document.

`AGENTS.md` remains the architectural rule/source of truth. **Do not remove from or edit `AGENTS.md` as part of this roadmap.** Use it as reference and obey its rules. This document does not replace or override it.

### Source-of-truth order

1. `AGENTS.md` — architecture, product boundaries, naming, security and infrastructure rules.
2. `docs/MKETY_DEVELOPMENT_CONTINUATION.md` — active operational order, progress and handoff.
3. Current approved feature spec/plan for the active batch.
4. Current branch/code/database state.
5. Historical handoffs/specs/PRs only when specifically referenced.

If this roadmap ever conflicts with `AGENTS.md`, `AGENTS.md` wins and this roadmap must be corrected.

---

## 2. Current top-level strategy

Finish and publish the entire **`mkety.com` public experience first** so Mkety has a production-grade public website available for real-world testing while development of **`app.mkety.com`** continues separately.

```text
MILESTONE A
mkety.com public site
    ↓
production-ready
    ↓
public testing/live domain
    ↓
MILESTONE B
app.mkety.com Platform
    ↓
Auth promotion + active Platform stack
    ↓
continued product development
```

### Important branch boundary

Public-site production work starts from `main`, not from the Billing/Entitlements/Usage/Wallet stack.

Reason:

- public site foundation is already on `main`;
- `mkety.com` must be independently releasable;
- downstream `app.mkety.com` branches currently contain draft Platform work that must not become an accidental prerequisite for the public website;
- the public site can use existing Supabase Mkety CMS content without merging unfinished Platform feature branches.

Active public branch:

```text
feat/mkety-public-site-production
```

---

## 3. Environment and database rules

### 3.1 Development database

For current development/testing, use the connected Supabase project:

```text
Project: Mkety Digital
Project ref: vdblajgxrfndjesoyayy
Region: eu-west-1
PostgreSQL: 17
```

The repository currently uses the Mkety schema:

```text
saas_template
```

### 3.2 Strict Supabase isolation rule

Only touch schema/tables that belong to this `mksaas` repository and are required by the active Mkety batch.

For the public-site milestone, the primary allowed content tables are:

```text
saas_template.platform_site_settings
saas_template.platform_pages
saas_template.platform_page_sections
saas_template.platform_navigation_items
saas_template.platform_pricing_plans
saas_template.platform_pricing_features
saas_template.platform_docs_categories
saas_template.platform_docs_articles
saas_template.platform_content_revisions
saas_template.platform_workspace_cards
```

Other existing Mkety tables may be read only when a concrete public-site feature requires them and the repository code already owns that boundary.

Never:

- modify another Supabase project;
- modify unrelated schemas;
- drop or rename unrelated tables;
- run broad reset scripts against the shared Supabase project;
- use `db:reset`, `db:fresh`, destructive schema resets or `db:push:unsafe` on the shared development database;
- copy another project's data into this schema;
- introduce Supabase Auth as a replacement for Mkety/ZITADEL Auth merely because Supabase hosts the development PostgreSQL database.

Supabase is being used here primarily as managed PostgreSQL development infrastructure. Mkety application architecture remains governed by `AGENTS.md`.

### 3.3 Database connection secret

GitHub workflows should continue to consume the database through:

```text
STAGING_DATABASE_URL
```

Do not print the value in logs or documentation.

---

## 4. Cloudflare / production-secret contract

User-provided credentials should be stored only as GitHub Environment/Repository secrets or variables. Never commit values.

Expected Cloudflare values:

```text
CLOUDFLARE_API_TOKEN        secret
CLOUDFLARE_ACCOUNT_ID       variable/secret according to workflow convention
```

Expected ZITADEL preview/app values when authenticated Platform testing resumes:

```text
MKETY_AUTH_ISSUER
MKETY_AUTH_CLIENT_ID
MKETY_AUTH_CLIENT_SECRET
MKETY_AUTH_SESSION_SECRET
```

Public `mkety.com` deployment should not be blocked by ZITADEL unless a public route genuinely requires authenticated application behavior.

Cloudflare remains the production edge/runtime target. Do not introduce Vercel.

---

## 5. Current implementation status

### 5.1 Public website/CMS foundation

**STATUS: IMPLEMENTED FOUNDATION / NOT PRODUCTION-READY**

Already present on `main`:

- CMS-backed root homepage;
- production content fallback system;
- Mkety platform content tables;
- admin Platform Control Center/public-site editing foundation;
- CMS seed/migration/smoke scripts;
- published site settings;
- published homepage;
- published header navigation;
- published pricing display;
- workspace content;
- FAQ/footer content;
- CMS-backed docs tree/articles;
- vinext Cloudflare runtime baseline.

Connected Supabase currently contains approximately:

```text
platform_pages               1
platform_page_sections       4
platform_navigation_items    7
platform_pricing_plans       3
platform_pricing_features    13
platform_workspace_cards     5
platform_docs_categories     5
platform_docs_articles       4
platform_site_settings       1
platform_content_revisions   0
```

Current public page:

```text
home — published
```

Current homepage CMS section records:

```text
hero
workspaces
faq
footer
```

Several homepage sections shown by React are still code-owned rather than fully CMS-owned.

### 5.2 Known public-site blockers

**STATUS: MUST FIX BEFORE LIVE CUTOVER**

Known blockers discovered during September 8 audit:

1. Root `src/app/layout.tsx` still uses old template metadata:
   - `Next.js SaaS AI Template | AI-Native Skills Management`.
2. Only one public CMS page exists (`home`).
3. Public site information architecture is incomplete as dedicated/public routes.
4. Public Mkety AI is not yet an implemented production public assistant.
5. Site settings have no configured logo URL, favicon URL or social/share image.
6. Public contact email is currently null in CMS settings.
7. Legal pages/links require production completion and verification.
8. `robots.txt` / sitemap / canonical/OG metadata must be verified or implemented.
9. Old template documentation remains in parts of the repository; anything reachable from `/docs` must be Mkety-correct.
10. Public responsive/accessibility/performance/SEO smoke has not been recorded against an actual Cloudflare deployment.
11. Real `mkety.com` Cloudflare route/domain cutover has not been verified for this new application.
12. Existing CMS fallback catches database errors and silently serves defaults; production observability must distinguish a healthy fallback from a database outage.
13. Public content currently risks describing planned capabilities as if production-complete unless copy is carefully status-safe.

### 5.3 app.mkety.com Platform stack

**STATUS: DEVELOPMENT PAUSED AS TOP PRIORITY UNTIL PUBLIC SITE IS LIVE**

Current internally developed stack remains:

```text
main
 ↓
Auth #16
 ↓
Automation Webhooks #15
 ↓
Billing #21
 ↓
Entitlements #22
 ↓
Usage/Credits #23
 ↓
Wallet design/plan
```

Do not discard these branches. Do not merge them out of order.

Wallet implementation should pause while the public-site production milestone is the active product priority unless explicitly resumed by the user.

---

## 6. MILESTONE A — mkety.com production-ready public site

### Definition of done

`mkety.com` is considered finished enough for public testing only when all items below are verified on the actual Cloudflare-hosted candidate:

```text
[ ] Mkety visual/brand identity complete
[ ] No old template branding visible on public routes
[ ] Homepage complete
[ ] Platform presentation complete
[ ] Workspaces presentation complete
[ ] SolutionHub presentation complete
[ ] Academy presentation complete
[ ] Pricing/Plans presentation complete
[ ] Enterprise presentation complete
[ ] Trading clearly Custom/Enterprise
[ ] About/company information complete
[ ] Docs public experience complete enough for current product state
[ ] Public Mkety AI implemented safely OR explicitly feature-flagged unavailable with no false promise
[ ] Contact/support paths valid
[ ] Privacy page valid
[ ] Terms page valid
[ ] Cookie/analytics disclosure where required
[ ] SEO metadata complete
[ ] sitemap complete
[ ] robots rules complete
[ ] canonical domain correct
[ ] Open Graph/social metadata correct
[ ] favicon/logo/share image correct
[ ] mobile/tablet/desktop responsive verification passed
[ ] keyboard/accessibility smoke passed
[ ] broken-link crawl passed
[ ] forms/CTAs tested
[ ] fallback/error/404 behavior tested
[ ] CMS reads from Supabase dev DB verified
[ ] CMS admin publish/update flow verified
[ ] public content database outage behavior understood and observable
[ ] tests/type-check/lint/build green
[ ] vinext compatibility check green
[ ] Cloudflare package/deploy dry run green
[ ] real Cloudflare preview/candidate deployment green
[ ] mkety.com custom-domain routing/SSL green
[ ] production smoke green
[ ] rollback path documented
[ ] legacy live site remains recoverable until final acceptance
```

---

## 7. Public-site implementation order

### PUBLIC-01 — Freeze public product information architecture

**STATUS: NEXT**

Deliverables:

- Decide which content is homepage anchored vs dedicated page.
- Minimum public route set:

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
/contact  (or an approved contact destination)
```

- Keep `Sign In` and `Get Started` pointing toward the Platform without requiring app feature completion for normal public browsing.
- Trading appears only as Enterprise/Custom.
- Do not expose `mklms` as a core Mkety product.

### PUBLIC-02 — Brand and global metadata cleanup

Deliverables:

- Replace template metadata at root.
- Dynamic metadata from `platform_site_settings`/page records where appropriate.
- Mkety logo/favicon/social image.
- canonical `https://mkety.com`.
- Open Graph/Twitter metadata.
- application name/theme-color where supported.
- remove public-facing legacy template copy.

### PUBLIC-03 — Complete CMS content model usage

Deliverables:

- Make all routine public copy/content editable from the existing platform CMS where the architecture already intends this.
- Ensure Platform, SolutionHub, Academy and Enterprise content is not unnecessarily hard-coded in `MketyHomePage.tsx`.
- Add required page/section records through repository-controlled migration/seed/update processes.
- Populate real sort orders (current pricing plans all have sort order 0 and should be deterministic).
- Preserve safe code fallbacks.
- Add content revisions/audit evidence for admin-managed changes.

### PUBLIC-04 — Production homepage experience

Deliverables:

- premium Mkety homepage using mksaas visual DNA;
- compact/tab-oriented experience rather than a generic extremely long page;
- Platform, Workspaces, SolutionHub, Academy, Enterprise, Pricing and Public AI surfaced clearly;
- honest capability/status wording;
- working CTAs;
- complete responsive navigation including mobile;
- no placeholder/generic template visuals/copy.

### PUBLIC-05 — Dedicated public pages

Deliverables:

- Platform page;
- Workspaces overview;
- SolutionHub/Solutions page;
- Academy page;
- Pricing page;
- Enterprise page;
- About page;
- Contact/support page or approved external contact route.

Where content is still planned rather than operational, clearly distinguish product direction from currently available functionality.

### PUBLIC-06 — Public documentation cleanup

Deliverables:

- `/docs` homepage is Mkety-branded.
- Publicly reachable docs do not describe the repository as `Next.js SaaS AI Template`.
- Public docs do not claim Auth.js/Auth0/OpenNext/Vercel architecture where current architecture uses Mkety Auth/ZITADEL/vinext/Cloudflare.
- CMS-backed docs categories/articles expanded from the current small seed to a useful launch set.
- Documentation describes actual current availability versus roadmap capability.
- Docs navigation/search/mobile rendering tested.

Internal engineering documents may retain historical references when they are clearly historical and are not public product documentation.

### PUBLIC-07 — Public Mkety AI

Deliverables:

- Separate public visitor assistant from Platform Agent Builder.
- Public-only knowledge/context.
- No tenant-private data access.
- Strict request/body limits.
- rate limiting/abuse protection.
- bounded execution.
- no arbitrary tool access.
- safe prompt/system instructions.
- visitor-facing error/fallback state.
- privacy disclosure appropriate to actual storage behavior.
- usage/cost guardrails.

If Public AI cannot meet those safety/availability requirements before public launch, hide/feature-flag the interactive capability rather than shipping an unsafe or fake implementation. The public site may describe it as coming soon only if that wording is explicitly approved.

### PUBLIC-08 — Legal, trust and support

Deliverables:

- Privacy Policy.
- Terms of Service.
- Cookie/analytics disclosure if tracking is enabled.
- Contact method.
- Company/product identity information.
- security/trust wording that does not overclaim certifications, SLAs, production maturity or capabilities.
- legal footer links managed through site settings/CMS where appropriate.

### PUBLIC-09 — SEO and discoverability

Deliverables:

- `sitemap.xml`.
- `robots.txt`.
- canonical metadata.
- page-specific title/descriptions.
- OG/Twitter cards.
- structured data where useful and truthful.
- semantic headings.
- clean internal links.
- 404/not-found metadata.
- no index of private/admin/app routes through public sitemap.

### PUBLIC-10 — Analytics and production observability

Deliverables:

- choose/enable only approved analytics.
- avoid unnecessary personal-data collection.
- runtime error visibility for public routes.
- database-fallback/outage logging without secrets.
- Cloudflare observability enabled and verified.
- production health/smoke path.

### PUBLIC-11 — Supabase development-database verification

Deliverables:

- verify only `saas_template` Mkety objects required by public site;
- run repository migrations safely against the development database only when required;
- seed missing public CMS records without overwriting deliberate admin-managed values;
- run `pnpm db:smoke:mkety-content` against `STAGING_DATABASE_URL`;
- confirm no destructive database action;
- confirm no unrelated table mutation.

Do not make broad schema changes merely to deploy the public site.

### PUBLIC-12 — Cloudflare preview deployment

Deliverables:

- dedicated non-production public-site candidate Worker/environment or safely isolated route;
- GitHub workflow requires tests/typecheck/lint/build/vinext/dry-run before deploy;
- Cloudflare credentials provided only through GitHub secrets/variables;
- record exact candidate URL and SHA;
- smoke homepage, public pages, docs, AI (if enabled), 404 and all external CTAs.

### PUBLIC-13 — mkety.com cutover

Deliverables:

- verify DNS ownership/current live target;
- preserve existing legacy site until replacement candidate passes;
- bind `mkety.com` and `www.mkety.com` according to approved redirect/canonical strategy;
- SSL active;
- canonical URL correct;
- run external smoke on actual domain;
- verify rollback target before declaring cutover complete.

Never take down the existing public site first and then attempt to debug the replacement.

### PUBLIC-14 — Production acceptance and public handoff

Deliverables:

- final immutable SHA;
- tests/build/deployment evidence;
- Supabase smoke evidence;
- Cloudflare deployment URL/domain;
- public readiness checklist completed;
- remaining non-blocking public backlog recorded;
- branch merged/promoted only after acceptance;
- mark `mkety.com` milestone `PRODUCTION / PUBLIC TESTING` only after real external verification.

---

## 8. MILESTONE B — app.mkety.com continuation after public-site acceptance

After `mkety.com` is live for testing, resume the Platform promotion/development track.

### APP-01 — Auth external promotion gate

Resume PR #16:

- Cloudflare preview Worker.
- ZITADEL redirect/logout configuration.
- real browser login/callback/session/protected-route/logout smoke.
- promote Auth only after verification.

### APP-02 — Webhooks promotion

- refresh against exact promoted Auth SHA;
- verify migration sequence;
- immutable verification;
- promote after Auth.

### APP-03 — Billing promotion

- refresh against promoted Webhooks;
- preserve verified Billing behavior;
- verify migration sequence;
- promote after Webhooks.

### APP-04 — Entitlements promotion

- preserve deny-by-default Mkety entitlement boundary;
- refresh against promoted Billing;
- verify and promote.

### APP-05 — Usage/Credits promotion

- preserve separate product-credit ledger;
- refresh against promoted Entitlements;
- verify automation credit enforcement;
- promote.

### APP-06 — Wallet implementation

Existing approved Wallet design/plan can resume after the public milestone and upstream stack is stable.

Wallet remains:

- read-oriented commercial/accounting balance;
- Billing-ledger derived;
- no stored-value cash;
- no second financial ledger;
- no withdrawal/transfer;
- no automatic FX;
- separate from product Usage/Credits.

### APP-07 and later

Return to the architecture order in `AGENTS.md` and approved Platform plans for:

- Deployments/Cloud;
- SolutionHub implementation;
- Domains;
- Integrations;
- Administration;
- production hardening;
- scale/multi-cloud/enterprise.

Exact next feature must be chosen from current repo state at that time, not assumed from historical notes.

---

## 9. Required verification commands for every meaningful batch

At minimum:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
pnpx vinext check
```

For public-content/database changes also run:

```bash
pnpm db:smoke:mkety-content
```

For migration changes also run the repository's current migration-integrity checks and `drizzle-kit check` according to the active branch scripts.

For Cloudflare candidate work also run the supported deployment dry run before real deployment.

Do not claim a command passed unless it actually ran on the reported SHA.

---

## 10. Status vocabulary

Use only:

```text
PLANNED
IN PROGRESS
IMPLEMENTED
VERIFIED
PRODUCTION
BLOCKED
DEFERRED
```

Definitions:

- **PLANNED** — design/roadmap exists; implementation not started.
- **IN PROGRESS** — active code/content/infrastructure work.
- **IMPLEMENTED** — code exists; full required verification not necessarily complete.
- **VERIFIED** — required test/build/smoke gates passed on an identified SHA/environment.
- **PRODUCTION** — verified on the real intended production environment/domain.
- **BLOCKED** — cannot proceed until a concrete dependency is resolved.
- **DEFERRED** — explicitly out of current milestone.

---

## 11. Mandatory handoff format

Every substantial implementation batch must update this document or create a feature handoff referenced from it.

Report:

```text
Requested goal
Branch
Base SHA
Final SHA
Status
What already existed
What changed
Files/modules affected
Database changes
Supabase objects touched
Environment variables/secrets required (names only)
Tests run
Type-check result
Lint result
Build result
vinext result
Database smoke result
Cloudflare dry-run result
Cloudflare deployment result
Production-domain result
Known blockers
Known non-blocking debt
Exact next batch
```

Do not record secret values.

---

## 12. Resume instructions for any future agent

When starting a new Mkety session:

1. Read `AGENTS.md` for governing rules. Do not modify it merely to record progress.
2. Read this file completely.
3. Inspect the current branch and latest commits/PRs.
4. If `mkety.com` is not yet marked `PRODUCTION`, continue the first incomplete `PUBLIC-*` batch before returning to major `app.mkety.com` feature work.
5. Inspect current code/database state before implementing; do not recreate existing features.
6. Use Supabase only within the Mkety schema/table boundaries relevant to the active task.
7. Use GitHub secrets/variables for Cloudflare/ZITADEL/database credentials; never print them.
8. Run the required verification gates.
9. Update progress/handoff before ending the session.

### Current exact next action

```text
PUBLIC-01 — Freeze the public route/information architecture,
then PUBLIC-02 — remove legacy template metadata/branding from public surfaces.
```

The detailed task-level implementation plan for this milestone lives at:

```text
docs/superpowers/plans/2026-09-08-mkety-public-site-production.md
```
