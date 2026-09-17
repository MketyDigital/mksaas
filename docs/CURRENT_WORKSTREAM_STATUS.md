# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/hyperdrive-probe-readiness`  
**Pull request:** #44

## Requested outcome

Finish the `mkety.com` public-site production cutover safely, then resume authenticated `app.mkety.com` development from the existing roadmap rather than rebuilding completed work.

The intended milestone sequence remains:

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Already present

The public Mkety site and substantial Platform foundations already exist in `mksaas`, including Public Assistant, authentication/workspace infrastructure, enterprise checkout/payment routes, AI/agent foundations, automation/workflow foundations, deployment-related surfaces, tenant/admin routes, and Cloudflare/Vinext deployment infrastructure.

## Completed cutover-repair work

- PR #41 hardened the production diagnostic so failed/non-200 probes cannot be reported as successful and the diagnostic tests the current commit instead of a stale SHA.
- PR #42 added a CI-only in-bundle diagnostic for the Cloudflare runtime database resolver, Public Assistant request-scoped database, and shared singleton database.
- PR #43 corrected that temporary diagnostic from the private/non-routable `_diagnostics` segment to the routable CI-only `/api/runtime-db-diagnostic` endpoint. Its core CI, lint, type-check, build, and Cloudflare/Vinext smoke gates were green before merge.
- The repository now has a mandatory feature-agent handoff protocol and this canonical current-workstream file. Material work is not considered complete without current status, verification, blockers, and exact next steps.

## Proven production state

Production diagnostics have established that:

- the apex/www Worker route safety guard passes; the replacement is still intentionally unbound from `mkety.com/*` and `www.mkety.com/*`;
- production Hyperdrive `mkety-production-db` resolves to the diagnostic Worker;
- a prior route-free direct probe using the same Public Assistant postgres shape, `postgres(connectionString, { max: 1 })`, successfully executed `SELECT 1`;
- a freshly built Mkety Vinext Worker serves static metadata routes such as `/robots.txt` and `/sitemap.xml` but dynamic routes `/api/health`, `/`, and `/platform` returned HTTP 500;
- `/api/public/assistant` returned its handled HTTP 503 temporary-unavailable response on both the existing Worker and a freshly built Worker from the tested SHA.

This means the public cutover remains blocked and no apex/www route should be bound yet.

## Latest diagnostic finding

After PR #43 merged, production deep-diagnostic run `35276154954` tested `main` SHA `18e7b5185caab0a5eed1f19600df861459afa53a`.

The run stopped before the in-bundle diagnostic because the newly deployed direct Hyperdrive probe's **first** request returned a generic HTTP 500 whose body did not contain the probe handler's expected structured fields (`ok`, `stage`, error identity). The workflow incorrectly treated any HTTP 500 as proof that the probe was ready and failed immediately.

This is a diagnostic readiness/propagation defect, not sufficient evidence of a new database failure. An earlier run of the same temporary Worker required a readiness retry before returning its structured successful `SELECT 1` result.

## Current repair: PR #44

PR #44 makes direct-probe readiness structural rather than status-code-only.

Expected behavior:

1. Generic/unstructured 404/500/startup responses are **not ready** and are retried.
2. A structured `{ ok: false, stage: 'binding' | 'query', ... }` HTTP 500 is a real probe result: stop retrying and fail closed with sanitized evidence.
3. A structured `{ ok: true, stage: 'query' }` HTTP 200 is healthy and allows the workflow to proceed to the Vinext in-bundle diagnostic.

### TDD evidence

The collected regression test was added first under `src/shared/db/public-runtime-deep-diagnostic.test.ts`.

On red-phase commit `3377c2c3d777a053c6c419b7a3c952fd2bd2c978`:

- the main **Test** job failed;
- **Type-check** failed;
- **Lint** passed;
- the intended failure was the missing `evaluateStructuredProbe` contract.

Implementation commits add the minimal structured probe evaluator and update the production workflow to retry until the response is genuinely from the diagnostic handler.

## Production safety

- The legacy/publicly reachable site remains in place while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the runtime blocker remains unresolved.
- Diagnostic routes are created only in the CI runner before build; no permanent diagnostic product endpoint is added.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, or raw sensitive database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require fresh PR #44 tests, lint, type-check, build, and Cloudflare/Vinext smoke to pass on the implementation head.
2. Merge PR #44 only after that fresh green evidence.
3. Run the hardened deep diagnostic on the resulting `main` SHA.
4. Confirm the direct Hyperdrive probe reaches a structured result; if it reports a real structured database failure, fix that proven failure test-first.
5. If direct Hyperdrive is healthy, inspect `/api/runtime-db-diagnostic` and branch on its first failing stage:
   - `runtime-resolver` fails → fix Cloudflare/Vinext binding resolution or alias wiring;
   - `request-database` fails → fix request-scoped postgres/Drizzle integration;
   - `singleton-database` fails → fix singleton initialization/runtime lifecycle;
   - all three pass → continue upward into shared dynamic-runtime, schema/query, Public Assistant persistence/provider logic.
6. Implement the proven root-cause product fix test-first and re-run production diagnostics.
7. Once dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
8. Cut over `mkety.com` / `www.mkety.com` only after the full gate is green and required authorization conditions are satisfied.
9. Record immutable cutover evidence in this file and `MKETY_DEVELOPMENT_CONTINUATION.md`.
10. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
