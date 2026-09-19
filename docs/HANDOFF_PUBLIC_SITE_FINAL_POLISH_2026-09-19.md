# Handoff — Mkety Public Site Final Polish — 2026-09-19

## Scope

Finish the remaining public-site quality issues before resuming authenticated Platform/app development.

Do not modify the independent live `mklms` Enterprise product.

## Current release state

- PR #80 (`feat: enable Mkety self-service billing checkout`) was merged to `main`.
- Merge SHA: `a250ce1ceb24dc39be9b8b6da67a5a881b31cf45`.
- The frozen public production release branch `feat/mkety-public-site-production` was fast-forwarded to that exact SHA.
- Exact-head PR verification for the self-service Billing/public AI release passed tests, type-check, lint, build, CI, Vinext/Cloudflare packaging, migration baseline, MegaLinter, staging DB seed/smoke, isolated candidate deploy, public route smoke, Enterprise payment safety, and Public Mkety AI privacy/runtime acceptance.
- Certification-control PR #81 (`ops: certify merged public release a250ce1`) was opened to repin the existing certification launcher and its guard test from the previous release SHA to `a250ce1...`.
- PR #81 had not been merged at handoff time. Continue its checks and merge it only when green. Its purpose is to dispatch the exact-SHA manual certification workflows:
  - Mkety Content DB Smoke
  - Mkety Public AI Runtime Diagnostic
  - Mkety Production Routing Preflight
  - Mkety Public Candidate Deploy
- After those exact-SHA certification runs are green, repin the existing production cutover launcher to `a250ce1...`, update the matching production-cutover guard test, merge that small control-plane PR, and let the guarded production cutover workflow perform production DB release + Worker/custom-domain cutover + post-cutover verification.

## New public-polish branch

Branch: `fix/public-site-final-polish`

Base: merged release SHA `a250ce1ceb24dc39be9b8b6da67a5a881b31cf45`

Completed on this branch:

### 1. MketyOS mobile overflow

Commit: `58990878058495184a34ceabc0130106a57b1efb`

File:
- `src/features/platform-content/components/public/MketyPublicExperience.tsx`

Changes:
- added `min-w-0` containment through the MketyOS showcase
- constrained the mobile tab rail to the viewport
- made tabs non-growing/shrink-safe
- added break-word handling for active-group headings/descriptions and showcase cards
- hardened cards against right-side text clipping on narrow screens

Required next-session verification:
- inspect 320px, 360px, 390px and 430px widths
- verify Platform, Workspaces, Solutions and Academy tabs
- specifically confirm no MketyOS text is clipped to the right

### 2. Public Mkety AI position and icon

Commit: `ff1fe739f1906aa62dcd49550f3966c508db6a02`

File:
- `src/features/public-assistant/components/MketyPublicAssistant.tsx`

Changes:
- closed AI command moved from bottom-floating position to `top-[4.5rem]`, directly below the sticky public header
- open chat panel also opens from the top below the header
- generic Sparkles/Bot icons replaced by the Mkety logo route (`/mkety-logo.png`)
- transparent compact launcher behavior from PR #80 is preserved

Required next-session verification:
- ensure launcher does not cover page navigation/hero content
- check mobile safe-area behavior and scrolling
- verify open panel height at small viewport heights
- if the user specifically prefers the favicon mark rather than the full logo asset, switch the image source to the canonical favicon/logo mark after visually confirming which asset is correct

### 3. Trading Workspace visibility

Commit: `7dfeb1bc9516da190b54a89c2695ffb03aa46dcf`

File:
- `src/features/platform-content/public-page-defaults.ts`

Changes:
- Platform presentation now explicitly says Trading Workspace exists as a specialized Custom / Enterprise workspace
- Workspaces description explicitly includes Trading Workspace as Custom / Enterprise
- Pricing SEO/intro/commercial-model copy explicitly includes Trading Workspace
- no self-service Trading price is invented
- Trading stays outside Starter/Mkety One/self-service checkout

Existing `/workspaces` data already contains a dedicated Trading Workspace card with:
- badge: `Custom / Enterprise`
- description for trading automation, signal workflows, integrations, execution infrastructure, monitoring and deployments

Next session must also verify Trading Workspace appears appropriately on:
- homepage Workspaces presentation
- `/platform`
- `/workspaces`
- `/pricing`
- relevant public AI answers
Do not convert Trading into a normal fixed-price self-service plan.

## Remaining requested fixes

### A. Login / Register downloads a text/API file

User reports public Sign In / Get Started currently causes a text/API download instead of opening the auth UI.

Source code currently points correctly to:
- `/login`
- `/signup`

The actual auth pages exist under:
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/signup/page.tsx`

This strongly suggests a deployed Worker/content-type/routing issue rather than simply a bad public href.

Next session:
1. reproduce on the deployed candidate first, not production
2. inspect response status, `Content-Type`, `Content-Disposition`, canonical redirect behavior and Worker routing for `/login` and `/signup`
3. inspect Vinext/Cloudflare route packaging for auth pages
4. fix at the routing/runtime layer, not by replacing valid page links with an API URL
5. add candidate smoke checks that fail if auth routes return download/binary/text-attachment behavior
6. verify both direct navigation and public-header navigation

### B. Enterprise Contact Sales must begin with Public Mkety AI

Requirement:
- every final Enterprise / Contact Sales CTA should open or route into Public Mkety AI first
- AI should gather a small amount of non-sensitive qualification context before routing the user to the appropriate sales/contact destination
- this includes Trading sales enquiries

Do not ask for passwords, secrets, payment data, private account data, API keys or other sensitive data.

Recommended implementation:
1. add an explicit public-AI sales-intake mode/query contract, e.g. a safe public intent such as `enterprise-sales`
2. CTA opens Mkety AI with a human opening prompt such as:
   “Tell me briefly what you want Mkety to build or help with.”
3. collect only a few useful fields conversationally:
   - what they need
   - individual/team/company context
   - preferred product or “not sure”
   - rough scope/timeline if voluntarily provided
   - contact handoff preference
4. after sufficient context, AI directs to the approved sales/contact route
5. Trading enquiries should be recognized as Trading Workspace / Custom Enterprise, not quoted a stale fixed price
6. update all Enterprise CTA sources:
   - homepage Enterprise section
   - `/enterprise`
   - Pricing Enterprise CTA
   - Trading Workspace CTA
   - other “Contact Sales”, “Discuss Enterprise Project”, “Request Proposal” style CTAs
7. add public-AI tests and candidate acceptance covering the intake flow

### C. Homepage repetition / world-class editorial pass

User reports too many repeated headings/section messages on the homepage.

Current structure includes:
- hero
- MketyOS/product showcase
- Platform content section again
- Workspaces section again
- SolutionHub
- Academy
- Enterprise
- Trust
- Pricing
- FAQ

Likely source of repetition:
- MketyOS showcase already presents Platform + Workspaces + SolutionHub + Academy, then several of those are repeated immediately below with similar headings/descriptions.

Next session should perform an editorial/layout pass rather than simply deleting content.

Recommended direction:
- Hero: one clear company/platform promise
- MketyOS: compact interactive product map / primary discovery surface
- Workspaces: one focused commercial/product comparison section
- SolutionHub: examples/outcomes rather than another “what it is” heading
- Academy: visually distinct real-world learning section
- Enterprise/Trading: custom-delivery section
- Pricing: concise plan decision section
- Trust/FAQ: combine or reduce if repetitive

Review every eyebrow + H2 pair for unique purpose. Avoid repeating phrases such as “one platform”, “build automate deploy”, “focused workspaces”, and “custom requirements” across consecutive sections.

Keep the site concise, premium, product-led and editorially distinct rather than adding more sections.

### D. “At Our Hubs” must use real class images from legacy Mkety

Current implementation still uses Unsplash placeholders in:
- `src/features/platform-content/components/public/MketyPublicExperience.tsx`
- constant: `academyHubs`

Legacy repository confirmed:
- `MketyDigital/Mkety`
- private
- default branch `main`

User says the correct class images already exist inside that repo's `public` folder.

Next session:
1. inspect the legacy repo tree/archive to identify the actual class/hub image filenames
2. copy only the approved image assets into MKSaaS public assets
3. do not copy legacy code or stale pricing/content
4. replace the five Unsplash URLs in `academyHubs`
5. use the real class photos with correct cropping/aspect ratio and meaningful alt text
6. verify image optimization/caching and mobile rendering

Do not substitute new stock photos. The requirement is specifically to use the legacy real class images.

### E. Public AI response quality

Already completed in PR #80:
- smaller transparent launcher
- controlled response formatter
- clean paragraphs/lists/bold/link rendering
- common bare routes converted to descriptive links
- prompt discourages raw asterisks, raw slash routes, JSON/tool output, “As an AI…” filler and excessive Markdown
- tests cover formatted answers and launcher behavior

Continue regression testing after moving the panel to the top.

## Release discipline

Do not mix the new `fix/public-site-final-polish` branch into the in-flight certification/cutover of `a250ce1...`.

First finish or deliberately stop the existing release certification. Then complete/test this polish branch as a separate PR and run:
- tests
- type-check
- lint
- build
- MegaLinter
- Vinext/Cloudflare packaging
- staging DB smoke when relevant
- isolated public candidate deploy
- public route smoke
- Public AI live acceptance
- auth route response/content-type checks
- mobile visual checks

Only after those are green should this polish branch be merged and promoted as the next public release.

## After public-site polish

Resume authenticated Platform/app work at APP-07 Deployments/Cloud.

Previously documented next slice:
- authorized
- audited
- non-production
- customer invocation path over the existing Deploy execution kernel

Do not broaden the first APP-07 slice into production provider mutation, production DNS/custom-domain mutation, OCI/Coolify production mutation or rollback execution unless separately approved.
