# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/vinext-runtime-db-transform`  
**Pull request:** #54

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
- PR #51 redirected the exact absolute Node resolver path during Vite resolution; production still executed the Node resolver.

## Latest production evidence

PR #51 merged to `main` as `0268c4c488d66c4cd30cc4b7947644ce98b9eee3`.

Production deep diagnostic run: `35288341373`.

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

The exact-alias and exact-absolute-path resolution approaches therefore had no production effect. Do not add another alias/resolveId variant.

## Current repair: PR #54

PR #54 moves from pre-resolution routing to post-selection transformation. If Vinext selects `src/shared/db/runtime-connection.ts` anyway, the Vite Worker build transforms that selected module so it re-exports the Cloudflare resolver. Plain Node scripts continue to execute the unmodified Node resolver because they do not run through Vite.

### TDD evidence

Test-only commit `de97c20e6656ffb486b18b02753bcdce68bbf868` added a regression that invokes the actual Mkety Vite plugin transform hook with the selected Node resolver module.

Valid red phase:

- expected transformed source to contain `runtime-connection.cloudflare`;
- received empty transform output;
- the new test failed;
- the other 724 tests passed;
- build, lint, and type-check passed.

Implementation commit `158a1c51b921d1c8252e2be1396bcd8d4e891359`:

- adds a Vite `transform` hook for exactly `src/shared/db/runtime-connection.ts`;
- strips query/hash suffixes before comparing module ids;
- transforms only that selected Worker-build module;
- re-exports `getRuntimeDatabaseConnectionString` from `./runtime-connection.cloudflare`;
- leaves the source Node resolver file unchanged for migrations, seeds, smoke tooling, and other plain Node execution;
- does not change schema, credentials, bindings, domain routes, or product behavior.

Verification on implementation head `158a1c51b921d1c8252e2be1396bcd8d4e891359`:

- combined CI: green, including the formerly red transform regression;
- standalone tests: green;
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

1. Require the full final-head gate on PR #54: tests, lint, type-check, build, Cloudflare/Vinext smoke, PR validation, MegaLinter, and required checks.
2. Merge #54 only with an exact-head guard.
3. Read the production deep diagnostic on the resulting exact `main` SHA.
4. Stop at the first failing stage:
   - if `runtime-resolver` passes, continue through `request-database` and `singleton-database`;
   - if it still fails, instrument/inspect Vinext's generated bundle and child-environment plugin graph; do not add another alias variant;
   - if all DB stages pass, isolate remaining health/public-page/Public Assistant/auth/payment failures separately.
5. Run the complete public release/cutover gate across public pages, auth entry points, Public AI, and Enterprise checkout/payment entry points.
6. Cut over `mkety.com` / `www.mkety.com` only after that full gate is green.
7. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
8. Move immediately to app work: reconcile PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.
