# Mkety Auth Smoke and Independent Public-Site Release Design

Date: 2026-09-12
Branch: `feat/mkety-auth-zitadel-vinext`
Repository: `MketyDigital/mksaas`

## Objective

Close the remaining authenticated Auth promotion gate without reopening already-green Cloudflare, ZITADEL, database, session, or preview-deployment work, then proceed with `mkety.com` as an independently releasable public/commercial site while `app.mkety.com` continues on its own dependency chain.

`MketyDigital/Trading` is out of scope and must not be modified. Trading remains a separate Enterprise product; only genuinely shared identity resources may be configured in ZITADEL when required.

## Current evidence

The Auth branch has advanced beyond the earlier handoff SHA and is currently at commit `302637dadadbaa136c7494f90e80252791557c1b` (`ci: gate preview on authenticated browser smoke`).

The latest `Mkety Cloudflare Preview` run for that SHA is run `34707654800`.

The following boundaries passed in that run:

- preview candidate verification;
- tests, type-check, lint, vinext compatibility, build, and preview dry-run;
- deployment of the isolated `mkety-platform-preview` Worker;
- Cloudflare runtime bindings verification;
- public preview route smoke;
- unauthenticated session boundary smoke;
- real ZITADEL authorization redirect verification;
- exact preview callback verification;
- Authorization Code + PKCE S256 verification;
- ephemeral ZITADEL smoke-user creation and cleanup;
- Mkety smoke-record cleanup.

The only failing boundary was the reusable authenticated browser workflow. Playwright successfully reached ZITADEL's current v2 password page but did not complete the hosted-login flow and return to the preview origin before the test timeout.

## Auth smoke design

### Scope

Modify only the authenticated browser smoke boundary unless new evidence proves a production Auth defect.

Primary file:

- `.github/workflows/mkety-authenticated-preview-smoke.yml`

The parent preview workflow remains the gate:

- `.github/workflows/mkety-cloudflare-preview.yml`

### Required behavior

The authenticated smoke must continue to prove the complete real-hosted journey:

1. start at Mkety `/api/auth/login` with a safe return target;
2. redirect to the configured ZITADEL issuer;
3. enter the ephemeral smoke user's identifier on the current ZITADEL v2 login UI;
4. enter the password on the current ZITADEL v2 password UI;
5. complete any explicit continue/authorization step that is part of the hosted flow;
6. return through the Mkety callback to the preview origin;
7. verify a real Mkety session exists for the smoke identity;
8. create a unique workspace;
9. verify authenticated tenant access;
10. log out through the real Mkety logout path;
11. verify the Mkety session is null after logout;
12. always remove the temporary Mkety records and ZITADEL user.

### Implementation approach

Use explicit page-state handling for ZITADEL's current v2 login screens rather than relying on broad generic selectors alone.

The test should:

- recognize identifier/login-name state separately from password state;
- prefer semantically stable selectors such as labels, names, autocomplete attributes, and form roles;
- wait for an actual state transition after each submit instead of fixed short sleeps where practical;
- allow the hosted flow enough time to complete without hiding real stalls;
- stop immediately on an unexpected page state with useful diagnostics;
- preserve exact issuer-origin and preview-origin assertions;
- keep the test as a real browser login, not replace it with API/token-assisted authentication;
- keep cleanup in `if: always()` paths.

### Failure diagnostics

On failure, preserve enough evidence to identify the next exact boundary without exposing secrets. The workflow should retain or surface:

- current URL;
- page title;
- visible form/input/button summary or Playwright error context;
- screenshot and/or trace artifact where supported;
- the exact failed phase (identifier, password, authorization, callback, session, tenant, logout).

Secrets and generated passwords must remain masked.

### Auth success gate

Auth is considered promotion-ready only when the parent `Mkety Cloudflare Preview` workflow passes with the reusable authenticated smoke green on the exact branch SHA under review.

Record:

- passing workflow run ID;
- exact branch SHA;
- authenticated smoke job result;
- confirmation that cleanup completed.

Do not reopen or redesign already-green Cloudflare/ZITADEL foundations unless the authenticated test produces direct evidence that they are faulty.

## Independent `mkety.com` release stream

`mkety.com` must be releasable independently of `app.mkety.com`.

The public site is a commercial website with its own release criteria. It may link into the Platform where appropriate, but the public launch must not wait for every tenant Platform feature.

### Public release candidate scope

Audit and finish these public routes/capabilities:

- homepage and product positioning;
- Platform overview;
- Workspaces;
- SolutionHub / Solutions;
- Academy;
- Pricing;
- Enterprise;
- About;
- Docs;
- Contact;
- Privacy;
- Terms;
- Public AI;
- production 404/error behavior;
- SEO/social metadata;
- mobile and desktop quality;
- accessibility basics;
- analytics/error monitoring where already supported;
- production domain and SSL configuration.

### Commercial integrity rules

Every public claim and CTA must describe a genuine available path.

Do not ship:

- dead buttons;
- placeholder sections presented as finished;
- fake products or unsupported offers;
- invented pricing;
- misleading "available now" claims for unfinished functionality;
- Enterprise checkout with a fabricated fixed price.

For self-service offers with approved fixed pricing, public CTAs must use the real checkout/billing implementation.

For custom Enterprise engagements, use a real `Contact Sales`, `Request Proposal`, or Enterprise enquiry flow.

### Enterprise funnel

Enterprise must work without depending on a finished self-service Platform.

Required commercial journey:

`Enterprise page -> qualification/contact -> Mkety sales/support -> agreed scope -> contract/payment/onboarding`

Enterprise may cover:

- custom AI systems;
- automations;
- deployments;
- custom software/workspaces;
- Trading as a separate Enterprise solution;
- implementation/integration work;
- support and managed services.

The public site must make the engagement model clear and provide a real monitored path for initiating the conversation.

## Public AI design

Public AI on `mkety.com` is separate from tenant AI in `app.mkety.com`.

It may:

- explain Mkety;
- explain genuine products and workspaces;
- guide visitors to relevant public pages;
- discuss only approved current pricing;
- qualify Enterprise interest;
- escalate sales/support/human requests.

It must not:

- access tenant data;
- impersonate an authenticated Platform assistant;
- invent pricing or capabilities;
- expose secrets or internal configuration;
- claim live human availability unless the channel is actually monitored.

Preferred escalation flow:

`AI answer -> detect sales/support/Enterprise/human intent -> gather a short safe summary -> send visitor to the real Contact/Enterprise channel -> optionally include the summary with explicit consent`

## Public-site release sequence

After the Auth gate is green:

1. freeze a production candidate for the public site;
2. inventory and classify every public route;
3. audit all public copy for accuracy and production readiness;
4. audit every CTA/link/button;
5. finish Enterprise enquiry and sales escalation;
6. finish genuine payment/checkout paths that belong on the public site;
7. finish Public AI escalation;
8. run mobile, desktop, accessibility, SEO, 404, legal, and contact checks;
9. verify production Cloudflare configuration for `mkety.com`;
10. run production-candidate smoke tests;
11. record the exact public-site release SHA;
12. invoke only the repository's explicit production cutover mechanism using that approved SHA;
13. verify `mkety.com` after cutover;
14. continue Platform development independently.

A general request to "finish everything" must never implicitly alter production routing.

## `app.mkety.com` dependency chain

After Auth #16 is closed, preserve the existing dependency order exactly:

`Auth #16 -> Automation/Webhooks #15 -> Billing #21 -> Entitlements #22 -> Usage/Credits #23`

Do not flatten or merge this stack out of order.

After those foundations are promoted, continue the broader Platform audit in this order:

`AI -> Automate -> Deploy -> Workspaces -> SolutionHub -> Billing/Plans -> Usage/Credits -> Administration -> remaining onboarding/account/organization experiences`

Each Platform area must be classified as one of:

- production-ready;
- functional but incomplete;
- placeholder;
- missing;
- blocked by dependency.

Placeholders are then removed systematically.

## ZITADEL production posture

Continue using the existing dedicated preview application for testing and keep provisioning idempotent.

Do not create unnecessary users or applications on each run. Ephemeral smoke users are acceptable only when reliably deleted after the workflow.

Before serious production traffic, establish a separate production ZITADEL application/configuration and select an appropriate production tier for expected traffic, uptime, and support. Auth architecture must remain tier-independent so that changing tier is an operational change rather than an Auth rewrite.

## Testing and verification

For the Auth smoke change:

- validate workflow syntax;
- preserve existing static checks;
- run the parent preview workflow;
- require all preview jobs, including authenticated smoke, to pass;
- verify cleanup completes on both success and failure paths.

For the public-site candidate:

- route inventory and HTTP smoke;
- CTA/link audit;
- checkout/enquiry-path validation;
- mobile/desktop visual QA;
- accessibility checks;
- metadata/SEO validation;
- 404/legal/contact verification;
- Public AI safety/escalation tests;
- production Cloudflare preflight;
- exact-SHA release verification before cutover.

## Non-goals

This design does not:

- modify `MketyDigital/Trading`;
- redesign the Auth architecture;
- replace ZITADEL;
- make the public-site launch depend on completion of the Platform;
- collapse Platform dependency branches;
- perform production routing changes before an approved public release SHA exists.

## Success criteria

Auth succeeds when the real hosted login -> callback -> Mkety session -> tenant authorization -> logout flow passes in the automated preview gate on the exact branch SHA.

The public-site release succeeds when an unfamiliar visitor can use `mkety.com` to understand Mkety, explore genuine offerings, contact sales/support, begin an Enterprise engagement, and use supported payment flows without depending on completion of all `app.mkety.com` features.
