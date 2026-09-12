# Mkety Public App-Like Visual Contract

**Status:** Locked public-site design requirement  
**Date:** 2026-09-09  
**Scope:** `mkety.com` public pages only  
**Branch at decision:** `feat/mkety-public-site-production`

## Intent

The production public site must retain the current CMS-backed/public-runtime architecture while restoring the distinctive, unusual, application-like visual character that was present in the original `Create-Node-App/nextjs-saas-ai-template` and the legacy Mkety homepage.

This is a presentation and interaction restoration, not an architecture rollback.

## Non-negotiable visual direction

1. Public pages should feel like a product/application surface rather than a conventional flat marketing website.
2. Use layered panels, nested cards, bento/grid compositions, compact status/detail surfaces, and controlled depth to create the app feel.
3. The homepage must include a tab-like interactive product showcase inspired by the original template and legacy Mkety homepage. Tabs must expose Mkety's real public product areas rather than template/demo content.
4. The app-grid language should carry through the shared public page renderer so Platform, Workspaces, Solutions, Academy, Pricing, Enterprise, About, and Contact feel like one Mkety system without making every page identical.
5. Mobile is first-class: cards must reflow cleanly, horizontal interactive regions must remain usable, and controls must not rely on hover.
6. Interactive tabs must be keyboard reachable and expose selected state accessibly. Reduced-motion preferences must remain usable.

## Homepage contract

The homepage keeps `MketyHomePage` and the CMS/query path as the source of public content. The visual restoration must happen inside the current renderer.

Required characteristics:

- Product/app-style hero preview rather than a single generic marketing card.
- A prominent tabbed Mkety showcase using real CMS-backed Platform, Workspaces, SolutionHub, and Academy content.
- Nested/bento cards with varied visual weight and clear links into dedicated public routes.
- Existing public route anchors, pricing, FAQ, metadata, and CTA behavior remain intact.

## Academy: At Our Hubs

The new public Academy experience must include a restored **At Our Hubs** module adapted from the legacy `MketyDigital/Mkety` homepage.

The recognizable five-module set is:

1. Web & App Engineering
2. Trading Masterclass
3. Digital Funnel & Marketing
4. AI & Automation Lab
5. Certified Digital Skills

The section should preserve the legacy horizontally browsable/snap-card character and strong visual module identity while using the new public component system. Trading remains training/education content here; Mkety Platform's Trading product boundary remains Enterprise/Custom as defined by `AGENTS.md`.

## Architectural guardrails

This work must NOT:

- replace or bypass the CMS-backed public content architecture;
- reintroduce the legacy monolithic homepage runtime;
- reintroduce legacy Supabase client reads on public presentation components;
- change tenant/public AI data boundaries;
- change payment, Enterprise checkout, billing, entitlement, wallet, or subscription behavior;
- change canonical routing, metadata contracts, sitemap/robots behavior, or `www.mkety.com -> mkety.com`;
- reintroduce Vercel into the production public flow;
- alter `AGENTS.md`.

Production remains Cloudflare + OCI.

## Deployment consequence

Candidate #155 (`34315821753`) is a baseline diagnostic candidate only after this requirement was added. Any source change implementing this visual contract requires a fresh candidate from the new exact SHA.

`PUBLIC SITE = PRODUCTION` may be marked only after the fresh SHA passes the complete candidate gates and the guarded real-domain production verification already defined for PUBLIC-15.

## Acceptance checklist

- [ ] Shared public pages use the Mkety app/card/grid visual language.
- [ ] Homepage has accessible tab-like Mkety showcase.
- [ ] Homepage remains CMS-backed.
- [ ] Academy includes the five-module At Our Hubs section.
- [ ] Mobile layout and keyboard interaction are usable.
- [ ] No tenant/public data boundary changes.
- [ ] No payment/entitlement behavior changes.
- [ ] No Vercel route/runtime dependency introduced.
- [ ] `AGENTS.md` unchanged.
- [ ] Fresh candidate run verifies the exact implementation SHA before production cutover.
