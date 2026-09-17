# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/cloudflare-same-zone-fetch`  
**Pull request:** #45

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
- The repository has a mandatory feature-agent handoff protocol and this canonical current-workstream file. Material work is not considered complete without current status, verification, blockers, and exact next steps.

## Proven production state

Production deep-diagnostic run `35276918465` tested `main` SHA `14ab59325cd39432c543e63a1a770be74271ef45` and established that:

- the apex/www Worker route safety guard passes; the replacement remains intentionally unbound from `mkety.com/*` and `www.mkety.com/*`;
- production Hyperdrive `mkety-production-db` resolves correctly;
- the direct route-free probe reached its structured handler response and successfully executed `SELECT 1` using the same Public Assistant postgres shape, `postgres(connectionString, { max: 1 })`;
- the freshly built Mkety Vinext Worker serves static metadata routes such as `/robots.txt` and `/sitemap.xml`;
- dynamic request paths produced Cloudflare runtime failures, including Cloudflare error code **1042** on `/api/health` and `/`;
- `/api/runtime-db-diagnostic` returned HTTP 500 before it could provide structured stage evidence;
- `/platform` returned HTTP 500;
- `/api/public/assistant` continued to return its handled HTTP 503 temporary-unavailable response.

This means Hyperdrive connectivity itself is no longer the leading blocker. The failure is in the Cloudflare/Vinext dynamic runtime path, and the public cutover remains blocked.

## Latest root-cause evidence

Cloudflare documents error code **1042** as a Worker attempting to fetch another Worker on the same zone without the `global_fetch_strictly_public` compatibility flag.

The Mkety `wrangler.jsonc` used by Vinext had only:

```json
"compatibility_flags": ["nodejs_compat"]
```

and the repository contained no `global_fetch_strictly_public` setting.

This directly matches the observed Cloudflare error and is now the bounded runtime repair being tested. It is not considered fixed until the updated configuration passes repository verification and the production diagnostic proves that error 1042 has disappeared.

## Current repair: PR #45

PR #45 adds the Cloudflare compatibility flag required for same-zone public Worker fetches while preserving `nodejs_compat`:

```json
"compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"]
```

### TDD evidence

The regression was added first in `src/shared/db/vite-runtime-alias.test.ts` and requires the Wrangler configuration to contain both compatibility flags.

On red-phase commit `2b27114bfcc7da93eddfae4544ae137797488aef`:

- the collected **Test** job failed;
- **Lint** passed;
- **Type-check** passed;
- the intended failure was the missing `global_fetch_strictly_public` compatibility flag.

The implementation then changes only the compatibility flag configuration before fresh green verification.

## Secondary diagnostic observation

The production deep diagnostic currently runs `wrangler secret put` after deploying the temporary application Worker. Wrangler secret updates create/deploy a new Worker version, so the diagnostic can experience additional propagation churn after the initial code deployment. This is separate from Cloudflare 1042 and should be cleaned up only if it remains relevant after the 1042 repair is verified.

## Production safety

- The legacy/publicly reachable site remains in place while replacement verification is incomplete.
- Do not bind `mkety.com/*` or `www.mkety.com/*` while the runtime blocker remains unresolved.
- Diagnostic routes are created only in the CI runner before build; no permanent diagnostic product endpoint is added.
- Temporary diagnostic Workers remain route-free and cleanup is attempted on every workflow outcome.
- Diagnostic output must remain sanitized; never log connection strings, credentials, secrets, tokens, or raw sensitive database data.
- No production cutover is claimed yet.

## Exact next steps

1. Require fresh PR #45 tests, lint, type-check, build, and Cloudflare/Vinext smoke to pass on the implementation head.
2. Merge PR #45 only after that fresh green evidence.
3. Re-run the deep production diagnostic on the resulting `main` SHA.
4. Confirm Cloudflare error 1042 is eliminated and the direct Hyperdrive probe remains healthy.
5. Inspect `/api/runtime-db-diagnostic` and branch on its first structured failing stage:
   - `runtime-resolver` fails → fix Cloudflare/Vinext binding resolution or generated-config preservation;
   - `request-database` fails → fix request-scoped postgres/Drizzle integration;
   - `singleton-database` fails → fix singleton initialization/runtime lifecycle;
   - all three pass → continue upward into the shared dynamic runtime, health-route post-DB behavior, schema/query logic, and Public Assistant persistence/provider logic.
6. If 1042 persists after the source Wrangler flag is present, verify whether Vinext's generated Worker config dropped that compatibility flag and fix the generation/deployment path test-first.
7. Implement any remaining proven product-runtime fix test-first and re-run production diagnostics.
8. Once dynamic routes and Public Assistant are healthy, run the complete public release/cutover gate across required public pages, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
9. Cut over `mkety.com` / `www.mkety.com` only after the full gate is green and required authorization conditions are satisfied.
10. Record immutable cutover evidence in this file and `MKETY_DEVELOPMENT_CONTINUATION.md`.
11. Resume app-side development by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
