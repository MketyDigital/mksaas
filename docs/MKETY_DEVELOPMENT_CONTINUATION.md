# Mkety Development Continuation Roadmap

## 2026-09-21 verified production baseline

The `mkety.com` public milestone is live and production authentication has been repaired.

Current verified production contract:

- `mkety.com` / `www.mkety.com` → `mkety-platform` Cloudflare Worker Custom Domains;
- Worker runtime database access → `MKETY_DB` → `mkety-production-db-v2` Hyperdrive → Workers VPC Service → private PgBouncer/PostgreSQL path;
- production Mkety Auth provider → ZITADEL;
- `/login` and `/signup` are public Mkety-branded entry pages;
- `/api/auth/login` reaches ZITADEL using Authorization Code + PKCE S256;
- production callback → `https://mkety.com/api/auth/callback`;
- auth cutover verification run → `35571673240`.

Do not restore the legacy production Hyperdrive merely because older handoff sections reference it. Treat those sections as historical evidence. Any future DB/auth change must prove the new path independently and preserve rollback evidence.

Open PRs that predate this baseline must be reconciled against current `main` before use; do not merge them as historical patches.


### Production ZITADEL self-registration repair

Post-auth-cutover validation found that the Mkety organization inherited a ZITADEL login policy with local authentication enabled but self-registration disabled. The production signup page therefore reached the hosted identity flow but could not create a new local user.

The repair created an organization-scoped login policy that preserves the current effective login settings and enables `allowRegister=true` without changing the instance-wide default policy.

Verification evidence:

- repair run `35572460697`: success;
- independent post-repair diagnostic run `35572489071`: success;
- effective production policy now permits self-registration, local authentication, and username/password authentication.

This means `/signup` can now use the same Mkety Auth/ZITADEL OIDC entry flow as `/login` while exposing ZITADEL's self-registration path for new users.

### Production sign-in vs registration intent repair

A live-user report showed that both Mkety `/login` and `/signup` were entering the same generic ZITADEL authorization flow. When ZITADEL remembered an older account/session, signup could therefore show the hosted account chooser instead of opening registration.

The application flow now carries an explicit Mkety auth intent end to end:

- Mkety sign-in → `intent=signin` → OIDC `prompt=login`;
- Mkety signup → `intent=signup` → OIDC `prompt=create`;
- Authorization Code + PKCE `S256`, one-time state/nonce transaction persistence, and the production callback remain unchanged.

Guarded production deployment run `35573336899` passed and independently verified both live redirect contracts against the production ZITADEL issuer. Rollback was not required.

Additional lifecycle verification established:

- disposable verified ZITADEL identities can be created through the existing production management credential;
- ZITADEL username/password session creation succeeds for those identities;
- production OIDC auth-request lookup succeeds;
- the CI management PAT intentionally cannot finalize an OIDC auth request: ZITADEL returns `403 No matching permissions found` because finalization requires the dedicated instance `IAM_LOGIN_CLIENT` / `session.link` capability;
- do **not** grant `IAM_LOGIN_CLIENT` to the general `ZITADEL_MANAGEMENT_PAT` or an application end-user merely to make CI impersonate the hosted login. ZITADEL's hosted login already operates with the appropriate login-client authority. A future deterministic callback smoke should use a separate least-privilege login-client service account/PAT if one is provisioned.

The earlier Playwright production lifecycle attempts are not evidence of a Mkety product failure: they failed inside ZITADEL's reactive hosted-login field before Mkety callback. The protocol smoke then isolated the final CI-only permission boundary above. Treat the live redirect/policy/database evidence as the production baseline unless a real browser user reports a new callback/session failure.

**Status:** ACTIVE OPERATIONAL HANDOFF — PUBLIC MILESTONE PRODUCTION / APP WORK RESUMED  
**Updated:** 2026-09-21  
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

**STATUS: PRODUCTION / PUBLIC TESTING**

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

**STATUS: ACTIVE — PUBLIC SITE IS LIVE; RESUME PLATFORM PROMOTION/DEVELOPMENT**

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
- Do not expose internal customer implementations as core Mkety products.

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
APP-07 Deployments/Cloud — verify and merge the metadata-only Deploy foundation
(applications, environments, deployment history), then design provider execution separately.
```

The detailed task-level implementation plan for this milestone lives at:

```text
docs/superpowers/plans/2026-09-08-mkety-public-site-production.md
```


## Live Public AI acceptance alignment

Cutover run `35307191844` passed authorization, production DB migration, exact-SHA quality checks, Hyperdrive resolution, Worker deploy/secrets, preview smoke, Custom Domain attachment, live route/canonical/sitemap/robots checks, and the semantic `www.mkety.com -> https://mkety.com/` 308 redirect check. Final acceptance then failed in the Public AI assertion and automatically rolled back the newly attached Custom Domains/restored prior A records.

The production acceptance contract had drifted from the already-certified candidate contract: it required `trade.mkety.com` in a new Trading buyer answer, while candidate certification explicitly rejects direct `trade.mkety.com` handoff for new buyers and requires Enterprise-first Trading sales. Branch `release/align-live-ai-acceptance-2e871fe` makes live acceptance identical to the certified boundary: canonical plans/prices, Academy production destination, Enterprise-first Trading sales, removed-plan rejection, and private-source/internal-engineering rejection. Launcher generation is `worker-custom-domains-v7`.


## 13. Public milestone completion — immutable production handoff

`mkety.com` is now **PRODUCTION / PUBLIC TESTING**.

Successful production evidence:

```text
Certified application SHA: 2e871fe5ba51585886713c2cb79544e68dc20b73
Cutover launcher/main SHA: 4811e4b22c5a457857122ed01b8910546ca658df
Production cutover run: 35309531966
Worker: mkety-platform
Database runtime: MKETY_DB Hyperdrive (mkety-production-db)
Domains: mkety.com + www.mkety.com Worker Custom Domains
www canonical redirect: HTTP 308 -> https://mkety.com/
```

The successful run passed production DB migration/seed/smoke, exact-SHA quality checks, Hyperdrive resolution, Worker build/deploy, removal of legacy direct DB secret, runtime-secret attachment, preview smoke, Custom Domain attachment, public routes, canonical metadata, sitemap, robots, NOWPayments fail-closed webhook behavior and live Public Mkety AI commercial/privacy boundaries.

Rollback evidence is immutable in Actions artifacts `10533230861` (pre-mutation) and `10532738152` (Custom Domain rollback evidence).

The public-site milestone no longer blocks authenticated Platform development. Resume from current `main`; do not revive historical public-site tasks merely because older sections below retain their original implementation-order record.

### Next authenticated Platform order

1. Reconcile stale draft PR #35 (`fix: make RLS helper hardening portable to private Postgres`) with current `main`.
2. Entitlements #22.
3. Usage/Credits #23.
4. Continue the current app roadmap under `app.mkety.com`.

For PR #35, preserve the intended RLS/private-Postgres hardening but do not blindly merge its historical head.


## RLS helper portability reconciliation

Historical draft PR #35 is superseded by current `main`. Its intended migration behavior is already present in `migrations/0008_harden_rls_auto_enable.sql`: the optional `public.rls_auto_enable()` helper is detected with `to_regprocedure`, and Supabase-only `anon` / `authenticated` revokes are conditional so private PostgreSQL does not fail when those objects are absent.

The only still-missing part from PR #35 was its regression coverage. Branch `fix/rls-auto-enable-portable-current-main` adds `src/shared/db/rls-auto-enable-migration.test.ts` against the current implementation. No production database mutation is performed by this reconciliation branch; it only locks the already-shipped portable migration behavior with tests.

Next after this reconciliation: Entitlements #22, then Usage/Credits #23.


## Entitlements current-main reconstruction

Entitlements #22 is being rebuilt from its entitlement-only delta on top of the post-production-cutover main. Do not merge the historical stacked branch directly.

The reconstruction preserves deny-by-default semantics, plan-version grants, tenant deny/grant overrides, backend authorization enforcement, and workspace filtering. Runtime database reads are adapted to the current Cloudflare gateway. Migration ordering remains `0012` after the current `0011_billing_core_foundation`.

After Entitlements verification/merge, continue to Usage/Credits #23.


## Usage/Credits current-main reconstruction

Usage/Credits #23 is being rebuilt from its feature-only delta on top of the merged Entitlements current main. Do not merge the historical stacked branch directly.

The reconstruction preserves the separate product-credit ledger, idempotent/concurrency-safe mutations, Billing-derived recurring allowances, and workflow execution enforcement. Runtime database access is adapted to the current Cloudflare gateway. Migration ordering remains `0013` immediately after Entitlements `0012`.

After Usage/Credits verification/merge, continue the remaining authenticated Platform roadmap; Wallet remains a separate later slice and must not become a second financial ledger.


## Entitlements and Usage/Credits verification evidence

Entitlements current-main reconstruction PR #72 passed its full required gate set and merged as `19dc6f89a0a7ee17cc7f3bc43189e2e864f5d602`.

Usage/Credits current-main reconstruction PR #73, exact head `3cf6419824ddd4f58cca38398b81d3701df3157b`, is verified green on:
- Migration Baseline `35313143927`;
- Platform Core Workspaces Smoke `35313143828`;
- Build `35313143803`;
- Typecheck `35313143605`;
- Lint `35313143726`;
- CI `35313143693`;
- Cloudflare Vinext Smoke `35313144012`;
- Pull Request Validation `35313143881`;
- full tests/coverage `35313143824`;
- MegaLinter `35313143813`;
- PR-level validation `35313142418`.

No production database mutation has been run from PR #73. The repository migration chain is now prepared through `0013_lively_magma.sql`, with Usage/Credits still separated from Wallet and from the Billing financial ledger.

Next after PR #73 merges: continue the authenticated Platform roadmap from the current post-Usage/Credits main. Wallet remains a later, separate commercial/accounting projection and must not become stored-value or a second financial ledger.


## Wallet implementation resumed

With the public milestone complete and Entitlements/Usage-Credits merged on current main, APP-06 Wallet is active.

The first implementation is intentionally read-only:
- current plan/subscription and billing-period amount;
- Billing ledger activity;
- verified/applied settlements;
- separate product-credit balance with explicit non-cash wording.

It adds no wallet persistence because Billing already owns monetary truth and Usage/Credits already owns product-credit truth. This preserves the rule that Wallet is not stored value and not a second financial ledger.

After this Wallet slice is verified and merged, return to the architecture order for Deployments/Cloud, then later SolutionHub, Domains, Integrations and Administration.


## Wallet verification evidence

Wallet PR #74 implementation head `0ffbcd7216591a2bfe4a9deeb748685a524c6858` passed:
- Build `35314114841`;
- Lint `35314114675`;
- Typecheck `35314114736`;
- CI `35314114653`;
- Cloudflare Vinext Smoke `35314114632`;
- full tests/coverage `35314114614`;
- Pull Request Validation `35314114611`;
- MegaLinter `35314114745`;
- PR-level validation `35314111695`.

The public candidate deployment job `35314114685` was correctly skipped because Wallet is authenticated app work, not a public-site release.

No database migration or production database mutation is part of this Wallet slice. Wallet remains read-only and derives monetary information from the existing Billing ledger/state while displaying Usage/Credits separately as non-cash product credits.

After Wallet merges, the next architecture workstream is Deployments/Cloud. Inspect current repository state first and implement the smallest missing foundation slice rather than recreating existing deployment code.


## Wallet pre-merge security correction

Wallet PR #74 was fully green on its initial implementation, but focused review found two correctness issues before merge:

1. the Wallet page called `auth()` without enforcing the result, while the tenant layout itself does not reject unauthenticated/non-member access;
2. the Wallet settlement list queried all tenant settlements although the UI/design describes verified/applied payment records.

The branch now:
- uses `requireTenantMembership(tenantSlug)` before any Wallet read;
- adds a reusable explicit tenant-membership guard in `src/shared/lib/permissions.ts`;
- filters Wallet settlements to Billing records with status `applied`;
- adds regression coverage locking both contracts.

Wallet remains read-only: no new table/migration, no cash/stored-value balance, no withdrawal/transfer/FX, no payment-provider call, and no second financial ledger.


## Wallet exact verification evidence

Corrected Wallet PR #74 passed its full required gate set on head `e6a49adb82c63dfa087fa42bf3585ce5f068b5e6`:

- Typecheck `35320741465`;
- full tests/coverage `35320741436`;
- Cloudflare Vinext Smoke `35320741401`;
- Lint `35320741408`;
- Build `35320741447`;
- CI `35320741527`;
- Pull Request Validation `35320741387`;
- MegaLinter `35320741378`;
- CodeQL / PR-level validation `35320738336`.

Security/correctness checks included explicit tenant-membership enforcement before Wallet reads and applied-only Billing settlement display.


## Deployments/Cloud foundation

Wallet APP-06 merged as `10abc1e269444e26f32865e2f128a6c9c69757b4`. The active app workstream is now APP-07 Deployments/Cloud.

Branch `feat/deploy-foundation-current-main` implements the smallest missing backend foundation without enabling infrastructure mutation:

- `deploy_applications` — tenant/project-scoped logical web/API/service records;
- `deploy_environments` — tenant/project/application-scoped development, preview, staging, and protected production metadata;
- `deployments` — read-oriented deployment history and release/provider references;
- migration `0014_deploy_foundation.sql` plus Drizzle journal/snapshot;
- manager/admin-only creation of application and environment metadata;
- tenant/project-scoped reads through the existing project access boundary;
- Deploy Workspace lists applications, environments, and deployment history;
- production environments are metadata-only and marked protected.

Explicitly not implemented in this slice: Cloudflare/OCI/Coolify provider calls, credentials, DNS/custom domains, public preview/production URLs, deployment triggers, production infrastructure mutation, or rollback execution.

Verification must include migration baseline / `drizzle-kit check`, full tests, type-check, lint, build, Vinext smoke, PR validation, and MegaLinter before merge.


## Deploy foundation exact verification evidence

Deployments/Cloud foundation PR #75 implementation head `ed3fdd853e606a66874bb2eef33a3e1bda10a03e` passed:

- Migration Baseline / Drizzle consistency `35322339405`;
- Platform Core Workspaces Smoke `35322339400`;
- Lint `35322339373`;
- Typecheck `35322339384`;
- Build `35322339468`;
- Cloudflare Vinext Smoke `35322339408`;
- CI `35322339444`;
- Pull Request Validation `35322339438`;
- full tests/coverage `35322339426`;
- MegaLinter `35322339425`;
- CodeQL / PR-level validation `35322338062`.

Migration `0014_deploy_foundation.sql`, its journal entry, and `0014_snapshot.json` passed the repository migration baseline and `drizzle-kit check`.

No deployment provider, DNS, custom-domain, public URL, credential, production execution, or rollback mutation is enabled by this slice. The next Deployments/Cloud batch must introduce provider execution only behind an explicit provider boundary, approvals/audit, bounded failure handling, and rollback design.


## Deploy provider-neutral execution kernel

After Deploy foundation PR #75 merged as `41b0d40d75c7889da4d6aaa522714b141dbc69b0`, the next bounded Deployments/Cloud slice is the internal execution kernel.

Branch `feat/deploy-execution-kernel` adds:
- provider-neutral deployment adapter and repository contracts;
- queued -> running -> completed/failed lifecycle orchestration;
- request-scoped Drizzle lifecycle persistence through the existing `deployments` table;
- hard rejection of protected or production environments before persistence/provider execution;
- sanitized provider failures with no raw provider error leakage;
- focused tests using an injected fake provider.

No real Cloudflare/OCI/Coolify adapter is registered. No customer-facing deploy action, provider credential, DNS/custom-domain mutation, public URL provisioning, production execution, or rollback execution is introduced.

Next after this kernel verifies/merges: implement one isolated non-production provider adapter/candidate environment with explicit credential boundaries and real external verification before exposing a customer deployment control.


## Deploy execution kernel pre-merge hardening

Focused review added two fail-closed guarantees before any real provider adapter can be introduced:

- deployment lifecycle transitions are verified atomically; provider execution does not proceed if `queued -> running` fails, and completion fails closed if `running -> completed` cannot be recorded;
- provider execution is bounded by a default 60-second timeout, with invalid timeout configuration rejected before a deployment record is created.

Provider failures and timeouts remain sanitized, protected/production environments remain non-executable, and no real Cloudflare/OCI/Coolify/DNS mutation is enabled.


## Deploy execution kernel exact verification evidence

Deploy provider-neutral execution kernel PR #76 hardened implementation head `72071d1e67fb7e658b2425eea989b55da3b4320e` passed:

- Typecheck `35368192278`;
- full tests/coverage `35368192320`;
- Lint `35368192308`;
- Platform Core Workspaces Smoke `35368192159`;
- Build `35368192344`;
- Cloudflare Vinext Smoke `35368192427`;
- CI `35368192142`;
- Pull Request Validation `35368192199`;
- MegaLinter `35368192327`;
- CodeQL / PR-level validation `35368187791`.

Pre-merge hardening verified:
- `queued -> running` and `running -> completed` transitions must persist successfully or execution fails closed;
- provider execution is bounded by a default 60-second timeout;
- invalid timeout configuration is rejected before persistence/provider execution;
- provider failures/timeouts are sanitized;
- protected and production environments remain non-executable;
- no real provider adapter, credential, DNS/custom-domain mutation, public URL provisioning, or production deployment action is included.


## Cloudflare Deploy candidate adapter

Deploy provider-neutral execution kernel PR #76 merged as `3900bd7d1efe7ac9ac5868b8dec8314c8aecb945`. The next Deployments/Cloud slice is the first real provider adapter, limited to isolated Cloudflare `workers.dev` candidates.

Branch `feat/deploy-cloudflare-candidate-adapter` adds:
- trusted server-side module artifact contract with strict module/count/source-size limits;
- candidate Worker names restricted to `mkety-deploy-candidate-*`;
- real Cloudflare Workers Script API transport;
- explicit workers.dev enablement with Preview URLs disabled;
- workers.dev URL derivation;
- exact candidate deletion;
- provider/transport tests;
- same-repository GitHub preview-environment workflow that deploys a fixture Worker, externally smokes its marker, and verifies cleanup.

Still excluded: customer-facing deployment action, arbitrary repository/source fetching, provider bindings/secrets, DNS/custom domains, `*.mkety.app`, production execution and rollback execution.


## Cloudflare Deploy candidate adapter exact verification evidence

Deployments/Cloud candidate adapter PR #77 exact implementation head `c6ba480098fd5e66c768ea0a00a92c3d7b22fad5` passed:

- isolated Cloudflare candidate deploy / external workers.dev smoke / verified cleanup `35382218226`;
- Typecheck `35382218151`;
- Lint `35382218206`;
- Build `35382218169`;
- Cloudflare Vinext Smoke `35382218248`;
- full tests/coverage `35382218166`;
- CI `35382218177`;
- Pull Request Validation `35382218143`;
- MegaLinter `35382218311`;
- CodeQL / PR-level validation `35382214335`.

The verified candidate path is intentionally isolated:
- Worker names are restricted to the `mkety-deploy-candidate-*` namespace;
- execution is blocked for protected or production environments;
- only trusted, size-bounded module artifacts are accepted;
- no Worker bindings or customer secrets are uploaded;
- workers.dev is enabled only for the candidate Worker, with Preview URLs disabled;
- no `mkety.com`, `www.mkety.com`, custom domain, DNS, route, OCI, Coolify, or production Worker mutation exists in this adapter;
- the workflow proved the candidate marker externally and then proved exact Worker deletion.

This slice still exposes no customer-facing deploy action and does not enable production execution. The next Deployments/Cloud step must add an authorized non-production invocation path and audit/approval boundary before any user-triggered provider execution is exposed.

## Public production-readiness hardening checkpoint

PR #79 (`feat/public-production-readiness`) temporarily paused the next APP-07 customer-triggered Deploy slice to close customer-facing production-readiness gaps discovered on the live/public Platform boundary.

Verified implementation head before this handoff-only documentation update:

`5bae8019b2deca6630bcfb2fb14fee5a52144ed2`

Completed scope:
- exact Mkety logo restored locally across public/auth/onboarding;
- Mkety signup, sign-in, workspace selection/creation, and tenant sign-in polished and kept provider-neutral;
- public mobile overflow and template/development wording removed;
- public Deploy claims reduced to capabilities actually present in the current backend foundation;
- Academy hub visuals restored;
- broken top-level workspace links replaced with the valid `/app` authenticated gateway;
- favicon, manifest, social card, canonical/OG/Twitter metadata, JSON-LD, sitemap, robots, and private-route indexing controls completed;
- CMS commercial migration made safe for admin-managed pricing rows;
- Enterprise custom payments kept admin-issued and exact-amount;
- stale candidate-workflow PR-number gate removed so current same-repository public PRs receive isolated external candidate verification.

Implementation-head verification runs:
- tests/coverage `35393687368`;
- type-check `35393687292`;
- lint `35393687288`;
- build `35393687466`;
- CI `35393687252`;
- Vinext smoke `35393687350`;
- migration baseline `35393687347`;
- Platform workspace smoke `35393687472`;
- content DB migrate/seed/smoke `35393687399`;
- PR validation `35393687423`;
- MegaLinter `35393687372`;
- isolated public candidate/external acceptance `35393687516`.

Candidate: `https://mkety-public-candidate.dry-glitter-7e16.workers.dev`.

The candidate returned HTTP 200 for the full required public route set plus sitemap/robots, verified NOWPayments credentials without creating a payment, passed the Enterprise exact-amount/payment-safety boundary, and passed Public Mkety AI provider, memory, New Chat isolation, commercial-grounding, Academy, Enterprise-first Trading, and private-source checks.

### Remaining commercial blocker before Mkety can be called fully self-service

Starter, AI Workspace, Automation Workspace, Deploy Workspace, and Mkety One do not yet have a live self-service Billing checkout. The Billing NOWPayments/Selar adapters intentionally still reject live `createCheckout` calls. Public CTAs therefore correctly onboard users instead of falsely claiming payment completion.

MKSaaS Billing is the authoritative billing implementation. Any remaining self-service checkout work must extend its existing gateway, checkout, verified-settlement, ledger, and Entitlements boundaries directly. Do not introduce a parallel or legacy-repository billing dependency.

Enterprise negotiated-payment links remain a separate valid operational flow and are not a substitute for self-service subscription checkout.

After self-service Billing checkout is verified, resume APP-07 Deployments/Cloud from the merged Cloudflare candidate-adapter state with an authorized, audited, non-production customer invocation path. Production deployment, DNS/custom domains, OCI/Coolify mutation, and rollback execution remain out of scope until their later explicit safety gates.
## Self-service Billing checkpoint

The next production-readiness priority after PR #79 has been implemented on PR #80.

MKSaaS Billing is now the authoritative Platform billing implementation. Historical references that told future work to source Platform billing from `mklms` were removed from MKSaaS. The `mklms` repository remains an independent live Enterprise Mkety product and was not changed or deployed as part of this Platform work.

PR #80 implements fixed-price self-service checkout for Starter, AI Workspace, Automation Workspace, Deploy Workspace, and Mkety One. It keeps authoritative prices server-side in integer minor units, preserves immutable plan versions, creates subscriptions in `pending_payment`, creates provider invoices from MKSaaS, verifies NOWPayments callbacks, binds signed provider amount/currency to the exact Mkety checkout and billing period, and applies only verified final settlements through the existing idempotent Billing repository/service. Entitlements become reachable only from qualifying Billing subscription state; browser return URLs never grant access.

Plan selection is preserved across public pricing, account creation/sign-in, tenant selection, and first-workspace creation into authenticated tenant checkout. Enterprise custom payment links remain separate.

The staging candidate and production migration-host release sequences now seed and smoke the canonical Billing catalog. The standalone staging database check also independently seeds the catalog before smoking it, avoiding false positives from shared staging state.

Once PR #80 is merged and promoted, continue APP-07 Deployments/Cloud with the authorized/audited non-production customer invocation path. Do not broaden that slice into production provider mutation, DNS/custom-domain execution, OCI/Coolify mutation, or rollback execution.
