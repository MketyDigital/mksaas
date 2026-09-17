# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/cloudflare-runtime-binding-diagnostic`  
**Pull request:** #46

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
- PR #43 corrected that temporary diagnostic from the private/non-routable `_diagnostics` segment to the routable CI-only `/api/runtime-db-diagnostic` endpoint.
- PR #44 made direct-Hyperdrive readiness structural rather than status-code-only so transient generic Worker responses are retried and only the probe handler's expected JSON can end readiness.
- PR #45 added `global_fetch_strictly_public` alongside `nodejs_compat` after production emitted Cloudflare error 1042 on dynamic Vinext requests. The exact implementation head passed combined CI, standalone tests, lint, type-check, build, and Cloudflare/Vinext smoke before merge.
- The repository has a mandatory feature-agent handoff protocol and this canonical current-workstream file. Material work is not considered complete without current status, verification, blockers, and exact next steps.

## Latest production evidence

Production deep-diagnostic run `35277639490` tested `main` SHA `2a3bb15c9f5d8b22b9955b75267dc1fcb7754f77` after PR #45.

It established:

- apex/www Worker routes remain intentionally unbound;
- production Hyperdrive resolves correctly;
- the direct route-free Hyperdrive probe returned its expected structured handler response and successfully executed `SELECT 1` using `postgres(connectionString, { max: 1 })`;
- the prior Cloudflare 1042 symptom did not reappear in this run;
- static `/robots.txt` and `/sitemap.xml` returned HTTP 200;
- `/api/runtime-db-diagnostic` returned a structured HTTP 500 body identifying the first failing stage as `runtime-resolver`;
- the diagnostic body was `{"ok":false,"stages":[{"ok":false,"stage":"runtime-resolver","name":"Error","code":null}]}`;
- `request-database` and `singleton-database` were never reached;
- `/api/health`, `/`, and `/platform` still returned HTTP 500;
- `/api/public/assistant` still returned its handled HTTP 503 temporary-unavailable response.

The direct Hyperdrive query succeeding while the in-bundle resolver fails means the current blocker is specifically inside the Vinext/Cloudflare application binding-resolution path, before a postgres client is constructed.

## Current external/runtime guidance

Current Cloudflare Workers documentation supports importing bindings with:

```ts
import { env } from 'cloudflare:workers';
```

Current Vinext Cloudflare documentation also explicitly recommends that same API in route handlers, server components, and server actions. Therefore the product resolver is not being changed merely because binding access failed once in Mkety; the deployed application needs one more safe observation to distinguish whether the `MKETY_DB` binding is absent inside the route environment or present without a usable `connectionString`.

The current `resolveDatabaseConnectionString()` helper itself is a simple selector: Hyperdrive connection string first, `DATABASE_URL` second, otherwise it throws `Error('No database connection string is available')`.

## Current repair: PR #46

PR #46 extends only the temporary CI-built `/api/runtime-db-diagnostic` endpoint with a stage before `runtime-resolver`:

```text
cloudflare-binding
→ runtime-resolver
→ request-database
→ singleton-database
```

The new `cloudflare-binding` stage exposes only safe booleans:

- `hasBinding`
- `hasConnectionString`

No binding object, connection string, credentials, secrets, hostnames, or database contents are returned.

### TDD evidence

The collected regression was committed first on `22b28c7ed07ecfc453fdd63d83648943106068d4`.

Red phase:

- combined CI **Test** job failed;
- **Lint** passed;
- **Type-check** passed;
- **Build** passed;
- intended failure: the workflow did not yet contain the required `cloudflare-binding`, `hasBinding`, and `hasConnectionString` diagnostic contract.

Implementation commit `863c36657e9a7a4413dd59dffcca7ba13e4feaec` adds that CI-only stage. Fresh green verification is required before merge.

## Production safety

- The currently reachable public site remains untouched while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the runtime blocker remains unresolved.
- `/api/runtime-db-diagnostic` is created only inside the GitHub Actions runner before the temporary Vinext build; it is not a permanent product route.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, raw binding values, or database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require fresh PR #46 tests, lint, type-check, build, and Cloudflare/Vinext smoke to pass on the implementation head.
2. Merge PR #46 only after fresh green evidence.
3. Run the production deep diagnostic on the resulting `main` SHA.
4. Read the new `cloudflare-binding` stage:
   - `hasBinding=false` → the generated/deployed Vinext route environment is not receiving `MKETY_DB`; inspect/fix generated Worker binding propagation test-first.
   - `hasBinding=true` and `hasConnectionString=false` → Hyperdrive binding exists but the expected connection-string property is unavailable in this environment; verify current Hyperdrive binding shape/runtime semantics and fix the adapter test-first.
   - both true but `runtime-resolver` fails → inspect resolver module/alias/runtime execution directly; do not touch request/singleton DB yet.
   - binding and resolver pass → continue to `request-database`, then `singleton-database` based on the first failing stage.
5. Implement only the proven root-cause product fix with a failing regression first.
6. Re-run the production diagnostic until the entire database stage chain passes.
7. Then isolate any remaining `/api/health`, public-page, and Public Assistant failures one layer at a time.
8. When dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
9. Cut over `mkety.com` / `www.mkety.com` only after the full gate is green and required authorization conditions are satisfied.
10. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
11. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
