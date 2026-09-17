# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover/runtime repair  
**Status:** IN PROGRESS  
**Branch:** `diagnose/runtime-adapter-identity-v2`  
**Pull request:** #53

## Requested outcome

Finish the `mkety.com` public site and production cutover safely, then move directly into authenticated `app.mkety.com` development using the existing roadmap and completed foundations.

```text
finish public site
→ verify production runtime
→ cut over mkety.com
→ resume app.mkety.com development
```

## Latest production evidence

PR #51 merged to `main` as `0268c4c488d66c4cd30cc4b7947644ce98b9eee3`.

Production deep diagnostic run `35288341373` on that exact SHA confirmed:

- apex/www Worker routes remain intentionally unbound;
- production Hyperdrive resolves;
- direct route-free Hyperdrive `SELECT 1` passes;
- the Mkety Vinext Worker builds and deploys with production `MKETY_DB`;
- `cloudflare-binding` passes;
- `explicit-cloudflare-resolver` passes;
- normal `runtime-resolver` still fails with a sanitized generic `Error`;
- `/api/health`, `/`, and `/platform` remain HTTP 500;
- Public Assistant remains fail-closed at HTTP 503.

Therefore PR #51's absolute emitted-path rewrite did not change the production resolver boundary.

## Current diagnostic: PR #53

PR #53 is a conflict-free rebuild of the adapter-identity discriminator on top of PR #51's merged `main`.

It adds a safe literal identity to both runtime adapters:

- Node adapter: `runtimeConnectionAdapterKind = 'node'`;
- Cloudflare adapter: `runtimeConnectionAdapterKind = 'cloudflare'`.

The temporary CI-only production route imports that constant through the same `@/shared/db/runtime-connection` module used by application database consumers and reports only the adapter kind before invoking the resolver.

### TDD evidence

Test-only commit `713488981b39f226b95260b37a8991944fc47645` required:

- `runtime-adapter-identity`;
- `aliasedRuntimeConnectionAdapterKind`.

Valid red on current `main`:

- the new assertion failed specifically because `runtime-adapter-identity` was absent;
- the other 723 tests passed;
- lint, type-check, and build passed.

Implementation commits:

- `dcc5705ba5480816b15a19f9399e2702a9cdcaa0`: Node adapter identity;
- `2ebd548a22475aaa7643c0af6ed34efc491bf85e`: Cloudflare adapter identity;
- `168dc0f1a9b68388d0cb7ba02bd221b300875790`: CI-only identity stage in the production diagnostic.

No credentials, connection strings, raw bindings, secrets, tokens, or database data are exposed.

## Production safety

- Do not bind `mkety.com/*` or `www.mkety.com/*` until the complete public release gate is green.
- `/api/runtime-db-diagnostic` remains CI-only.
- Temporary diagnostic Workers remain route-free and are cleaned up after runs.
- Diagnostic output must stay sanitized.
- No production cutover is claimed yet.

## Exact next steps

1. Require the full final-head gate on PR #53.
2. Merge #53 only with an exact-head guard.
3. Read the production deep diagnostic on the resulting exact `main` SHA.
4. Use `runtime-adapter-identity` as the decision boundary:
   - `node`: stop alias experiments and explicitly wire Cloudflare server consumers to the Cloudflare resolver while preserving Node/Coolify imports for scripts and migrations;
   - `cloudflare`: module identity is correct, so inspect the emitted Cloudflare adapter execution/binding access.
5. Once `runtime-resolver` passes, continue through `request-database` and `singleton-database`.
6. When the DB chain is healthy, verify `/api/health`, `/`, `/platform`, Public Assistant, auth entry points, and Enterprise checkout/payment entry points.
7. Cut over `mkety.com` / `www.mkety.com` only after the full public gate is green.
8. Record immutable cutover evidence here and in `MKETY_DEVELOPMENT_CONTINUATION.md`.
9. Move immediately to app work: reconcile PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.
