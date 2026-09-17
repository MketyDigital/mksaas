# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/vinext-runtime-db-absolute-rewrite`  
**Pull request:** #51

## Requested outcome

Finish the `mkety.com` public site and production cutover safely, then move directly into authenticated `app.mkety.com` development using the existing roadmap and completed foundations.

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Completed repair history

- PR #41 hardened production diagnostics and introduced the mandatory feature-agent handoff protocol.
- PR #42 added the CI-only in-bundle runtime DB diagnostic.
- PR #43 corrected the diagnostic route to `/api/runtime-db-diagnostic`.
- PR #44 made direct-Hyperdrive readiness structural.
- PR #45 added `global_fetch_strictly_public` after Cloudflare 1042 failures.
- PR #46 proved the production `MKETY_DB` binding and connection string are visible.
- PR #47 corrected exact Vite alias ordering ahead of Vinext's generic `@` alias.
- PR #48 proved the explicit Cloudflare resolver succeeds while the normal runtime import fails in the same deployed request.
- PR #49 added the exact resolver through wrapped Next config; production still executed the Node resolver.
- PR #50 added an `enforce: 'pre'` exact-id Vite `resolveId` interceptor; production still executed the Node resolver.

## Latest production evidence

PR #50 merged to `main` as `367f7364648c2f22ef18dab8585e98e0153aee2e`.

Production deep diagnostic run: `35287557537`.

Confirmed on that exact SHA:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved;
- direct route-free Hyperdrive `SELECT 1` passed;
- current Mkety Vinext Worker built and deployed successfully with production Hyperdrive;
- `cloudflare-binding` passed with the binding and connection string present;
- `explicit-cloudflare-resolver` passed;
- normal `runtime-resolver` still failed with a sanitized generic `Error`;
- `/api/runtime-db-diagnostic` returned 500;
- `/api/health`, `/`, and `/platform` returned 500;
- Public Assistant returned its handled 503;
- static `/robots.txt` and `/sitemap.xml` remained 200.

Therefore Hyperdrive, binding visibility, direct SQL, the Cloudflare resolver implementation, and Worker build/deploy are healthy. The blocker remains the emitted Vinext module path used by the normal runtime resolver import.

## Current repair: PR #51

The working hypothesis is now narrower: Vinext may rewrite `@/shared/db/runtime-connection` to the absolute Node resolver file before Mkety's exact alias-string interceptor sees it.

### TDD evidence

Test-only commit `131da54787bd84512eb368ee4a1d99dd4bbbda2b` added a regression that invokes the actual Mkety Vite plugin with the absolute path:

`src/shared/db/runtime-connection.ts`

Valid red phase:

- expected resolution: `src/shared/db/runtime-connection.cloudflare.ts`;
- received: empty string;
- the new test failed;
- the other 723 tests passed;
- build, lint, and type-check passed.

Implementation commit `b426ed3c85f5945a8b7c0899b156872277a8efde`:

- defines the exact absolute Node resolver path inside `vite.config.ts`;
- keeps the existing exact alias interceptor;
- additionally redirects that exact absolute Node resolver path to `runtime-connection.cloudflare.ts`;
- strips query/hash suffixes before comparing the absolute source path;
- changes only Vite/Cloudflare build-time resolution;
- does not alter Node migrations/scripts/tests, schema, credentials, bindings, domain routes, or product behavior.

Verification on implementation head `b426ed3c85f5945a8b7c0899b156872277a8efde`:

- combined CI: green;
- standalone tests: green, including the formerly red absolute-path regression;
- lint: green;
- type-check: green;
- build: green;
- Cloudflare/Vinext smoke: green;
- PR validation: green;
- MegaLinter was still running when this handoff update was written.

Fresh verification is required on the final PR head containing this handoff update before merge.

## Production safety

- Do not bind `mkety.com/*` or `www.mkety.com/*` until the complete public release gate is green.
- `/api/runtime-db-diagnostic` remains CI-only.
- Temporary diagnostic Workers remain route-free and are cleaned up after runs.
- Diagnostic output must stay sanitized; never expose connection strings, credentials, secrets, tokens, raw bindings, or database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require the full final-head gate on PR #51: tests, lint, type-check, build, Cloudflare/Vinext smoke, PR validation, MegaLinter, and required checks.
2. Merge #51 only with an exact-head guard.
3. Read the production deep diagnostic on the resulting exact `main` SHA.
4. Stop at the first failing stage:
   - if `runtime-resolver` passes, continue through `request-database` and `singleton-database`;
   - if it still fails, inspect/instrument the emitted Vinext module graph rather than adding further aliases;
   - if all DB stages pass, isolate remaining health/public-page/Public Assistant/auth/payment failures separately.
5. Run the complete public release/cutover gate across public pages, auth entry points, Public AI, and Enterprise checkout/payment entry points.
6. Cut over `mkety.com` / `www.mkety.com` only after that full gate is green.
7. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
8. Move immediately to app work: reconcile PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.
