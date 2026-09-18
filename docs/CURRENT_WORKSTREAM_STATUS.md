# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover through Cloudflare Worker Custom Domains  
**Status:** IN PROGRESS — certified candidate green; cutover tooling PR under verification  
**Branch:** `release/public-custom-domain-cutover-2e871fe`  
**Pull request:** #61

## Requested outcome

Finish the `mkety.com` public site, certify and cut over the exact verified public release using Worker Custom Domains, then move immediately into authenticated `app.mkety.com` development.

```text
finish public site
→ certify exact release candidate
→ promote mkety.com + www.mkety.com as Worker Custom Domains
→ verify production acceptance + rollback evidence
→ resume app.mkety.com development
```

## Certified public application

Exact certified SHA:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

Immutable certification branch:

`certify/2e871fe`

Release branch `feat/mkety-public-site-production` compares **identical** to that SHA: ahead 0, behind 0.

Production deep diagnostic run `35293332821` is green on that exact SHA and confirms:

- `/robots.txt` HTTP 200;
- `/sitemap.xml` HTTP 200;
- `/api/runtime-db-diagnostic` HTTP 200;
- `/api/health` HTTP 200;
- `/platform` HTTP 200;
- `/api/public/assistant` HTTP 200;
- full Cloudflare/Hyperdrive DB ladder green through `singleton-database`.

The public runtime blocker is closed.

## Exact-SHA quality gate

Push verification on exact SHA `2e871fe5...` is green:

- tests: run `35293332938`;
- type-check: `35293332928`;
- lint: `35293332824`;
- build: `35293332926`;
- CI: `35293332854`;
- Cloudflare/Vinext smoke: `35293332872`;
- MegaLinter: `35293332877`;
- production Hyperdrive deep diagnostic: `35293332821`.

PR #59 merged as `f05df19d88777bb792f435b2e1630b65591edf2c`. Its launcher run `35300887227` succeeded and dispatched all four blockers against `certify/2e871fe`.

Exact-candidate certification workflows are green:

- Mkety Content DB Smoke: `35300895213`;
- Mkety Public AI Runtime Diagnostic: `35300896504`;
- Mkety Production Routing Preflight: `35300897695`;
- Mkety Public Candidate Deploy: `35300898914`.

PR #59 final-head MegaLinter attempt 1 was cancelled during image pull after the PR had already been merged by another agent. The exact same workflow run `35300668324` was rerun as attempt 2 and completed **successfully** on final head `20a30478a306d9be29aa8200360e076fb86bd7a9`. The certified application itself also has independent successful MegaLinter run `35293332877`.

## Cutover binding decision

Production apex/www will use **Cloudflare Worker Custom Domains**, not Worker Routes.

Target Worker Routes:

- `mkety.com/*`: must remain absent;
- `www.mkety.com/*`: must remain absent.

The only authorized production mutation path remains:

`.github/workflows/mkety-public-production-cutover.yml`

The stale alternate `mkety-public-custom-domain-promote.yml` workflow is removed in PR #61 so production cannot be promoted through a second path.

The guarded cutover still requires:

- exact `verified_sha`;
- confirmation `CUTOVER MKETY PUBLIC`;
- all exact-SHA blocking workflow evidence;
- release-branch exact-head guard;
- private production DB executor;
- Hyperdrive-only Worker runtime;
- NOWPayments fail-closed validation;
- Public AI grounding/privacy validation;
- pre-mutation DNS/Custom-Domain/Worker-Route snapshots;
- automatic rollback;
- full live production acceptance.

## PR #61 TDD evidence

Test-only commit:

`d4a582c2f53eb921794e832648c78ca7584f3d34`

The regression requires the production cutover workflow to:

- call the Cloudflare Worker Custom Domains API;
- attach only `mkety.com` and `www.mkety.com`;
- point both to `mkety-platform`;
- verify unrelated Worker Routes remain unchanged;
- contain no old apex/www Worker Route bind implementation.

Valid red on CI run `35301442644`:

- Test job failed;
- type-check passed;
- build passed;
- lint passed.

Implementation commit:

`ce1d25f799d9bfe7c71b3fd991c5d167aa31d899`

It replaces route binding with guarded Custom Domain attachment while retaining exact-SHA authorization, production DB execution, Worker deployment, pre-bind smoke, automatic rollback, production acceptance, payment safety, and Public AI checks.

Follow-up cleanup:

- `a0eff5f2724c8fe4b4459792e6b30d69c6c7e1aa`: clarifies the regression wording without changing the release contract;
- `a8a654983270488f720189b4c5632d36b8a65f14`: removes the stale alternate production promoter;
- `17e1e16bebd32cd659638b0a271db97421f8777c`: updates the production cutover runbook to require Worker Custom Domains.

## Production/environment/DB changes

No production hostname, DNS record, Worker Route, database, secret, or customer data has been mutated by PR #61.

The certified application SHA remains `2e871fe5...`; PR #61 changes only release tooling/tests/docs on top of current `main`.

## Exact next steps

1. Finish PR #61 documentation and verify its exact final head.
2. Require tests, CI, lint, type-check, build, Vinext smoke, PR validation and MegaLinter green on that exact head.
3. Merge PR #61 only with an exact-head guard.
4. Reconfirm `feat/mkety-public-site-production` is still identical to `2e871fe5...`.
5. Manually dispatch `mkety-public-production-cutover.yml` with:
   - `verified_sha = 2e871fe5ba51585886713c2cb79544e68dc20b73`;
   - confirmation `CUTOVER MKETY PUBLIC`.
6. Require successful Custom Domain attachment for `mkety.com` and `www.mkety.com`, unchanged Worker Routes, live acceptance, Public AI/payment safety, and persisted rollback artifact.
7. Immediately update this file and `docs/MKETY_DEVELOPMENT_CONTINUATION.md` with immutable production evidence.
8. Move to app work: reconcile stale draft PR #35, then Entitlements #22, Usage/Credits #23, then the remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy/migration PR must update this status and its relevant handoff with requested outcome, previous state, changes made, status, exact verification evidence, production/environment/DB changes, blockers/risks, exact next steps, and PR/issues/run IDs. No feature may be called complete, production, verified, or merge-ready until that handoff is current.
