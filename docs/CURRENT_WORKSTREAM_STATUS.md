# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover through Cloudflare Worker Custom Domains  
**Status:** IN PROGRESS — certified candidate green; DB migration now passes; latest cutover stopped safely on an over-broad public-copy smoke before hostname mutation  
**Branch:** `release/coolify-env-upsert-cutover-2e871fe`  
**Pull request:** #64

## Requested outcome

Finish the `mkety.com` public site, promote the exact certified release using Cloudflare Worker Custom Domains, verify production acceptance and rollback evidence, then move immediately into authenticated `app.mkety.com` development.

## Certified public release

Exact certified application SHA:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

Immutable certification branch:

`certify/2e871fe`

Production release branch:

`feat/mkety-public-site-production`

The release branch has been verified identical to the exact certified SHA.

Production deep diagnostic `35293332821` is green on that SHA and confirmed HTTP 200 for `/robots.txt`, `/sitemap.xml`, `/api/runtime-db-diagnostic`, `/api/health`, `/platform`, and `/api/public/assistant`, with the full Cloudflare/Hyperdrive DB ladder green through `singleton-database`.

## Exact-SHA certification evidence

Quality gates on exact SHA `2e871fe5...` are green:

- tests: `35293332938`;
- type-check: `35293332928`;
- lint: `35293332824`;
- build: `35293332926`;
- CI: `35293332854`;
- Cloudflare/Vinext smoke: `35293332872`;
- MegaLinter: `35293332877`;
- production Hyperdrive deep diagnostic: `35293332821`.

Candidate launcher `35300887227` succeeded. Exact-candidate blockers are green:

- Content DB Smoke: `35300895213`;
- Public AI Runtime Diagnostic: `35300896504`;
- Production Routing Preflight: `35300897695`;
- Public Candidate Deploy: `35300898914`.

## Custom Domain cutover tooling

PR #62 merged as:

`96f558e3ef971fbcba3c0d5e58738144c6e11e53`

Its final head `f4a8a60b1e6be828018ae1e85426d123b5b45e51` passed all required PR gates:

- tests `35302223625`;
- CI `35302223743`;
- lint `35302223662`;
- type-check `35302223621`;
- build `35302223641`;
- Vinext smoke `35302223693`;
- PR validation `35302223602`;
- MegaLinter `35302223645`.

PR #62 established the production binding contract:

- `mkety.com` → `mkety-platform` Worker Custom Domain;
- `www.mkety.com` → `mkety-platform` Worker Custom Domain;
- `mkety.com/*` and `www.mkety.com/*` Worker Routes must remain absent;
- unrelated Worker Routes must remain unchanged;
- the stale alternate custom-domain promoter was removed;
- the guarded production cutover workflow remains the only hostname-mutation path.

Cloudflare's Worker Domains API is used for attachment, with pre-mutation DNS/Custom-Domain/Worker-Route snapshots and automatic rollback.

## Cutover attempt 1 — stopped before public binding

PR #60 launcher `35301780726` dispatched cutover run:

`35301787839`

Result:

- exact-SHA authorization: pass;
- private PostgreSQL preflight: pass;
- ephemeral exact-SHA migration host creation: pass;
- environment-variable injection: failed with `curl: (35) Recv failure: Connection reset by peer`;
- ephemeral host cleanup: pass;
- production cutover job: skipped.

No Worker Route or Custom Domain mutation occurred.

## Cutover attempt 2 — stopped before public binding

PR #62 merge launcher:

`35302427849`

dispatched cutover run:

`35302435842`

Result:

- exact-SHA authorization: pass;
- release branch still exactly `2e871fe5...`: pass;
- all blocking exact-candidate gates revalidated: pass;
- private PostgreSQL URL resolution/health/privacy/SSL preflight: pass;
- ephemeral exact-SHA migration host creation: pass;
- environment-variable injection: failed with HTTP `404` on `PATCH /applications/{uuid}/envs`;
- ephemeral host cleanup: pass;
- Custom Domain/live cutover job: skipped.

No production hostname, DNS, Worker Route, or Custom Domain mutation occurred.

The 404 is expected for update semantics on a brand-new Coolify application when `DATABASE_URL` does not yet exist. Coolify exposes POST to create an application env, PATCH to update one, and GET to list current envs.

## PR #64 TDD and fix

Test-only commit:

`0ea82915fbfe896e5a16675cf2c52e6588ddd212`

Valid red: combined CI `35302525314` produced:

- Build: green;
- Lint: green;
- Type-check: green;
- Test: failed;
- test summary: 1 failed / 156 passed suites; 2 failed / 728 passed tests.

The two failures were exactly:

- launcher generation still `worker-custom-domains-v1` instead of v2;
- private DB executor lacked safe list/create-or-update/verify behavior.

Implementation:

- `9c2bddb4ce637e59ce77c0b6e41815f9201a1757` — safe Coolify `DATABASE_URL` upsert;
- `ea0836d1322e316056ac66a5dfc380eb21cd9758` — rearm one-time cutover launcher as `worker-custom-domains-v2`;
- `d5214b61d81bd61f9084965ad179ce040f1f0511` — align the cutover runbook with Hyperdrive-only Worker DB access and current payment safety.

The executor now:

1. GETs current application envs;
2. PATCHes `DATABASE_URL` only if it already exists;
3. POSTs only if the key is absent;
4. after an uncertain POST response, performs a read-before-retry so it does not blindly replay a create that may already have committed;
5. verifies the key exists before deployment proceeds.

The Worker itself remains private-credential-free: production migrations use the ephemeral private-DB executor; Worker runtime uses only the `MKETY_DB` Hyperdrive binding.

NOWPayments remains the required production cutover payment check. Hosted checkout providers such as Selar are optional/admin-configured and are not hard-coded cutover prerequisites.

## Production/environment/DB state

As of this update:

- no successful public production cutover has occurred;
- no apex/www Worker Route has been created by the cutover workstream;
- no apex/www Worker Custom Domain has yet been attached by these cutover attempts;
- both failed ephemeral migration hosts were cleaned up;
- private PostgreSQL remained healthy, private, and SSL-enabled;
- the certified application payload remains exactly `2e871fe5...`;
- public application runtime certification remains green.

## Latest cutover attempt

Cutover run `35304048710` passed authorization, production DB migration/seed/smoke, exact-SHA quality checks, Hyperdrive resolution, Cloudflare snapshot/rollback preparation, Worker build/deploy, direct-DB secret removal, and runtime secret attachment.

The Worker preview returned HTTP 200. The pre-domain smoke then rejected `/` because its quarantine regex treated any occurrence of the word `GitHub` as internal wording. The public homepage legitimately advertises GitHub integration, so this was an over-broad smoke rule rather than a runtime failure. Custom Domain attachment was skipped; production hostnames remain unchanged.

Branch `release/fix-public-copy-smoke-2e871fe` narrows that check to actual internal repository references such as `github.com/MketyDigital` while continuing to block `MketyDigital`, `mksaas`, `mklms`, private origin hostnames, and stale runtime/template wording. Launcher generation is bumped to `worker-custom-domains-v3` for one clean retry.

## Exact next steps

1. Require PR #64 exact final head green for tests, CI, lint, type-check, build, Vinext smoke, PR validation, and MegaLinter.
2. Merge PR #64 only with the exact-head guard.
3. Verify `worker-custom-domains-v2` launcher dispatches the guarded production cutover for exact SHA `2e871fe5...`.
4. Require the private DB executor to complete migrations/seed/content smoke.
5. Require production Worker deploy/Hyperdrive smoke to pass.
6. Require Worker Custom Domain attachment for `mkety.com` and `www.mkety.com`, with apex/www Worker Routes absent and unrelated routes unchanged.
7. Require live route/canonical/sitemap/robots/www redirect/NOWPayments/Public AI acceptance and persisted rollback evidence.
8. Immediately update this file and `docs/MKETY_DEVELOPMENT_CONTINUATION.md` with immutable production evidence.
9. Move directly to app work: reconcile stale draft PR #35, then Entitlements #22, Usage/Credits #23, then the remaining Platform/app roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy/migration PR must update this status and its relevant handoff with requested outcome, previous state, changes made, status, exact verification evidence, production/environment/DB changes, blockers/risks, exact next steps, and PR/issues/run IDs. No feature may be called complete, production, verified, or merge-ready until that handoff is current.
