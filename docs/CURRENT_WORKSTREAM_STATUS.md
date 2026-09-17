# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/vinext-next-runtime-db-alias`  
**Pull request:** #49

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
- PR #47 proved that Vinext's generic `@` alias preceded the exact runtime-database alias in resolved Vite config, then moved the exact Cloudflare resolver alias to the front of the final resolved alias list.
- PR #48 added an explicit-vs-aliased resolver discriminator inside the same temporary deployed Vinext request.

## Latest production evidence

PR #48 merged to `main` as `9cfa5c02daaf36f702f2ed7726045cabdb811c39`.

The post-merge production deep diagnostic established, in the same deployed Vinext Worker/request:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved correctly;
- the direct route-free Hyperdrive probe executed `SELECT 1` successfully;
- the Mkety Vinext Worker built and deployed with the production Hyperdrive binding;
- `cloudflare-binding` reported `MKETY_DB` present and its `connectionString` present;
- `explicit-cloudflare-resolver` succeeded when importing `@/shared/db/runtime-connection.cloudflare` directly;
- the immediately following normal aliased `runtime-resolver`, imported as `@/shared/db/runtime-connection`, failed with a sanitized generic `Error`;
- therefore the Hyperdrive binding, connection string, network/query path, and Cloudflare adapter implementation are proven healthy;
- the remaining failure is specifically the module wiring/resolution of the normal runtime-database import inside Vinext's emitted application graph;
- public cutover remains blocked and `mkety.com/*` / `www.mkety.com/*` must remain unbound to the replacement Worker.

## Current repair: PR #49

PR #49 preserves the exact Cloudflare database runtime resolver through Vinext's supported Next-config webpack alias capture path, in addition to the existing Vite alias.

Current relevant configuration before this PR:

- `vite.config.ts` already resolves `@/shared/db/runtime-connection` to `runtime-connection.cloudflare.ts` and places that exact alias before Vinext's generic `@` alias;
- `tsconfig.json` has the generic `@/* -> ./src/*` mapping;
- `next.config.mjs` had no exact runtime-database alias;
- Vinext beta.9 supports capturing `webpack.resolve.alias` from wrapped Next config plugins.

### TDD evidence

The first two test-only attempts intentionally did not justify implementation because their synthetic webpack harness failed inside `next-intl` before reaching the alias assertion:

- `64f554944089a149be7a4bf77ec6c80e11655524`: missing wrapper context;
- `39f2dc34fc69db006f242c1ac7df168c50cb2d92`: adding only the webpack `dir` option was still insufficient.

Harness-only commit `bed5dd758dbfb15e12fd05be22b132ca506ef2d7` supplied both the synthetic webpack config context and normal wrapper options. That produced the valid red phase:

- the wrapped `next.config.mjs` webpack hook executed without exception;
- expected alias: `/src/shared/db/runtime-connection.cloudflare.ts`;
- received alias: empty string;
- all other database build-wiring assertions passed;
- combined CI lint, type-check, and build passed while the single new test failed.

Implementation commit `7557162b1730491479ecba3499e590c9a6520376`:

- adds one exact `@/shared/db/runtime-connection` alias to `next.config.mjs`;
- resolves the target from `import.meta.url` to `src/shared/db/runtime-connection.cloudflare.ts`;
- preserves any existing aliases produced by wrappers such as `next-intl`;
- does not change schema, credentials, Hyperdrive configuration, public routes, or application feature behavior.

Verification on implementation head `7557162b1730491479ecba3499e590c9a6520376`:

- combined CI: green;
- standalone tests: green, including the formerly red Next/Vinext alias regression;
- lint: green;
- type-check: green;
- build: green;
- Cloudflare/Vinext smoke: green;
- PR validation and MegaLinter were still running when this handoff update was written.

Fresh verification is required again on the final PR head containing this handoff update before merge.

## Production safety

- The currently reachable public site remains untouched while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the runtime blocker remains unresolved.
- `/api/runtime-db-diagnostic` is CI-only and is not a permanent application endpoint.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, raw binding values, or database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require fresh tests, lint, type-check, build, Cloudflare/Vinext smoke, PR validation, MegaLinter, and other required checks to pass on the final PR #49 head containing this handoff update.
2. Merge PR #49 only with an exact-head guard after green verification.
3. Run/read the production deep diagnostic on the resulting exact `main` SHA.
4. Interpret the stage chain without guessing:
   - if `explicit-cloudflare-resolver` passes but aliased `runtime-resolver` still fails, inspect Vinext beta.9's emitted module graph/capture path rather than Hyperdrive or the adapter;
   - if both resolver stages pass, continue to `request-database` and `singleton-database` and stop at the first failing wrapper;
   - if all database stages pass, isolate any remaining `/api/health`, public-page, Public Assistant, or dynamic-route runtime failure separately.
5. Re-check `/api/health`, `/`, `/platform`, and `/api/public/assistant` after the database stage chain is healthy.
6. When dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
7. Cut over `mkety.com` / `www.mkety.com` only after the full gate is green and required authorization conditions are satisfied.
8. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
9. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
