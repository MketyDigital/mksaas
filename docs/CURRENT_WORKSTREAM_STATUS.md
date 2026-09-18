# Mkety Current Workstream Status

**Updated:** 2026-09-18  
**Current workstream:** `app.mkety.com` Deployments/Cloud foundation  
**Status:** IN PROGRESS — Wallet merged; first Deploy backend slice implemented on `feat/deploy-foundation-current-main`  
**Production application SHA:** `2e871fe5ba51585886713c2cb79544e68dc20b73`  
**Successful cutover run:** `35309531966`

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

- public production cutover is successful and externally accepted;
- no apex/www Worker Route was created by the cutover workstream;
- `mkety.com` and `www.mkety.com` are attached to `mkety-platform` as Worker Custom Domains;
- both failed ephemeral migration hosts were cleaned up;
- private PostgreSQL remained healthy, private, and SSL-enabled;
- the certified application payload remains exactly `2e871fe5...`;
- public application runtime certification remains green.

## Latest cutover attempt

Cutover run `35304048710` passed authorization, production DB migration/seed/smoke, exact-SHA quality checks, Hyperdrive resolution, Cloudflare snapshot/rollback preparation, Worker build/deploy, direct-DB secret removal, and runtime secret attachment.

The Worker preview returned HTTP 200. The pre-domain smoke then rejected `/` because its quarantine regex treated any occurrence of the word `GitHub` as internal wording. The public homepage legitimately advertises GitHub integration, so this was an over-broad smoke rule rather than a runtime failure. Custom Domain attachment was skipped; production hostnames remain unchanged.

PR #65 narrowed that check to actual internal repository references such as `github.com/MketyDigital` while continuing to block `MketyDigital`, `mksaas`, `mklms`, private origin hostnames, and stale runtime/template wording. Its v3 cutover progressed further: the preview returned HTTP 200 and passed the wording sweep, but the canonical smoke falsely required `rel="canonical"` to appear before `href` in the `<link>` tag. HTML attribute order is not significant. Branch `release/fix-canonical-smoke-2e871fe` reuses the repo's existing order-independent canonical-link parser and bumps the launcher to `worker-custom-domains-v4` for one clean retry.

## Exact next steps

1. Reconcile stale draft PR #35 (`fix: make RLS helper hardening portable to private Postgres`) against current `main`; preserve intent, do not blindly merge stale code.
2. Run the full required gates on the reconciled exact head and merge only when current-main compatible.
3. Continue Entitlements #22.
4. Continue Usage/Credits #23.
5. Continue the remaining authenticated Platform/app roadmap under `app.mkety.com`.

## Feature-agent handoff rule

Every material feature/runtime/deploy/migration PR must update this status and its relevant handoff with requested outcome, previous state, changes made, status, exact verification evidence, production/environment/DB changes, blockers/risks, exact next steps, and PR/issues/run IDs. No feature may be called complete, production, verified, or merge-ready until that handoff is current.


## Custom Domain DNS conflict resolution

Cutover run `35305522201` passed production DB migration, exact-SHA quality checks, Hyperdrive resolution, Worker deployment, runtime secrets, preview smoke, canonical checks, sitemap/robots, and DB-backed preview verification. It then failed at the first Worker Custom Domain attach with Cloudflare HTTP 409.

The pre-mutation artifact from that run proves the conflict source: both `mkety.com` and `www.mkety.com` still had two proxied A records pointing to `64.29.17.1` and `216.198.79.1`. Mail and verification records (MX/TXT/CAA) are unrelated and must be preserved.

Branch `release/resolve-custom-domain-dns-conflict-2e871fe` removes only pre-existing A/AAAA origin records immediately before each Custom Domain attach, preserves all non-origin DNS records, includes `zone_name` in the attach request, surfaces Cloudflare API errors, and relies on the existing rollback snapshot to restore removed A/AAAA records if attachment or live acceptance fails. Launcher generation is `worker-custom-domains-v5`.


## Live acceptance redirect normalization

Cutover run `35306492667` successfully attached both `mkety.com` and `www.mkety.com` as Worker Custom Domains after removing only the stale apex/www A records. Live `mkety.com` readiness returned HTTP 200. The run then failed only because the acceptance script compared the raw `Location` header from the required www 308 redirect to one exact serialization.

The workflow rolled back the Custom Domains and restored the pre-cutover A records, returning traffic to the previous site. Branch `release/robust-www-redirect-acceptance-2e871fe` keeps the 308 requirement but validates the redirect target semantically as HTTPS + hostname `mkety.com` + root path + no query/hash. Launcher generation is `worker-custom-domains-v6`.


## Live Public AI acceptance alignment

Cutover run `35307191844` passed authorization, production DB migration, exact-SHA quality checks, Hyperdrive resolution, Worker deploy/secrets, preview smoke, Custom Domain attachment, live route/canonical/sitemap/robots checks, and the semantic `www.mkety.com -> https://mkety.com/` 308 redirect check. Final acceptance then failed in the Public AI assertion and automatically rolled back the newly attached Custom Domains/restored prior A records.

The production acceptance contract had drifted from the already-certified candidate contract: it required `trade.mkety.com` in a new Trading buyer answer, while candidate certification explicitly rejects direct `trade.mkety.com` handoff for new buyers and requires Enterprise-first Trading sales. Branch `release/align-live-ai-acceptance-2e871fe` makes live acceptance identical to the certified boundary: canonical plans/prices, Academy production destination, Enterprise-first Trading sales, removed-plan rejection, and private-source/internal-engineering rejection. Launcher generation is `worker-custom-domains-v7`.


## Successful public production cutover — immutable evidence

Production cutover completed successfully on 2026-09-18.

- certified application SHA: `2e871fe5ba51585886713c2cb79544e68dc20b73`;
- release branch: `feat/mkety-public-site-production`, pinned to that exact SHA;
- launcher/main merge SHA: `4811e4b22c5a457857122ed01b8910546ca658df`;
- successful production cutover run: `35309531966`;
- runtime: Cloudflare Worker `mkety-platform`;
- database runtime: `MKETY_DB` Hyperdrive via `mkety-production-db`; private production `DATABASE_URL` was used only by the isolated migration executor and is not attached to the Worker;
- public bindings: `mkety.com` and `www.mkety.com` Worker Custom Domains;
- apex/www Worker Routes: absent; unrelated Worker Routes preserved;
- `www.mkety.com`: verified HTTP 308 to canonical `https://mkety.com/`;
- public route acceptance: passed;
- canonical metadata, sitemap and robots: passed;
- NOWPayments: read-only credential check passed and invalid-signature webhook failed closed with HTTP 400;
- Public Mkety AI: live commercial grounding, Academy destination, Enterprise-first Trading sales, removed-plan rejection and private-source boundary passed;
- auth entry points remain the public Sign In / Get Started handoff into the Platform; public-site production did not require replacing Mkety/ZITADEL auth;
- rollback evidence artifacts:
  - pre-mutation artifact `10533230861` (`mkety-public-cutover-pre-mutation-2e871fe...`);
  - Custom Domain rollback artifact `10532738152` (`mkety-public-cutover-custom-domain-2e871fe...`).

The public-site cutover milestone is complete. Do not reopen public release work unless production monitoring finds a real regression. The active workstream is now authenticated Platform/app development.


## RLS helper portability reconciliation

Historical draft PR #35 is superseded by current `main`. Its intended migration behavior is already present in `migrations/0008_harden_rls_auto_enable.sql`: the optional `public.rls_auto_enable()` helper is detected with `to_regprocedure`, and Supabase-only `anon` / `authenticated` revokes are conditional so private PostgreSQL does not fail when those objects are absent.

The only still-missing part from PR #35 was its regression coverage. Branch `fix/rls-auto-enable-portable-current-main` adds `src/shared/db/rls-auto-enable-migration.test.ts` against the current implementation. No production database mutation is performed by this reconciliation branch; it only locks the already-shipped portable migration behavior with tests.

Next after this reconciliation: Entitlements #22, then Usage/Credits #23.


## Entitlements #22 current-main reconstruction

Historical draft PR #22 is 192 commits behind the post-cutover main. Its entitlement-only delta is being reconstructed on `feat/entitlements-current-main` rather than merging the stacked branch.

Preserved scope:
- canonical entitlement keys;
- versioned plan entitlements;
- tenant grant/deny overrides with expiry and actor metadata;
- deny-by-default resolver;
- authoritative `requireEntitlement` enforcement helper;
- workspace entitlement filtering;
- migration `0012` and Drizzle metadata.

Current-main adaptation:
- Entitlements database reads use `@/shared/db/cloudflare`, matching the production Worker runtime gateway.
- Workspace query integration is applied on top of the current Cloudflare-aware Platform query file.
- Usage/Credits remains out of scope and follows after Entitlements.


## Usage/Credits #23 current-main reconstruction

Historical draft PR #23 is stacked on the obsolete Entitlements branch. Its Usage/Credits-only delta is being reconstructed on `feat/usage-credits-current-main` from the merged Entitlements main.

Preserved scope:
- stable Usage/Credits meter keys and bigint credit domain;
- plan-version recurring credit allowances;
- tenant credit-account projection;
- immutable usage events;
- append-only credit ledger;
- transactional/idempotent grants, usage recording and credit consumption;
- concurrent debit protection;
- recurring grants derived from Billing plan-version/current-period state;
- workflow execution enforcement: require `workspace.workflows`, consume one `workflow.execution` credit, then execute;
- migration `0013` and Drizzle metadata.

Current-main adaptation:
- Usage/Credits database reads/writes use `@/shared/db/cloudflare`, matching the production Worker runtime;
- current schema exports are preserved while adding the four Usage/Credits schema modules;
- no wallet, purchased packs, overage billing, provider-cost accounting or payment-provider coupling is introduced.


## Entitlements and Usage/Credits verification evidence

Entitlements current-main reconstruction PR #72 passed its full required gate set and merged as `19dc6f89a0a7ee17cc7f3bc43189e2e864f5d602`.

Usage/Credits current-main reconstruction PR #73, exact head `3cf6419824ddd4f58cca38398b81d3701df3157b`, is verified green on:
- Migration Baseline `35313143927`;
- Platform Core Workspaces Smoke `35313143828`;
- Build `35313143803`;
- Typecheck `35313143605`;
- Lint `35313143726`;
- CI `35313143693`;
- Cloudflare Vinext Smoke `35313144012`;
- Pull Request Validation `35313143881`;
- full tests/coverage `35313143824`;
- MegaLinter `35313143813`;
- PR-level validation `35313142418`.

No production database mutation has been run from PR #73. The repository migration chain is now prepared through `0013_lively_magma.sql`, with Usage/Credits still separated from Wallet and from the Billing financial ledger.

Next after PR #73 merges: continue the authenticated Platform roadmap from the current post-Usage/Credits main. Wallet remains a later, separate commercial/accounting projection and must not become stored-value or a second financial ledger.


## Wallet read-model slice

After Entitlements and Usage/Credits merged, the active app workstream moved to Wallet.

Branch `feat/wallet-read-model` implements the first Wallet slice as a read-only tenant account view. It deliberately does not create a new wallet table or financial ledger.

Architecture:
- Billing remains the only monetary ledger and source of subscription/billing-period/settlement truth.
- Usage/Credits remains the separate non-monetary product-credit ledger.
- Wallet composes both read models but never treats product credits as cash.
- no withdrawals, transfers, FX, stored-value funding, payment-provider calls, or balance mutation are introduced.
- tenant Wallet route: `/t/{tenant}/wallet`.
- runtime reads use the Cloudflare database gateway.

No database migration is required for this Wallet slice.

Next: verify the exact Wallet head with tests, type-check, lint, build, Vinext, migration baseline, workspace smoke, PR validation and MegaLinter; then record immutable verification evidence before merge.


## Wallet verification evidence

Wallet PR #74 implementation head `0ffbcd7216591a2bfe4a9deeb748685a524c6858` passed:
- Build `35314114841`;
- Lint `35314114675`;
- Typecheck `35314114736`;
- CI `35314114653`;
- Cloudflare Vinext Smoke `35314114632`;
- full tests/coverage `35314114614`;
- Pull Request Validation `35314114611`;
- MegaLinter `35314114745`;
- PR-level validation `35314111695`.

The public candidate deployment job `35314114685` was correctly skipped because Wallet is authenticated app work, not a public-site release.

No database migration or production database mutation is part of this Wallet slice. Wallet remains read-only and derives monetary information from the existing Billing ledger/state while displaying Usage/Credits separately as non-cash product credits.

After Wallet merges, the next architecture workstream is Deployments/Cloud. Inspect current repository state first and implement the smallest missing foundation slice rather than recreating existing deployment code.


## Wallet pre-merge security correction

Wallet PR #74 was fully green on its initial implementation, but focused review found two correctness issues before merge:

1. the Wallet page called `auth()` without enforcing the result, while the tenant layout itself does not reject unauthenticated/non-member access;
2. the Wallet settlement list queried all tenant settlements although the UI/design describes verified/applied payment records.

The branch now:
- uses `requireTenantMembership(tenantSlug)` before any Wallet read;
- adds a reusable explicit tenant-membership guard in `src/shared/lib/permissions.ts`;
- filters Wallet settlements to Billing records with status `applied`;
- adds regression coverage locking both contracts.

Wallet remains read-only: no new table/migration, no cash/stored-value balance, no withdrawal/transfer/FX, no payment-provider call, and no second financial ledger.


## Wallet exact verification evidence

Corrected Wallet PR #74 passed its full required gate set on head `e6a49adb82c63dfa087fa42bf3585ce5f068b5e6`:

- Typecheck `35320741465`;
- full tests/coverage `35320741436`;
- Cloudflare Vinext Smoke `35320741401`;
- Lint `35320741408`;
- Build `35320741447`;
- CI `35320741527`;
- Pull Request Validation `35320741387`;
- MegaLinter `35320741378`;
- CodeQL / PR-level validation `35320738336`.

Security/correctness checks included explicit tenant-membership enforcement before Wallet reads and applied-only Billing settlement display.


## Deployments/Cloud foundation

Wallet APP-06 merged as `10abc1e269444e26f32865e2f128a6c9c69757b4`. The active app workstream is now APP-07 Deployments/Cloud.

Branch `feat/deploy-foundation-current-main` implements the smallest missing backend foundation without enabling infrastructure mutation:

- `deploy_applications` — tenant/project-scoped logical web/API/service records;
- `deploy_environments` — tenant/project/application-scoped development, preview, staging, and protected production metadata;
- `deployments` — read-oriented deployment history and release/provider references;
- migration `0014_deploy_foundation.sql` plus Drizzle journal/snapshot;
- manager/admin-only creation of application and environment metadata;
- tenant/project-scoped reads through the existing project access boundary;
- Deploy Workspace lists applications, environments, and deployment history;
- production environments are metadata-only and marked protected.

Explicitly not implemented in this slice: Cloudflare/OCI/Coolify provider calls, credentials, DNS/custom domains, public preview/production URLs, deployment triggers, production infrastructure mutation, or rollback execution.

Verification must include migration baseline / `drizzle-kit check`, full tests, type-check, lint, build, Vinext smoke, PR validation, and MegaLinter before merge.


## Deploy foundation exact verification evidence

Deployments/Cloud foundation PR #75 implementation head `ed3fdd853e606a66874bb2eef33a3e1bda10a03e` passed:

- Migration Baseline / Drizzle consistency `35322339405`;
- Platform Core Workspaces Smoke `35322339400`;
- Lint `35322339373`;
- Typecheck `35322339384`;
- Build `35322339468`;
- Cloudflare Vinext Smoke `35322339408`;
- CI `35322339444`;
- Pull Request Validation `35322339438`;
- full tests/coverage `35322339426`;
- MegaLinter `35322339425`;
- CodeQL / PR-level validation `35322338062`.

Migration `0014_deploy_foundation.sql`, its journal entry, and `0014_snapshot.json` passed the repository migration baseline and `drizzle-kit check`.

No deployment provider, DNS, custom-domain, public URL, credential, production execution, or rollback mutation is enabled by this slice. The next Deployments/Cloud batch must introduce provider execution only behind an explicit provider boundary, approvals/audit, bounded failure handling, and rollback design.


## Deploy provider-neutral execution kernel

After Deploy foundation PR #75 merged as `41b0d40d75c7889da4d6aaa522714b141dbc69b0`, the next bounded Deployments/Cloud slice is the internal execution kernel.

Branch `feat/deploy-execution-kernel` adds:
- provider-neutral deployment adapter and repository contracts;
- queued -> running -> completed/failed lifecycle orchestration;
- request-scoped Drizzle lifecycle persistence through the existing `deployments` table;
- hard rejection of protected or production environments before persistence/provider execution;
- sanitized provider failures with no raw provider error leakage;
- focused tests using an injected fake provider.

No real Cloudflare/OCI/Coolify adapter is registered. No customer-facing deploy action, provider credential, DNS/custom-domain mutation, public URL provisioning, production execution, or rollback execution is introduced.

Next after this kernel verifies/merges: implement one isolated non-production provider adapter/candidate environment with explicit credential boundaries and real external verification before exposing a customer deployment control.


## Deploy execution kernel pre-merge hardening

Focused review added two fail-closed guarantees before any real provider adapter can be introduced:

- deployment lifecycle transitions are verified atomically; provider execution does not proceed if `queued -> running` fails, and completion fails closed if `running -> completed` cannot be recorded;
- provider execution is bounded by a default 60-second timeout, with invalid timeout configuration rejected before a deployment record is created.

Provider failures and timeouts remain sanitized, protected/production environments remain non-executable, and no real Cloudflare/OCI/Coolify/DNS mutation is enabled.


## Deploy execution kernel exact verification evidence

Deploy provider-neutral execution kernel PR #76 hardened implementation head `72071d1e67fb7e658b2425eea989b55da3b4320e` passed:

- Typecheck `35368192278`;
- full tests/coverage `35368192320`;
- Lint `35368192308`;
- Platform Core Workspaces Smoke `35368192159`;
- Build `35368192344`;
- Cloudflare Vinext Smoke `35368192427`;
- CI `35368192142`;
- Pull Request Validation `35368192199`;
- MegaLinter `35368192327`;
- CodeQL / PR-level validation `35368187791`.

Pre-merge hardening verified:
- `queued -> running` and `running -> completed` transitions must persist successfully or execution fails closed;
- provider execution is bounded by a default 60-second timeout;
- invalid timeout configuration is rejected before persistence/provider execution;
- provider failures/timeouts are sanitized;
- protected and production environments remain non-executable;
- no real provider adapter, credential, DNS/custom-domain mutation, public URL provisioning, or production deployment action is included.


## Cloudflare Deploy candidate adapter

Deploy provider-neutral execution kernel PR #76 merged as `3900bd7d1efe7ac9ac5868b8dec8314c8aecb945`. The next Deployments/Cloud slice is the first real provider adapter, limited to isolated Cloudflare `workers.dev` candidates.

Branch `feat/deploy-cloudflare-candidate-adapter` adds:
- trusted server-side module artifact contract with strict module/count/source-size limits;
- candidate Worker names restricted to `mkety-deploy-candidate-*`;
- real Cloudflare Workers Script API transport;
- explicit workers.dev enablement with Preview URLs disabled;
- workers.dev URL derivation;
- exact candidate deletion;
- provider/transport tests;
- same-repository GitHub preview-environment workflow that deploys a fixture Worker, externally smokes its marker, and verifies cleanup.

Still excluded: customer-facing deployment action, arbitrary repository/source fetching, provider bindings/secrets, DNS/custom domains, `*.mkety.app`, production execution and rollback execution.


## Cloudflare Deploy candidate adapter exact verification evidence

Deployments/Cloud candidate adapter PR #77 exact implementation head `c6ba480098fd5e66c768ea0a00a92c3d7b22fad5` passed:

- isolated Cloudflare candidate deploy / external workers.dev smoke / verified cleanup `35382218226`;
- Typecheck `35382218151`;
- Lint `35382218206`;
- Build `35382218169`;
- Cloudflare Vinext Smoke `35382218248`;
- full tests/coverage `35382218166`;
- CI `35382218177`;
- Pull Request Validation `35382218143`;
- MegaLinter `35382218311`;
- CodeQL / PR-level validation `35382214335`.

The verified candidate path is intentionally isolated:
- Worker names are restricted to the `mkety-deploy-candidate-*` namespace;
- execution is blocked for protected or production environments;
- only trusted, size-bounded module artifacts are accepted;
- no Worker bindings or customer secrets are uploaded;
- workers.dev is enabled only for the candidate Worker, with Preview URLs disabled;
- no `mkety.com`, `www.mkety.com`, custom domain, DNS, route, OCI, Coolify, or production Worker mutation exists in this adapter;
- the workflow proved the candidate marker externally and then proved exact Worker deletion.

This slice still exposes no customer-facing deploy action and does not enable production execution. The next Deployments/Cloud step must add an authorized non-production invocation path and audit/approval boundary before any user-triggered provider execution is exposed.

## Public production-readiness hardening before Deploy continuation

Before continuing the next customer-triggered Deployments/Cloud slice, PR #79 (`feat/public-production-readiness`) performed a focused production-readiness audit of Mkety public, authentication, onboarding, SEO, commercial-routing, and Enterprise-payment surfaces.

Exact implementation head verified before this handoff update:

`5bae8019b2deca6630bcfb2fb14fee5a52144ed2`

PR:

`#79 — feat: harden Mkety public production experience`

Implemented and verified:
- restored the exact legacy Mkety logo through a Mkety-owned route and used it across public/auth/onboarding surfaces;
- added a real Mkety signup entry and polished sign-in, organization selection, first-workspace setup, and tenant sign-in;
- kept customer-facing authentication provider-neutral and marked private auth/onboarding/payment routes non-indexable;
- fixed public homepage mobile overflow/truncation and removed template/development language and placeholder branding;
- aligned all public Deploy wording with the currently implemented application/environment/release-configuration/deployment-history foundation, without claiming unimplemented publishing/serverless/domain execution;
- restored the Academy **At Our Hubs** visual cards using the established legacy visual reference set;
- repaired public workspace CTAs that incorrectly targeted nonexistent `/app/ai`, `/app/automation`, and `/app/deploy` routes; public workspace entry now uses the valid authenticated `/app` gateway;
- added Mkety favicon/app manifest, 1200×630 social card, Open Graph/Twitter metadata, canonical metadata, JSON-LD Organization/WebSite data, sitemap/robots hardening, and private-route indexing exclusions;
- removed residual SaaS-template landing copy;
- made the commercial-content repair migration CMS-safe so replaying the root content migrations does not overwrite admin-managed pricing rows;
- preserved Enterprise as Custom: protected administration can issue exact negotiated USD payment links while public customers cannot choose or create arbitrary Enterprise amounts;
- repaired the stale public-candidate workflow gate that had been hard-coded to historical PR #24, so current same-repository public PRs receive real isolated candidate verification without exposing staging secrets to forks.
- serialized the standalone content-DB smoke and public-candidate staging jobs with one shared concurrency group after exact-head verification exposed a real race where both jobs could delete/reseed the same staging CMS rows simultaneously.

Exact implementation-head verification:
- Typecheck `35393687292`;
- Lint `35393687288`;
- Build `35393687466`;
- Cloudflare Vinext Smoke `35393687350`;
- Platform Core Workspaces Smoke `35393687472`;
- Migration Baseline `35393687347`;
- CI `35393687252`;
- Content DB Smoke `35393687399`;
- full tests/coverage `35393687368`;
- Pull Request Validation `35393687423`;
- MegaLinter `35393687372`;
- isolated Public Candidate Deploy / external acceptance `35393687516`.

Candidate evidence from run `35393687516`:
- candidate URL: `https://mkety-public-candidate.dry-glitter-7e16.workers.dev`;
- all required public routes, sitemap, and robots returned HTTP 200 in the external smoke;
- NOWPayments API credentials were accepted by the live API without creating an invoice or payment;
- Enterprise safety smoke confirmed customer-set amounts remain blocked, invalid webhook signatures fail closed, and payment confirmation remains separate from access/entitlement grants;
- Public Mkety AI passed real-provider support, restored-memory, New Chat isolation, canonical commercial grounding, Academy destination, Enterprise-first Trading sales, and private-source boundary checks;
- the pull-request candidate workflow checked GitHub's generated PR merge ref `8b065ce3f7edd477c346234290348321cc417bc6`; the implementation branch head verified above remains `5bae8019b2deca6630bcfb2fb14fee5a52144ed2`.

### Commercial readiness finding

Enterprise negotiated payments are operational through the protected admin-issued exact-amount flow.

Fixed-price self-service plans are **not yet fully purchasable**. The shared Billing domain exists, but its live NOWPayments and Selar `createCheckout` adapters intentionally remain disabled. Public Starter, AI Workspace, Automation Workspace, Deploy Workspace, and Mkety One CTAs therefore route honestly through account onboarding rather than pretending a purchase has completed.

The next production-readiness slice must integrate the existing verified Mkety shared billing-service contract from the managed-hosting billing Worker rather than inventing a parallel checkout architecture. Only after verified settlement flows into Mkety Billing/Entitlements should fixed-price plans be described as live self-service purchases.

No production DNS/custom-domain mutation, production Deploy execution, OCI/Coolify mutation, or customer infrastructure provisioning was introduced by PR #79.

### Exact next order

1. Merge PR #79 after the documentation-only successor head remains green.
2. Implement live fixed-price self-service Billing checkout by reusing the approved shared Mkety billing-service contract and preserving verified/idempotent settlement boundaries.
3. Then resume APP-07 Deployments/Cloud from the already-verified Cloudflare candidate-adapter state: add an authorized non-production customer invocation path with explicit audit/approval boundaries before any production execution work.
