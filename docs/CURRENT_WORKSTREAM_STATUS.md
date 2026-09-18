# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site certified production cutover  
**Status:** IN PROGRESS  
**Branch:** `release/cutover-public-2e871fe`  
**Pull request:** #60

## Requested outcome

Finish the `mkety.com` public site, cut over the exact certified release safely, then move immediately into authenticated `app.mkety.com` development.

```text
public runtime healthy
→ exact release certified
→ production cutover
→ verify live acceptance
→ app.mkety.com development
```

## Certified public release

Exact certified SHA:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

Immutable certification branch:

`certify/2e871fe`

Production release branch:

`feat/mkety-public-site-production`

The production release branch has been fast-forwarded without force to the exact certified SHA.

## Runtime evidence

Production deep diagnostic run `35293332821` on exact SHA `2e871fe5ba51585886713c2cb79544e68dc20b73` is green.

Verified HTTP 200:

- `/robots.txt`;
- `/sitemap.xml`;
- `/api/runtime-db-diagnostic`;
- `/api/health`;
- `/platform`;
- `/api/public/assistant`.

Verified DB ladder:

- `cloudflare-binding`;
- `explicit-cloudflare-resolver`;
- `request-database`;
- `singleton-database`.

## Exact-SHA quality gates

All required quality workflows are green on exact candidate SHA `2e871fe5ba51585886713c2cb79544e68dc20b73`:

- Run tests: run `35293332938`;
- Typecheck: run `35293332928`;
- Lint: run `35293332824`;
- Build: run `35293332926`;
- combined CI: run `35293332854`;
- Cloudflare/Vinext smoke: run `35293332872`.

## Exact-SHA certification gates

PR #59 updated the existing candidate certification launcher and merged as `f05df19d88777bb792f435b2e1630b65591edf2c`.

The launcher verified `certify/2e871fe` is pinned to the exact candidate and dispatched all four blocking workflows.

All four are green on the same exact SHA:

- Mkety Content DB Smoke: run `35300895213`;
- Mkety Public AI Runtime Diagnostic: run `35300896504`;
- Mkety Production Routing Preflight: run `35300897695`;
- Mkety Public Candidate Deploy: run `35300898914`.

The full isolated public candidate verified:

- candidate secrets and Public AI provider configuration;
- tests, type-check, lint, Vinext compatibility;
- connected content DB migrations, seed, and smoke;
- operational NOWPayments read-only credential check;
- isolated route-free Cloudflare Worker configuration and deployment;
- all public routes and production copy quarantine;
- Enterprise payment safety boundary;
- Public Mkety AI real-provider response, memory restoration, New Chat isolation, canonical commercial grounding, Academy destination, Enterprise-first Trading sales, and private-source boundary.

The public release is fully certified.

## Current cutover authorization: PR #60

The repository already had a no-op `.github/workflows/mkety-public-cutover-launcher.yml` that explicitly could not mutate production.

PR #60 upgrades only that launcher into a one-time exact-SHA dispatcher for the existing guarded `mkety-public-production-cutover.yml`.

The launcher is pinned to:

- `VERIFIED_SHA: 2e871fe5ba51585886713c2cb79544e68dc20b73`;
- `CONFIRMATION: CUTOVER MKETY PUBLIC`;
- `RELEASE_BRANCH: feat/mkety-public-site-production`.

Before dispatch it independently verifies the release branch still points to the certified SHA.

The production cutover workflow then re-verifies all exact-SHA gates before any mutation, snapshots current routes, deploys the exact SHA, binds only `mkety.com/*` and `www.mkety.com/*`, runs live acceptance, and automatically restores the pre-cutover apex/www route state if binding or acceptance fails.

### TDD evidence

Test-only commit `7933b790b37e63336b57d351e2aebb7cdbced631` required the cutover launcher to contain the exact certified SHA, required confirmation phrase, `actions: write`, target production cutover workflow, and exact dispatch inputs.

Valid red:

- the existing no-op launcher was found but did not contain the certified SHA/confirmation or production dispatch;
- the cutover-launcher regression failed;
- the other 728 tests passed;
- build, lint, and type-check passed.

Implementation commit `650184e1c99074ae29aaa83c3e330f18487a12ba` converts the no-op launcher into the guarded exact-SHA dispatcher.

Verification on implementation head `650184e1c99074ae29aaa83c3e330f18487a12ba`:

- standalone tests: green;
- combined CI: green;
- standalone build: green;
- standalone lint: green;
- standalone type-check: green;
- Cloudflare/Vinext smoke: green;
- PR validation: green;
- MegaLinter was still running when this handoff update was written.

This documentation update is the only intended change after the verified dispatcher implementation.

## Production safety

- Production route mutation has not occurred yet.
- Until PR #60 merges and the guarded cutover workflow reaches its route-bind step, apex/www remain in the pre-cutover state.
- The cutover workflow must refuse stale SHA, stale release branch, missing workflow evidence, missing production secrets, unexpected existing production Worker bindings, or failed preview acceptance.
- Only `mkety.com/*` and `www.mkety.com/*` may be mutated.
- Route snapshots and rollback instructions must be persisted before mutation.
- Any partial route-bind or live acceptance failure must automatically restore the recorded pre-cutover target-route state.
- No unrelated Worker route or DNS record may be changed.

## Exact next steps

1. Require MegaLinter green for PR #60.
2. Verify the final PR head differs from implementation head `650184e1c99074ae29aaa83c3e330f18487a12ba` only by this handoff.
3. Merge PR #60 with the exact final head pinned.
4. Confirm the cutover launcher succeeds on the merge push and dispatches `mkety-public-production-cutover.yml` with exact candidate SHA and required confirmation.
5. Follow the guarded cutover run:
   - authorize exact SHA and all blocking gates;
   - execute the production DB step;
   - snapshot routing and rollback evidence;
   - deploy/preview exact candidate;
   - disable temporary production preview exposure;
   - bind only apex and www;
   - run live public-route, canonical, sitemap, robots, www 308, NOWPayments webhook, and Public AI acceptance;
   - retain bindings only if all acceptance passes.
6. Record immutable cutover run/route evidence here after success.
7. Remove or return the one-time cutover launcher to a no-op state after successful production acceptance.
8. Move immediately to app work: reconcile stale draft PR #35, then Entitlements #22, Usage/Credits #23, and remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy PR must update this status and its feature handoff with requested outcome, prior state, changes, verification evidence, environment/runtime changes, blockers/risks, and exact next steps. No feature may be marked complete, verified, production, or merge-ready without that update.
