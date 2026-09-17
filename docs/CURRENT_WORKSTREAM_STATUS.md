# Mkety Current Workstream Status

**Updated:** 2026-09-17  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/public-cutover-runtime-and-handoff`  
**Pull request:** #41

## Requested outcome

Finish the `mkety.com` public-site production cutover safely, then resume authenticated `app.mkety.com` development from the existing roadmap rather than rebuilding completed work.

## Already present

The public Mkety site and substantial Platform foundations already exist in `mksaas`, including the public assistant, authentication/workspace infrastructure, enterprise checkout/payment routes, AI/agent foundations, automation/workflow foundations, deployment-related surfaces, tenant/admin routes, and Cloudflare/Vinext deployment infrastructure.

The intended milestone sequence remains:

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Current blocker

The production Public Assistant endpoint has returned HTTP 503 with the generic temporary-unavailable response. Earlier production diagnostics were not reliable evidence because the direct Hyperdrive probe returned HTTP 404 without failing the workflow, and an older diagnostic tested a pinned stale application SHA rather than the current commit.

Root cause is not yet proven. Do not guess at Hyperdrive, postgres options, migrations, RLS, or application queries until the hardened diagnostic produces evidence.

## Changes in PR #41

- Added a tested fail-closed HTTP probe evaluator.
- Hardened the Public Assistant production debug workflow so non-200 health fails the workflow after sanitized evidence is printed.
- Reworked the deep Hyperdrive diagnostic to test the current triggering commit instead of a stale pinned SHA.
- Aligned the direct Hyperdrive postgres client options with `withPublicAIRequestDatabase`: `{ max: 1 }`.
- Removed diagnostic-only postgres behavior such as `prepare: false` that did not match the application path.
- Made the direct `SELECT 1` result a hard gate.
- Made the deployed route-free application's `/api/public/assistant` response a hard gate.
- Preserved the pre-cutover domain-route guard and cleanup of temporary diagnostic Workers.
- Added the mandatory feature-agent handoff protocol.

## Verification so far

The first test-only commit intentionally referenced a missing diagnostic helper. GitHub CI then failed on lint/type-check while build remained green, establishing the red phase for the new contract. Jest did not catch the missing module in that isolated commit, so lint/type-check provided the concrete failing signal.

Implementation and workflow hardening are now on the branch. Fresh CI must be green before merge.

## Production state

- Legacy public site must remain live until the replacement passes the release gate.
- Do not bind `mkety.com/*` or `www.mkety.com/*` to the new Worker while the Public Assistant/runtime blocker remains unresolved.
- No production cutover is claimed yet.

## Exact next steps

1. Run and inspect PR #41 CI: lint, type-check, tests, and build must pass.
2. Fix any branch-level regression without changing production behavior unnecessarily.
3. Merge the hardened diagnostic only after verification.
4. Run the hardened production diagnostic on `main` and capture the sanitized direct-DB and actual-app results.
5. Identify the proven failing boundary: Hyperdrive connectivity, postgres/runtime integration, schema/migration state, or Public Assistant application query/runtime.
6. Fix the proven root cause test-first and re-run production verification.
7. Run the public release/cutover gate across the required public routes, Auth entry points, Public AI, and Enterprise checkout/payment entry points.
8. Cut over `mkety.com` / `www.mkety.com` only after the gate is green.
9. Update `MKETY_DEVELOPMENT_CONTINUATION.md` and this file to record the production cutover.
10. Resume app-side work by reconciling stale PR #35, then Entitlements #22, then Usage/Credits #23, followed by the remaining Platform roadmap.
