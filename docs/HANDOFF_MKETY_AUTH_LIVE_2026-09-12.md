# Mkety Auth Live Promotion Handoff — 2026-09-12

**Repository:** `MketyDigital/mksaas`  
**Branch:** `feat/mkety-auth-zitadel-vinext`  
**Base:** `main` at `0693b00fba639549d92c4dd82a2fcef618d0bd47`  
**Recorded branch head before this handoff:** `d8e8cd1a224a140b5d77bd23755b8716c29219a1`  
**Status:** IN PROGRESS — one interactive browser gate remains

## 1. What is now externally verified

The previous handoff's Cloudflare/ZITADEL credential blockers are no longer current.

A real isolated Cloudflare Worker exists and has been deployed successfully:

```text
Worker: mkety-platform-preview
URL: https://mkety-platform-preview.dry-glitter-7e16.workers.dev
```

The live preview workflow has successfully verified:

- frozen dependency installation;
- full repository tests;
- TypeScript type-check;
- lint;
- vinext compatibility;
- production build;
- isolated Cloudflare preview packaging;
- required Cloudflare preview credentials;
- deterministic workers.dev origin discovery;
- idempotent ZITADEL preview application reconciliation;
- durable Mkety session-secret strategy;
- exact-origin rebuild;
- real Worker deployment;
- required runtime binding names;
- public preview routes;
- unauthenticated `/api/auth/session` boundary;
- real ZITADEL authorization redirect;
- exact client id/callback URI binding;
- Authorization Code + PKCE S256.

Successful live preview workflow evidence:

```text
Run: 34705070007
Preview application id: 390460446777320288
Preview OIDC client id: 390460446777385824
```

No OIDC client secret is required for the preview application because the Mkety preview client is configured as a public Web client using Authorization Code + PKCE.

## 2. Exact preview callback contract

```text
Issuer:
https://mkety-dzb0ve.eu1.zitadel.cloud

Callback:
https://mkety-platform-preview.dry-glitter-7e16.workers.dev/api/auth/callback

Post logout:
https://mkety-platform-preview.dry-glitter-7e16.workers.dev/login
```

The ZITADEL application reconciliation is idempotent and preserves the exact Mkety preview redirect/logout contract.

## 3. ZITADEL login-policy evidence

A non-destructive GitHub Actions diagnostic now inspects the live project's organization login settings without changing them.

Verified live state:

```text
allowUsernamePassword: true
allowLocalAuthentication: true
allowDomainDiscovery: true
primary verified organization domain: mkety.eu1.zitadel.cloud
```

The diagnostic intentionally does not change instance or organization login policy merely to make CI easier.

## 4. ZITADEL Cloud tier safety for current testing

The Mkety Auth architecture remains provider/tier-neutral. The current ZITADEL Cloud Free environment is appropriate for the present development/preview load; production can move to the appropriate paid ZITADEL tier without changing Mkety Auth's application architecture.

Operational rule:

- keep preview resource reconciliation idempotent;
- do not create persistent test users per deployment;
- avoid unnecessary Management API polling;
- monitor actual DAU/API usage before production launch;
- treat production tier selection as an operational capacity/SLA decision, not an Auth rewrite.

## 5. Browser automation experiment disposition

A temporary CI experiment attempted to automate the final hosted-login journey with a disposable ZITADEL user and disposable staging workspace.

It proved:

- management-token user creation works;
- temporary staging/ZITADEL cleanup works;
- the hosted login page is reachable;
- the hosted login page requires additional interactive/login-name handling beyond the safe automation supported through the current repository connector.

The experimental workflow and its unused Playwright spec were removed rather than weakening the promotion gate or leaving PR #16 permanently red.

This experiment is **not** counted as a successful authenticated smoke.

## 6. Exact remaining Auth promotion gate

PR #16 must remain DRAFT until a real browser session proves all of the following against the current preview deployment:

1. open Mkety preview login;
2. continue to the real ZITADEL hosted authorization flow;
3. authenticate an authorized test/member identity;
4. return through `/api/auth/callback`;
5. verify `/api/auth/session` is authenticated;
6. verify current Mkety database membership controls tenant access;
7. open a protected tenant route successfully;
8. logout through Mkety Auth;
9. verify the Mkety session is revoked;
10. verify browser returns to the preview `/login` route.

Do not replace this with a synthetic token test and do not mark it passed based only on the authorize redirect/PKCE smoke.

## 7. Promotion order after Auth

Only after the browser gate above passes:

```text
Auth #16
  → Automation Webhooks #15
  → Billing #21
  → Entitlements #22
  → Usage/Credits #23
  → Wallet
  → Deploy/Cloud, SolutionHub, Domains, Integrations, Administration, production hardening
```

Every downstream layer must be refreshed and reverified on the exact promoted ancestor; stale earlier green evidence is not sufficient for promotion.

## 8. Trading boundary

No change was made to `MketyDigital/Trading`.

Trading remains an independent enterprise application. Any Trading-related identity work in this program is limited to ZITADEL-side/shared Mkety identity resources that are genuinely required by the approved architecture.

## 9. Public-site cutover boundary

This Auth work does not authorize a public production route mutation.

The `mkety.com` production cutover remains governed by the public release runbook and its exact release-SHA + explicit cutover confirmation gate.
