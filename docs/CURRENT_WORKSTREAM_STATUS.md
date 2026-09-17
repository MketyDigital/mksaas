# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `diagnose/vinext-explicit-cloudflare-resolver`  
**Pull request:** #48

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

- PR #41 hardened production diagnostics and introduced the mandatory feature-agent handoff protocol.
- PR #42 added the CI-only in-bundle runtime database diagnostic.
- PR #43 corrected the diagnostic route to the routable CI-only `/api/runtime-db-diagnostic` endpoint.
- PR #44 made direct-Hyperdrive readiness structural rather than status-code-only.
- PR #45 added `global_fetch_strictly_public` alongside `nodejs_compat` after Cloudflare 1042 responses appeared on dynamic Vinext requests.
- PR #46 added the safe `cloudflare-binding` stage.
- PR #47 proved that Vinext's generic `@` alias preceded the exact runtime-database alias in resolved Vite config, then moved the exact Cloudflare resolver alias to the front of the final resolved alias list. Its exact final head was fully green before merge.

## Latest production evidence

PR #47 merged to `main` as `c26d6430583110ff0668517e557e80e62ac20d23`.

Production deep-diagnostic run `35282084243`, job `105406079338`, tested that exact SHA and established:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved correctly;
- the direct route-free Hyperdrive probe executed `SELECT 1` successfully;
- the current Mkety Vinext Worker built and deployed route-free with the production Hyperdrive binding;
- inside the Vinext Worker, `cloudflare-binding` reported `MKETY_DB` present and its `connectionString` present;
- despite PR #47 making the exact Cloudflare resolver alias first in resolved Vite config, the immediately following aliased `runtime-resolver` stage still failed with a sanitized generic `Error`;
- therefore Cloudflare binding propagation, Hyperdrive availability, the Hyperdrive connection string, direct postgres connectivity, and resolved Vite alias precedence are all proven healthy;
- the unresolved boundary is now between resolved Vite configuration and the module actually emitted/consumed by the Vinext application runtime;
- dynamic-route probes also surfaced Cloudflare 1042-style responses again, so those remain a separate or downstream runtime concern to re-evaluate after the database resolver path is isolated;
- public cutover remains blocked and `mkety.com/*` / `www.mkety.com/*` must remain unbound to the replacement Worker.

## Current diagnostic: PR #48

PR #48 adds one discriminator only to the temporary CI route. It compares, in the same deployed Vinext Worker and request:

1. direct `cloudflare:workers` binding visibility;
2. an explicit import of `@/shared/db/runtime-connection.cloudflare`;
3. the normal aliased import of `@/shared/db/runtime-connection`;
4. the Public Assistant request-scoped database wrapper;
5. the shared singleton database wrapper.

The route still returns only booleans and sanitized error identity. It is created in the GitHub Actions runner before build and is never committed as a permanent product route.

### TDD evidence

Test-only commit `a20c4f9fb45073e46c27fb11d405917d54d125c6` added the requirement for an `explicit-cloudflare-resolver` stage before implementation.

That head produced a clean red:

- standalone tests: one failing suite/test, specifically because the workflow did not yet import `@/shared/db/runtime-connection.cloudflare`;
- resolved-alias regression remained green;
- lint passed;
- type-check passed;
- build passed.

Implementation commit `60bd35c8e623106bfdd2a924a8e9e4a15744f28d` adds the explicit Cloudflare resolver import and stage before the aliased resolver stage. No product route, database schema, secret, Hyperdrive configuration, or public-domain route was changed.

Fresh green verification is required on the final PR #48 head before merge.

## Production safety

- The currently reachable public site remains untouched while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the runtime blocker remains unresolved.
- `/api/runtime-db-diagnostic` is CI-only and is not a permanent application endpoint.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, raw binding values, or database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require fresh tests, lint, type-check, build, Cloudflare/Vinext smoke, PR validation, MegaLinter, and other required checks to pass on the final PR #48 head.
2. Merge PR #48 only with an exact-head guard after green verification.
3. Run/read the production deep diagnostic on the resulting `main` SHA.
4. Interpret the new stage chain without guessing:
   - if `explicit-cloudflare-resolver` fails, inspect the Cloudflare adapter/runtime module itself despite direct binding health;
   - if explicit passes but aliased `runtime-resolver` fails, the fault is conclusively in Vinext's emitted/resolved module graph after Vite config resolution;
   - if both resolver stages pass, continue to `request-database` and `singleton-database` and stop at the first failing wrapper;
   - if all database stages pass, isolate the remaining dynamic-route/1042 behavior separately.
5. Re-check `/api/health`, `/`, `/platform`, and `/api/public/assistant` only after the first failing runtime layer is corrected.
6. When dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
7. Cut over `mkety.com` / `www.mkety.com` only after the full gate is green and required authorization conditions are satisfied.
8. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
9. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
