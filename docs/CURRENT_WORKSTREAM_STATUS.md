# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/public-runtime-root-cause-probe`  
**Pull request:** #42

## Requested outcome

Finish the `mkety.com` public-site production cutover safely, then resume authenticated `app.mkety.com` development from the existing roadmap rather than rebuilding completed work.

## Already present

The public Mkety site and substantial Platform foundations already exist in `mksaas`, including the public assistant, authentication/workspace infrastructure, enterprise checkout/payment routes, AI/agent foundations, automation/workflow foundations, deployment-related surfaces, tenant/admin routes, and Cloudflare/Vinext deployment infrastructure.

The intended milestone sequence remains:

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Proven production state

PR #41 merged to `main` as `c42108625dc62e51fda7fab4873c7ada31581650` and replaced the earlier false-green diagnostics with fail-closed checks.

Fresh production diagnostics from that exact SHA proved:

- the apex/www Worker route guard passes; the replacement is not yet bound to `mkety.com/*` or `www.mkety.com/*`;
- production Hyperdrive `mkety-production-db` resolves successfully;
- a route-free Worker using the same Public Assistant postgres client shape, `postgres(connectionString, { max: 1 })`, executes `SELECT 1` successfully and returns HTTP 200;
- the current Mkety Vinext application builds and deploys successfully with that same production Hyperdrive binding;
- `/robots.txt` and `/sitemap.xml` return HTTP 200 on the current route-free app;
- `/api/health`, `/`, and `/platform` return HTTP 500;
- `/api/public/assistant` returns the handled HTTP 503 temporary-unavailable response;
- the same Public Assistant 503 reproduces on the existing `mkety-platform` Worker and on a freshly built Worker from the exact current SHA.

This rules out basic Hyperdrive/Postgres connectivity and a merely stale deployed Worker. The remaining fault is higher in the Mkety/Vinext application runtime.

## Current diagnostic: PR #42

PR #42 narrows the fault inside the actual Vinext bundle without adding a permanent product endpoint.

Its workflow creates a diagnostic-only `/api/_diagnostics/runtime-db` route in the GitHub runner before `pnpm build`. The route is therefore present only in the temporary route-free diagnostic Worker and is not committed as an application endpoint.

The route checks these stages in order while returning only booleans plus sanitized error name/code:

1. `runtime-resolver`: whether `getRuntimeDatabaseConnectionString()` can see the Worker runtime database binding inside the built Vinext application.
2. `request-database`: whether `withPublicAIRequestDatabase()` can execute `SELECT 1` inside that bundle.
3. `singleton-database`: whether the normal shared `db` singleton can execute `SELECT 1` inside that bundle.

The workflow also captures sanitized `/api/health`, root, and Public Assistant response bodies and fails closed after evidence collection.

## TDD evidence for PR #42

An initial diagnostic contract test was mistakenly placed under `scripts/`, which the repository Jest config does not collect because its roots are `src/`. That unexecuted duplicate was removed.

The contract test was moved to `src/shared/db/public-runtime-deep-diagnostic.test.ts`. On commit `1ac8ab3`, the main Test job then failed exactly because `/api/_diagnostics/runtime-db` and the required runtime-stage markers did not yet exist: **1 failed, 155 passed; 1 failed, 715 passed**. This is the red phase.

The workflow implementation was added only after that confirmed failure. Fresh branch CI must now prove the green phase before PR #42 is merged.

## Production safety

- The legacy public site remains live until the replacement passes the release gate.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the application runtime blocker remains unresolved.
- PR #42 does not change public product behavior and does not add a permanent diagnostic API route.
- Temporary diagnostic Workers remain route-free and are cleaned up by the workflow.
- No production cutover is claimed yet.

## Exact next steps

1. Verify PR #42 lint, type-check, tests, build, and PR validation are green after the diagnostic implementation.
2. Merge PR #42 only after fresh verification.
3. Run the hardened deep diagnostic on `main` and inspect `RUNTIME_DB_DIAGNOSTIC` evidence.
4. Branch on the proven stage:
   - resolver fails → fix Cloudflare/Vinext runtime binding resolution or alias wiring;
   - request DB fails → fix request-scoped postgres/Drizzle integration;
   - singleton DB fails → fix singleton initialization/runtime lifecycle;
   - all three pass → continue upward into schema/query/Public Assistant or other shared dynamic-runtime code.
5. Implement the proven root-cause fix test-first and re-run the production diagnostic.
6. When dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
7. Cut over `mkety.com` / `www.mkety.com` only after that gate is green and the cutover workflow's required authorization conditions are satisfied.
8. Update `MKETY_DEVELOPMENT_CONTINUATION.md` and this file with immutable cutover evidence.
9. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
