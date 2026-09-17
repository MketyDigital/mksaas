# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/vinext-runtime-connection-alias`  
**Pull request:** #47

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
- PR #45 added `global_fetch_strictly_public` alongside `nodejs_compat` after production emitted Cloudflare error 1042 on dynamic Vinext requests.
- PR #46 added a safe `cloudflare-binding` stage before resolver execution so the deployed Vinext app could distinguish binding absence from resolver failure.
- The repository has a mandatory feature-agent handoff protocol and this canonical current-workstream file. Material work is not considered complete without current status, verification, blockers, and exact next steps.

## Latest production evidence

Production deep-diagnostic run `35280794170` tested merged `main` SHA `73828706f1108343e0a687e21bdc2cc73facc724` after PR #46.

It established:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved correctly;
- the direct route-free Hyperdrive probe executed `SELECT 1` successfully again;
- the temporary current-SHA Mkety Vinext Worker built and deployed successfully;
- inside that Vinext Worker, `cloudflare-binding` reported the `MKETY_DB` binding present and its `connectionString` present;
- the immediately following `runtime-resolver` stage still failed;
- therefore Cloudflare binding propagation, Hyperdrive availability, the Hyperdrive connection string, and raw postgres connectivity are all proven healthy;
- the failure boundary is the imported runtime resolver/module-resolution path inside the Vinext application bundle, before the request-scoped or singleton database wrappers run;
- public cutover remains blocked and `mkety.com/*` / `www.mkety.com/*` must remain unbound to the replacement Worker.

## Root-cause proof: PR #47

The Cloudflare resolver source itself already imports `env` from `cloudflare:workers` and would use `MKETY_DB.connectionString`, matching the direct binding diagnostic that succeeds in production. The non-Cloudflare/default resolver reads `DATABASE_URL`, which is absent in the production Worker and matches the observed resolver failure.

PR #47 therefore tests the actual resolved Vite/Vinext alias order rather than merely checking configuration source text.

### TDD evidence

Early test-harness attempts failed for ESM/eval reasons and were not treated as product red evidence.

The corrected behavioral regression on commit `37004c36033710930a9e71fc1898312402fdfb12` reached Vite's real resolved configuration and failed with:

```text
Expected: .../src/shared/db/runtime-connection.cloudflare.ts
Received: /src
```

That is the decisive red phase: the first alias matching `@/shared/db/runtime-connection` is Vinext's generic `@` → `/src` mapping, so the specific Cloudflare resolver alias is bypassed. On the same head, lint and type-check passed; the failure was isolated to the new alias-precedence regression.

Implementation commit `4448f2c3b9fe11446d04186071a0ca764596b35b` keeps the existing exact runtime alias but adds a small Vite `configResolved` plugin that moves that exact alias to the front of the final resolved alias array after Vinext has materialized its generic TypeScript path aliases. This preserves ordinary `@/*` behavior while ensuring the runtime database resolver maps to `runtime-connection.cloudflare.ts` in the Cloudflare/Vinext build.

Fresh green verification is required on the exact implementation head before merge.

## Production safety

- The currently reachable public site remains untouched while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the runtime blocker remains unresolved.
- `/api/runtime-db-diagnostic` is created only inside the GitHub Actions runner before the temporary Vinext build; it is not a permanent product route.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, raw binding values, or database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require fresh tests, lint, type-check, build, Cloudflare/Vinext smoke, PR validation, and other required checks to pass on the final PR #47 head.
2. Confirm the resolved-alias regression is green and the first matching alias is the Cloudflare resolver.
3. Merge PR #47 only with an exact-head guard after green verification.
4. Run the production deep diagnostic on the resulting `main` SHA.
5. Read the stage chain in order:
   - `cloudflare-binding` must remain green;
   - `runtime-resolver` should now pass if alias precedence was the production root cause;
   - then inspect `request-database` and `singleton-database` and stop at the first failing stage, if any.
6. If the database stage chain passes, re-check `/api/health`, `/`, `/platform`, and `/api/public/assistant`; isolate any remaining failure one layer at a time instead of assuming all dynamic failures shared one cause.
7. When dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
8. Cut over `mkety.com` / `www.mkety.com` only after the full gate is green and required authorization conditions are satisfied.
9. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
10. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
