# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** Public-site production cutover through Cloudflare Worker Custom Domains  
**Status:** IN PROGRESS — certified candidate green; first cutover attempt stopped before hostname mutation; reconciliation PR #62 under verification  
**Branch:** `release/custom-domain-cutover-reconcile-2e871fe`  
**Pull request:** #62

## Requested outcome

Finish the `mkety.com` public site, promote the exact certified release using Cloudflare Worker Custom Domains, verify production acceptance and rollback evidence, then move immediately into authenticated `app.mkety.com` development.

```text
public runtime healthy
→ exact release certified
→ guarded Custom Domain cutover
→ verify live acceptance + rollback evidence
→ app.mkety.com development
```

## Certified public release

Exact certified application SHA:

`2e871fe5ba51585886713c2cb79544e68dc20b73`

Immutable certification branch:

`certify/2e871fe`

Production release branch:

`feat/mkety-public-site-production`

The production release branch has been verified identical to the exact certified SHA.

Production deep diagnostic run `35293332821` is green on that SHA and confirmed HTTP 200 for `/robots.txt`, `/sitemap.xml`, `/api/runtime-db-diagnostic`, `/api/health`, `/platform`, and `/api/public/assistant`, with the full Cloudflare/Hyperdrive DB ladder green through `singleton-database`.

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

PR #59 merged as `f05df19d88777bb792f435b2e1630b65591edf2c`. Candidate launcher run `35300887227` succeeded.

All four exact-candidate certification workflows are green:

- Mkety Content DB Smoke: `35300895213`;
- Mkety Public AI Runtime Diagnostic: `35300896504`;
- Mkety Production Routing Preflight: `35300897695`;
- Mkety Public Candidate Deploy: `35300898914`.

PR #59 final-head MegaLinter run `35300668324` was explicitly rerun after an initial cancellation and succeeded on attempt 2.

## First production cutover attempt: stopped before public binding

Concurrent PR #60 merged as:

`b10f3c49827b8fd1d591b0fcd8b26fdea2574f87`

Its cutover launcher run `35301780726` succeeded and dispatched production cutover run:

`35301787839`

That run did **not** mutate the public hostname binding:

- exact-SHA authorization: passed;
- private production DB URL resolution: passed;
- private PostgreSQL health/publicity/SSL preflight: passed;
- exact-SHA ephemeral Coolify migration host creation: passed;
- `Inject private database URL`: failed with `curl: (35) Recv failure: Connection reset by peer`;
- ephemeral migration host cleanup: completed;
- final `Verify exact candidate and cut over mkety.com` job: skipped.

Therefore the failed run never reached Worker Route or Custom Domain mutation and never deployed/accepted the live public surface.

The failure is a Coolify control-plane transport failure during environment-variable injection, not a PostgreSQL, Hyperdrive, migration, or public runtime failure.

## Binding decision: Worker Custom Domains only

The production binding mechanism is:

- `mkety.com` → `mkety-platform` Worker Custom Domain;
- `www.mkety.com` → `mkety-platform` Worker Custom Domain.

The following Worker Routes must remain absent:

- `mkety.com/*`;
- `www.mkety.com/*`.

PR #62 replaces the old apex/www Worker Route mutation with the Cloudflare Worker Custom Domains API while preserving all existing exact-SHA authorization, DB, Hyperdrive, payment, Public AI, preview, rollback, and live-acceptance gates.

It also removes the stale alternate `.github/workflows/mkety-public-custom-domain-promote.yml` so the guarded production cutover workflow is the only production hostname-mutation path.

## PR #62 changes

Test-only commit:

`03582d835a356d2067d5053fdeef8d21853dd309`

The regression requires:

- the guarded cutover to use the Worker Custom Domains API;
- only `mkety.com` and `www.mkety.com` to be attached;
- both domains to target `mkety-platform`;
- Worker Routes to remain unchanged;
- no old apex/www route-binding implementation;
- the Coolify migration secret update to use `PATCH`;
- transient Coolify transport errors to be retried;
- the one-time cutover launcher generation to be `worker-custom-domains-v1`.

Dedicated temporary evidence PR #63 ran the exact test-only commit and was closed without merge after recording a valid red. Combined CI run `35302062777` produced: Type-check green, Lint green, Build green, Test failure. The test summary was 1 failed / 156 passed suites and 3 failed / 727 passed tests (730 total). The three failures were exactly the new Custom Domain API assertion, launcher generation assertion, and Coolify PATCH/retry assertion.

Implementation commits currently include:

- `fbdfd9547f49e42df01162be9d341c060767a8bd` — restore the vetted Worker Custom Domain cutover;
- `f607c12536f34d6948a223b629f571bde1adcb41` — change Coolify environment update to retry-safe `PATCH`;
- `6f3d57503409349a3aea1c488278082a2fe1d61c` — rearm the one-time launcher with `CUTOVER_MODE: worker-custom-domains-v1`;
- `1f071cd0330b6cbef27b10a7bdbc3b31073aaad4` — remove the stale alternate promoter;
- `f6feb2c64460f331e563b4fe890914ecf6e78bfa` — update the production cutover runbook for Custom Domains.

The Coolify environment update now uses bounded retries with `--retry 4 --retry-all-errors --retry-delay 2`, plus connect/overall timeouts, while retaining exact-SHA/private-DB guards.

## Production/environment/DB state

As of this update:

- no successful public production cutover has occurred;
- no apex/www Worker Route was bound by cutover run `35301787839`;
- no Worker Custom Domain has yet been attached by this workstream;
- the failed ephemeral Coolify migration host was cleaned up;
- the private database resolved healthy and remained private/SSL-enabled;
- the certified application SHA remains unchanged at `2e871fe5...`;
- PR #62 changes release tooling/tests/docs only and does not change the certified application payload.

## Remaining gate

1. Verify PR #62 exact final documentation head.
2. Mark PR #62 ready for review and require tests, CI, lint, type-check, build, Vinext smoke, PR validation, and MegaLinter green on that exact head.
3. Merge PR #62 only with the exact-head guard.
4. Confirm merge-time launcher generation `worker-custom-domains-v1` dispatches `mkety-public-production-cutover.yml` with:
   - `verified_sha = 2e871fe5ba51585886713c2cb79544e68dc20b73`;
   - confirmation `CUTOVER MKETY PUBLIC`.
5. Require the private DB executor to complete migration/content seed/smoke successfully.
6. Require Custom Domain attachment and live acceptance to pass, with:
   - `mkety.com` and `www.mkety.com` attached to the exact Worker;
   - Worker Routes unchanged;
   - canonical www→apex behavior;
   - sitemap/robots acceptance;
   - NOWPayments fail-closed verification;
   - Public AI commercial grounding/privacy boundary;
   - persisted rollback artifacts.
7. Immediately update this file and `docs/MKETY_DEVELOPMENT_CONTINUATION.md` with immutable production evidence.
8. Move directly to app work: reconcile stale draft PR #35, then Entitlements #22, Usage/Credits #23, then the remaining Platform roadmap.

## Feature-agent handoff rule

Every material feature/runtime/deploy/migration PR must update this status and its relevant handoff with requested outcome, previous state, changes made, status, exact verification evidence, production/environment/DB changes, blockers/risks, exact next steps, and PR/issues/run IDs. No feature may be called complete, production, verified, or merge-ready until that handoff is current.
