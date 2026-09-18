# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `fix/cloudflare-db-source-split`  
**Pull request:** #55

## Requested outcome

Finish the `mkety.com` public site and production cutover safely, then move directly into authenticated `app.mkety.com` development using the existing roadmap and completed foundations.

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Production root cause now proven

PR #53 merged to `main` as `02b8348d1a5e39b8bf3e4b3ab28c0be1b84e6ed5`.

Production deep diagnostic run `35288947489` on that exact SHA established:

- apex/www Worker routes remained intentionally unbound;
- production Hyperdrive resolved;
- direct route-free Hyperdrive `SELECT 1` passed;
- the Mkety Vinext Worker built and deployed with production `MKETY_DB`;
- `cloudflare-binding` passed;
- `explicit-cloudflare-resolver` passed;
- `runtime-adapter-identity` reported **`adapterKind: "node"`** for the normal `@/shared/db/runtime-connection` import;
- the aliased `runtime-resolver` then failed with a sanitized generic `Error`;
- `/api/health`, `/`, and `/platform` remained HTTP 500;
- Public Assistant remained fail-closed at HTTP 503.

This ends alias-precedence experimentation. The deployed Vinext module graph is proven to select the Node adapter through the generic resolver path even after the prior Vite/Next/absolute-path alias repairs.

## Current repair: PR #55

PR #55 replaces the fragile runtime alias dependency with an explicit source boundary.

### Runtime split

Node/tooling side:

- generic `src/shared/db/index.ts` remains Node-safe and resolves through `DATABASE_URL`;
- `src/shared/db/node.ts` is the explicit Node singleton for CLI utilities;
- seed/content-smoke scripts use the Node entry;
- Node migrations/seeding must never load `cloudflare:workers`.

Cloudflare Worker side:

- `src/shared/db/cloudflare.ts` is the Hyperdrive-backed singleton;
- shared request-scoped DB uses `runtime-connection.cloudflare` directly;
- Public Assistant request DB uses `runtime-connection.cloudflare` directly;
- high-impact Worker/public entry points now use `db/cloudflare`, including health, proxy/custom-domain routing, auth repository/permissions/tenant reads, public CMS loaders, app-experience loaders, and Enterprise order persistence;
- the production diagnostic now tests the explicit Cloudflare resolver, request-scoped DB, and Cloudflare singleton directly instead of re-testing the already-proven broken alias.

### TDD evidence

Test-only commit `6caf83a2bdac67c4302547f8091929c264e294e2` required Worker DB gateways to use the explicit Cloudflare adapter.

Valid red phase:

- `src/shared/db/vite-runtime-alias.test.ts` failed specifically because `src/shared/db/index.ts` still imported `@/shared/db/runtime-connection`;
- the other 723 tests passed;
- lint, type-check, and build passed.

The implementation then exposed an important Node-tooling regression: making the generic singleton Cloudflare-specific caused the content DB workflow to fail with `ERR_UNSUPPORTED_ESM_URL_SCHEME` for `cloudflare:`.

That finding changed the source split to the current correct architecture:

- generic DB remains Node-safe;
- Worker consumers opt into `db/cloudflare` or the Cloudflare request resolver explicitly;
- the Node content smoke was rewritten to validate the seeded production contract directly through `db/node` instead of importing Worker-only loaders.

### Current verification

Current code head: `3d6ef9b35f64233d571ea50ddeb6ace71808ec7d`.

Green on that head so far:

- standalone lint;
- standalone type-check;
- standalone build;
- Cloudflare/Vinext build and deployment-packaging smoke;
- Mkety Content DB Smoke: migrations, CMS migrations, seeding, and Node-native content contract smoke all green;
- PR validation.

Still required before merge:

- standalone tests/coverage;
- combined CI completion;
- MegaLinter;
- any remaining required checks.

## Production safety

- `mkety.com/*` and `www.mkety.com/*` remain intentionally unbound.
- Do not cut over while any runtime or release-gate blocker remains.
- `/api/runtime-db-diagnostic` is CI-only.
- Temporary diagnostic Workers remain route-free and are cleaned up after runs.
- Diagnostic output must remain sanitized.
- No production cutover is claimed yet.

## Exact next steps

1. Require the remaining PR #55 gates to pass on the current code head.
2. Verify the final PR head differs only by this handoff if no code changes follow; otherwise rerun the full affected gate.
3. Merge PR #55 only with an exact-head guard.
4. Read the production deep diagnostic on the exact merge SHA.
5. Require the DB stage ladder to pass:
   - `cloudflare-binding`;
   - `explicit-cloudflare-resolver`;
   - `request-database`;
   - `singleton-database`.
6. If the DB chain passes, verify `/api/health`, `/`, `/platform`, Public Assistant, login/auth entry points, and Enterprise checkout/payment entry points.
7. Run the complete public release/cutover gate across the required public routes and transactional entry points.
8. Bind `mkety.com/*` and `www.mkety.com/*` only after the complete gate is green.
9. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
10. Move immediately to app work: reconcile stale PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy PR must update this status and its feature handoff with: requested outcome, prior state, changes made, verification evidence, production/environment changes, blockers/risks, and exact next steps. No feature may be marked complete, verified, production, or merge-ready without that update.
