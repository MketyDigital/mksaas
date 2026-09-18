# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/release certification  
**Status:** IN PROGRESS  
**Branch:** `fix/public-route-cloudflare-db`  
**Pull request:** #58

## Requested outcome

Finish the `mkety.com` public site and production cutover safely, then move directly into authenticated `app.mkety.com` development.

```text
finish public site
→ verify production runtime
→ certify release candidate
→ cut over mkety.com
→ resume app.mkety.com development
```

## Latest production evidence

PR #56 merged to `main` as `351dc78cbbd4502f5a689390d2d97ea8a201874a`.

Production deep diagnostic run `35292525269`, job `105438223147`, on that exact SHA completed successfully and established:

- `mkety.com/*` and `www.mkety.com/*` remain intentionally unbound;
- direct Hyperdrive `SELECT 1` is healthy;
- `cloudflare-binding` passed;
- `explicit-cloudflare-resolver` passed;
- `request-database` passed;
- `singleton-database` passed;
- `/api/runtime-db-diagnostic` returned HTTP 200;
- `/api/health` returned HTTP 200 with a healthy database check;
- `/` returned HTTP 200;
- `/api/public/assistant` returned HTTP 200;
- `/platform` exceeded the diagnostic's 25-second request timeout and reported HTTP 000.

The database/runtime blocker is therefore closed. The remaining public release blocker is route latency caused by two public loaders still using the generic Node-safe database entry inside the Cloudflare Worker.

## Current repair: PR #58

PR #58 switches only these two public runtime loaders to the explicit Cloudflare database singleton:

- `src/features/platform-content/server/public-chrome.ts`;
- `src/features/platform-content/server/public-page-query.ts`.

Both modules previously imported `@/shared/db`, which is intentionally Node-safe for CLI tools. Their database failures are fallback-safe, but in the Worker they can spend most or all of the request timeout attempting the wrong connection before falling back.

### TDD evidence

Test-only commit `170be907a4ef4802f091a37a1d0e2c0097ccc2ff` required both loaders to import `@/shared/db/cloudflare`.

Valid red:

- the new regression failed because `public-chrome.ts` still imported `@/shared/db`;
- the other 726 tests passed;
- build, lint, and type-check passed.

Implementation:

- `323303ffd15d0b329b1c6c59c58339eb37a27c9c`: public chrome uses the Cloudflare DB;
- `e04b71ff465d2ab194db558d0ac045c1756b28b8`: public page metadata uses the Cloudflare DB.

### Verification on implementation head `e04b71ff465d2ab194db558d0ac045c1756b28b8`

Green:

- combined CI;
- standalone tests;
- standalone build;
- standalone type-check;
- standalone lint;
- Cloudflare/Vinext smoke;
- PR validation;
- MegaLinter.

The first Mkety Content DB Smoke attempt failed during seeding on a duplicate unique key while overlapping database workflows were active. No PR #58 code touches the seeder. Re-running only the failed job after concurrent activity settled completed successfully through migrations, seed, and content smoke, confirming a staging concurrency race rather than a reproducible code defect.

## Production safety

- Apex/www remain unbound.
- Do not cut over until the complete public candidate/release gate is green.
- The manual production cutover workflow remains the only authorized route mutation path.
- No secrets, database URLs, raw bindings, or customer data may be logged.

## Exact next steps

1. Merge PR #58 with the exact documented head.
2. Run the production deep diagnostic on the exact merge SHA and require `/platform` plus the other public probes to complete successfully.
3. Repair the release-certification workflow guards that still reference closed PR #24 so a new PR from `feat/mkety-public-site-production` can run candidate, Public AI runtime, and production preflight gates.
4. Fast-forward the release branch to the verified public-site SHA and create a release-certification PR if needed to generate exact-SHA gate evidence.
5. Require all cutover workflow prerequisites green on the same exact release SHA: tests, type-check, lint, build, CI, Vinext smoke, content DB smoke, Public AI runtime diagnostic, production routing preflight, and isolated public candidate.
6. Execute the reviewed manual production cutover workflow only with the exact verified SHA and required confirmation.
7. Verify `mkety.com`, canonical `www → apex`, Public AI, auth entry points, and Enterprise payment safety after cutover.
8. Record immutable cutover evidence here.
9. Move immediately to app work: reconcile stale draft PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy PR must update this status and its feature handoff with requested outcome, prior state, changes, verification evidence, environment/runtime changes, blockers/risks, and exact next steps.
