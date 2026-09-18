# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/cloudflare-db-lazy-singleton`  
**Pull request:** #56

## Requested outcome

Finish the `mkety.com` public site and production cutover safely, then move directly into authenticated `app.mkety.com` development using the existing roadmap and completed foundations.

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Latest production evidence

PR #55 merged to `main` as `4a48b717d75ace420f5f58e7f96b9a2aa86b8771`.

Production deep diagnostic run `35291618958` on that exact SHA established:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved;
- direct route-free Hyperdrive `SELECT 1` passed;
- the Mkety Vinext Worker built and deployed with production `MKETY_DB`;
- the explicit source split fixed the Public Assistant path: `/api/public/assistant` returned **HTTP 200** for the first time in the production diagnostic;
- `/api/runtime-db-diagnostic`, `/api/health`, `/`, and `/platform` still returned HTTP 500;
- the runtime diagnostic response body was empty rather than a structured stage response.

The empty diagnostic body plus Public Assistant success isolated the remaining blocker to the Cloudflare singleton import path, not Hyperdrive, request-scoped Postgres, or the Public Assistant database path.

## Current repair: PR #56

`src/shared/db/cloudflare.ts` previously resolved Hyperdrive, created the postgres client, and created the Drizzle singleton during module evaluation.

That meant any route/page importing `db/cloudflare` could fail before its handler executed, which exactly matched the production pattern:

- request-scoped Public Assistant path: healthy;
- singleton-importing routes/pages: 500 before structured handler output.

PR #56 changes the Cloudflare singleton to lazy initialization:

- module import exports a proxy without resolving Hyperdrive;
- first real DB property access resolves the production connection string;
- postgres and Drizzle are created once;
- subsequent accesses reuse the same database singleton;
- public/Worker consumers keep the existing `db` API.

### TDD evidence

Test-only commit `f924b83c855b61ac089f01a274a36682758bbe5c` added lifecycle coverage requiring:

1. importing `./cloudflare` must not call the runtime connection resolver, postgres, or Drizzle;
2. the first actual DB property access must initialize exactly once and reuse the singleton.

The first CI attempt exposed only a test-harness scoping issue; commit `e0e571c366a2964479fea081192e511805e57300` made the test file an isolated TypeScript module without touching production code.

Valid behavioral red on `e0e571c366a2964479fea081192e511805e57300`:

- import-time resolver calls expected: 0;
- actual: 1;
- both new lifecycle assertions failed for the intended reason;
- the other 724 tests passed;
- type-check, lint, and build passed.

Implementation commit `33383e939ad05be269454186925e4805b813e91d` added lazy proxy-backed singleton initialization.

Commit `003222431e5b4f85575bbcde42ea3c721361b035` corrected one test assertion that had incorrectly required function object identity after proxy method binding; behavioral lazy-init coverage remained unchanged.

### Verification on implementation head `003222431e5b4f85575bbcde42ea3c721361b035`

Green:

- combined CI;
- standalone tests;
- standalone build;
- standalone type-check;
- standalone lint;
- Cloudflare/Vinext build and deployment-packaging smoke;
- PR validation;
- MegaLinter.

## Production safety

- `mkety.com/*` and `www.mkety.com/*` remain intentionally unbound.
- Do not cut over while any runtime or release-gate blocker remains.
- `/api/runtime-db-diagnostic` is CI-only.
- Temporary diagnostic Workers remain route-free and are cleaned up after runs.
- Diagnostic output must remain sanitized.
- Public Assistant production success does not by itself authorize cutover.

## Exact next steps

1. Merge PR #56 only with an exact-head guard after this handoff update.
2. Read the production deep diagnostic on the exact merge SHA.
3. Require the DB stage ladder to pass:
   - `cloudflare-binding`;
   - `explicit-cloudflare-resolver`;
   - `request-database`;
   - `singleton-database`.
4. Require `/api/health`, `/`, `/platform`, and Public Assistant to return their expected production statuses.
5. Run the complete public candidate/release gate across:
   - public pages;
   - docs/legal routes;
   - login/auth entry points;
   - Public Mkety AI memory/privacy/commercial grounding;
   - Enterprise checkout/payment safety and live credential verification.
6. Only after the full release gate is green, execute the reviewed production cutover workflow to bind `mkety.com/*` and `www.mkety.com/*`.
7. Verify canonical `www → apex` routing and all post-cutover production checks.
8. Record immutable cutover evidence here and in the continuation/handoff documentation.
9. Move immediately to authenticated app work:
   - reconcile stale draft PR #35 against current `main`;
   - then Entitlements #22;
   - Usage/Credits #23;
   - then the remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy PR must update this status and its feature handoff with: requested outcome, prior state, changes made, verification evidence, production/environment changes, blockers/risks, and exact next steps. No feature may be marked complete, verified, production, or merge-ready without that update.
