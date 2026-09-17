# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/vinext-runtime-db-resolveid`  
**Pull request:** #50

## Requested outcome

Finish the `mkety.com` public site and production cutover safely, then move directly into authenticated `app.mkety.com` development using the existing roadmap and completed foundations.

Milestone sequence:

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Completed cutover-repair work

- PR #41 hardened production diagnostics and introduced the mandatory feature-agent handoff protocol.
- PR #42 added the CI-only in-bundle runtime database diagnostic.
- PR #43 corrected the diagnostic route to the routable CI-only `/api/runtime-db-diagnostic` endpoint.
- PR #44 made direct-Hyperdrive readiness structural rather than status-code-only.
- PR #45 added `global_fetch_strictly_public` after Cloudflare 1042 responses appeared on dynamic Vinext requests.
- PR #46 added the safe `cloudflare-binding` stage.
- PR #47 proved Vinext's generic `@` alias preceded the exact runtime DB alias in resolved Vite config, then prioritized the exact alias.
- PR #48 proved in production that the explicit Cloudflare resolver succeeds while the normal `@/shared/db/runtime-connection` import fails in the same request.
- PR #49 added the exact Cloudflare resolver alias through wrapped Next config. Production still executed the wrong runtime resolver, proving Next-config alias capture alone is insufficient for Vinext's emitted graph.

## Latest production evidence

PR #49 merged to `main` as `a3c3ace2b7db166b2fd4a294a11fff8410639c7e`.

The post-merge production deep diagnostic established:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved correctly;
- the route-free Hyperdrive probe executed `SELECT 1` successfully;
- the Mkety Vinext Worker built and deployed with the production `MKETY_DB` binding;
- `cloudflare-binding` succeeded and reported the binding plus connection string as present;
- `explicit-cloudflare-resolver` succeeded;
- the normal aliased `runtime-resolver` still failed immediately afterward;
- therefore Hyperdrive, binding visibility, connection-string availability, direct SQL, and the Cloudflare resolver implementation are healthy;
- the remaining blocker is Vinext/Vite module resolution for `@/shared/db/runtime-connection` inside the emitted application graph.

Public cutover remains blocked. Do not bind `mkety.com/*` or `www.mkety.com/*` until the full public release gate is green.

## Current repair: PR #50

PR #50 moves the exact runtime DB mapping into the Vite plugin resolution phase Vinext actually executes.

### TDD evidence

Test-only commit `28eaea54aaf3787aca84fd37efe14a4614b5b5aa` added a regression requiring the Mkety runtime-connection plugin to:

- run with `enforce: 'pre'`;
- expose a `resolveId` hook;
- resolve exactly `@/shared/db/runtime-connection` to `src/shared/db/runtime-connection.cloudflare.ts`.

Valid red phase on CI:

- expected plugin enforce value: `pre`;
- received: `null`;
- the new runtime-resolution regression failed;
- the other 722 tests passed;
- lint, type-check, and build passed.

Implementation commit `f886747f72a910950754581a8c6b5de9c78103b8`:

- marks the Mkety runtime resolver plugin `enforce: 'pre'`;
- adds a narrow `resolveId(source)` interceptor;
- intercepts only the exact `@/shared/db/runtime-connection` id;
- returns `runtime-connection.cloudflare.ts` before Vinext/generic TypeScript aliases can claim it;
- leaves all other module resolution unchanged;
- retains the existing resolved-alias ordering as a secondary safeguard.

Verification on implementation head `f886747f72a910950754581a8c6b5de9c78103b8`:

- combined CI: green;
- standalone tests: green, including the formerly red pre-resolution regression;
- lint: green;
- type-check: green;
- build: green;
- Cloudflare/Vinext smoke: green;
- PR validation: green;
- MegaLinter was still running when this handoff update was written.

Fresh verification is required again on the final PR head containing this handoff update before merge.

## Production safety

- The currently reachable public site remains untouched while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while any public runtime blocker remains.
- `/api/runtime-db-diagnostic` is CI-only and is not a permanent product endpoint.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, raw binding values, or database data.
- No production cutover is claimed until the complete public gate is green.

## Exact next steps

1. Require fresh tests, lint, type-check, build, Cloudflare/Vinext smoke, PR validation, MegaLinter, and required checks to pass on the final PR #50 head containing this handoff update.
2. Merge PR #50 only with an exact-head guard.
3. Read the production deep diagnostic on the resulting exact `main` SHA.
4. Stop at the first failing stage:
   - if `runtime-resolver` now passes, proceed through `request-database` and `singleton-database`;
   - if it still fails while the explicit resolver passes, inspect the emitted Vinext bundle/module graph rather than adding another alias;
   - if all DB stages pass, isolate any remaining `/api/health`, public page, Public Assistant, auth, or payment runtime failure separately.
5. Run the complete public release gate across required public pages, auth entry points, Public AI, and Enterprise checkout/payment entry points.
6. Cut over `mkety.com` / `www.mkety.com` only after the complete gate is green.
7. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
8. Move immediately to app work: reconcile stale PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.
