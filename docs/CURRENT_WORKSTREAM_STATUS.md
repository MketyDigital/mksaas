# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site release certification and production cutover  
**Status:** IN PROGRESS  
**Branch:** `release/certify-public-2e871fe`  
**Pull request:** #59

## Requested outcome

Finish the `mkety.com` public site, certify and cut over the exact verified public release, then move immediately into authenticated `app.mkety.com` development.

```text
finish public site
→ verify production runtime
→ certify exact release candidate
→ cut over mkety.com
→ resume app.mkety.com development
```

## Public runtime is now healthy

PR #56 merged to `main` as `351dc78cbbd4502f5a689390d2d97ea8a201874a`.

Production deep diagnostic run `35292525269` on that exact SHA established:

- apex/www Worker routes remained intentionally unbound;
- direct Hyperdrive `SELECT 1` passed;
- `cloudflare-binding` passed;
- `explicit-cloudflare-resolver` passed;
- `request-database` passed;
- `singleton-database` passed;
- `/api/runtime-db-diagnostic` returned HTTP 200;
- `/api/health` returned HTTP 200;
- `/` returned HTTP 200;
- Public Assistant returned HTTP 200.

PR #58 then moved the last two public content loaders to the explicit Cloudflare database singleton. Latest verified `main` is:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

Production deep diagnostic run `35293332821` on that exact SHA is green and confirmed:

- `/robots.txt` HTTP 200;
- `/sitemap.xml` HTTP 200;
- `/api/runtime-db-diagnostic` HTTP 200;
- `/api/health` HTTP 200;
- `/platform` HTTP 200;
- `/api/public/assistant` HTTP 200;
- full DB ladder green through `singleton-database`.

The public runtime blocker is closed.

## Exact release candidate

Immutable certification branch:

`certify/2e871fe`

Exact candidate SHA:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

The branch was created directly from the exact green `main` SHA and must not move during certification.

## Current release plumbing: PR #59

The repository already contains `.github/workflows/mkety-certify-candidate-launcher.yml`, which dispatches the four blocking manual certification workflows:

- Mkety Content DB Smoke;
- Public AI Runtime Diagnostic;
- Production Preflight;
- Public Candidate Deploy.

The launcher still referenced an older frozen candidate, so PR #59 updates only its immutable candidate SHA and certification branch.

### TDD evidence

Test-only commit `ad23291f284db831482c4c242715eefb96fee23d` required the launcher to contain:

- `CANDIDATE_SHA: 2e871fe5ba51585886713c2cb79544e68dc20b73`;
- `CERT_BRANCH: certify/2e871fe`;
- all four required workflow dispatches.

Valid red:

- the launcher regression failed specifically because the old candidate SHA/branch were still present;
- the other 727 tests passed;
- build, lint, type-check, and Vinext smoke passed.

Implementation commit `fb2c287b05b1c1c1f6190f6ce329ab92491d5545`:

- changes only `CANDIDATE_SHA` to `2e871fe5ba51585886713c2cb79544e68dc20b73`;
- changes only `CERT_BRANCH` to `certify/2e871fe`;
- preserves the existing exact-branch verification and four workflow dispatches.

Verification on implementation head `fb2c287b05b1c1c1f6190f6ce329ab92491d5545`:

- combined CI: green;
- standalone tests: green;
- standalone build: green;
- standalone lint: green;
- standalone type-check: green;
- Cloudflare/Vinext smoke: green;
- PR validation: green;
- MegaLinter was still running when this handoff update was written.

This documentation update is the only intended change after that verified implementation head.

## Production safety

- `mkety.com/*` and `www.mkety.com/*` remain intentionally unbound.
- Do not mutate production routes until all exact-candidate certification workflows are green.
- The dedicated production cutover workflow remains the only authorized route-mutation path.
- It requires the exact verified SHA, explicit `CUTOVER MKETY PUBLIC` confirmation, pre-cutover gate evidence, route snapshots, and automatic rollback.
- No secrets, DB URLs, raw bindings, or customer data may be logged.

## Exact next steps

1. Require MegaLinter to finish green for PR #59.
2. Verify this final handoff head differs from the fully tested implementation only by `docs/CURRENT_WORKSTREAM_STATUS.md`.
3. Merge PR #59 with an exact-head guard.
4. Confirm the merged launcher runs on `main` and successfully dispatches all four workflows against `certify/2e871fe`.
5. Require all four certification workflows green on exact SHA `2e871fe5ba51585886713c2cb79544e68dc20b73`.
6. Confirm every prerequisite required by `mkety-public-production-cutover.yml` is green for that same exact SHA: tests, type-check, lint, build, CI, Vinext smoke, content DB smoke, Public AI runtime diagnostic, production routing preflight, and public candidate.
7. Execute the reviewed production cutover workflow only with:
   - verified SHA `2e871fe5ba51585886713c2cb79544e68dc20b73`;
   - confirmation `CUTOVER MKETY PUBLIC`.
8. Require post-bind acceptance for the public pages, canonical www→apex redirect, sitemap/robots, Public AI, auth entry points, Enterprise payment safety, and rollback evidence.
9. Record immutable cutover evidence here and in the continuation documentation.
10. Move immediately to app work: reconcile stale draft PR #35, then Entitlements #22, Usage/Credits #23, and the remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy PR must update this status and its feature handoff with requested outcome, prior state, changes, verification evidence, environment/runtime changes, blockers/risks, and exact next steps. No feature may be marked complete, verified, production, or merge-ready without that update.
