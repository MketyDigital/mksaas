# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `diagnose/runtime-adapter-identity`  
**Pull request:** #52

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
- PR #49 added the exact Cloudflare resolver alias through wrapped Next config; production still executed the failing aliased resolver.
- PR #50 added an `enforce: 'pre'` Vite `resolveId` interceptor for exactly `@/shared/db/runtime-connection`; all CI gates passed, but production still failed at the aliased resolver.

## Latest production evidence

PR #50 merged to `main` as `367f7364648c2f22ef18dab8585e98e0153aee2e`.

Production deep diagnostic run `35287557537` on that exact SHA established:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved correctly;
- direct route-free Hyperdrive `SELECT 1` succeeded;
- the Mkety Vinext Worker built and deployed with the production `MKETY_DB` binding;
- `cloudflare-binding` succeeded and confirmed the binding plus connection string are present;
- `explicit-cloudflare-resolver` succeeded;
- the normal aliased `runtime-resolver` still failed with a sanitized generic `Error`;
- `/api/health`, `/`, and `/platform` remained 500;
- Public Assistant remained its handled 503;
- therefore Hyperdrive, network/query connectivity, binding visibility, connection-string availability, and the Cloudflare adapter implementation remain proven healthy;
- Vite alias ordering, Next-config alias capture, and an enforce-pre exact `resolveId` hook have each passed local/build regressions but have not changed the emitted production resolver behavior.

Public cutover remains blocked. Do not bind `mkety.com/*` or `www.mkety.com/*` until the full release gate is green.

## Current diagnostic: PR #52

PR #52 identifies which runtime adapter Vinext actually emitted through the normal alias, without exposing secrets or connection strings.

It adds a safe constant to both adapters:

- Node adapter: `runtimeConnectionAdapterKind = 'node'`;
- Cloudflare adapter: `runtimeConnectionAdapterKind = 'cloudflare'`.

The temporary CI-only production route imports that constant through the same `@/shared/db/runtime-connection` path used by application database consumers and reports only the adapter kind before invoking the resolver.

### TDD evidence

Test-only commit `905d1b844b44fe2b046561afcfc8ccd31a18205f` required:

- a `runtime-adapter-identity` diagnostic stage;
- the aliased import name `aliasedRuntimeConnectionAdapterKind`.

Valid red phase:

- the new assertion failed because `runtime-adapter-identity` was absent;
- the other 722 tests passed;
- build and type-check passed.

Implementation history:

- `f642e60ce085697eb4a6cbf70500a99d5689bdf0`: added the Node adapter identity export;
- `683c817e604802cb4e9bccb5f933cedde9a13700`: added the Cloudflare adapter identity export;
- `c00dbc7f3aebf842cd917951f78867c0416634c9`: attempted workflow wiring but contained literal escaped newline text, so the regression correctly remained red; this result was not treated as implementation success;
- `80508c84a536ce4a4638b4097b0de26493cf4e00`: corrected the workflow wiring and added the identity stage before `runtime-resolver`.

Verification on corrected implementation head `80508c84a536ce4a4638b4097b0de26493cf4e00` so far:

- combined CI test: green;
- combined CI lint: green;
- combined CI type-check: green;
- combined CI build: green;
- Cloudflare/Vinext smoke: green;
- standalone test with coverage was still running when this handoff update was written;
- remaining PR validation/MegaLinter must also complete before merge.

Fresh verification is required again on the final PR head containing this handoff update before merge.

## Production safety

- The currently reachable public site remains untouched while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while any public runtime blocker remains.
- `/api/runtime-db-diagnostic` is CI-only and is not a permanent product endpoint.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, raw binding values, or database data.
- No production cutover is claimed until the complete public gate is green.

## Exact next steps

1. Require the full exact-head gate on PR #52 after this handoff update.
2. Merge PR #52 only with an exact-head guard.
3. Read the production deep diagnostic on the resulting exact `main` SHA.
4. Use `runtime-adapter-identity` as the decision boundary:
   - if `adapterKind: 'node'`, stop working on alias precedence and replace the fragile build-time split with explicit source wiring that preserves Node scripts and Cloudflare runtime separately;
   - if `adapterKind: 'cloudflare'` but the resolver still fails, inspect the emitted Cloudflare adapter execution path itself because module identity is no longer the issue.
5. Once `runtime-resolver` passes, continue through `request-database` and `singleton-database`, stopping at the first failing stage.
6. When all database stages pass, repair any remaining `/api/health`, public page, Public Assistant, auth, or payment failures independently.
7. Run the complete public release gate across required public pages, auth entry points, Public AI, and Enterprise checkout/payment entry points.
8. Cut over `mkety.com` / `www.mkety.com` only after the complete gate is green.
9. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
10. Move immediately to app work: reconcile stale PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.
