# Mkety repository audit results — 2026-09-30

## Outcome and scope

Repository-wide automated verification plus targeted source, handoff, workflow and Mail protocol review was performed against `65e1fcebefbffa1b9304d86360eeb3a2d0c77faa`. This report does not claim line-by-line review of every file or completion of all production/customer acceptance.

The source inventory contains 28 feature directories and 89 API route files. Current requirements are the newest AGENTS overrides and `docs/handoffs/2026-09-30-final-platform-completion.md`; older Superpowers plans and handoffs are historical implementation records, not permission to rebuild completed services.

## Implemented fixes

| Defect | Change | Regression evidence |
|---|---|---|
| Mail gateway reused Worker database sockets across requests | All five internal Mail routes authenticate the internal secret before entering the existing request-scoped DB lifecycle | Original messages route fails sequential/concurrent tests; corrected route allocates distinct clients, propagates context and closes clients |
| Separate TCP chunks raced authentication and session state | Serialized command drain for each IMAP and SMTP connection | Authentication/envelope and IMAP command-order tests fail before fix, pass after |
| Bare DONE did not complete IDLE | Persist original IDLE tag and handle DONE before normal parsing | Tagged completion regression |
| EXAMINE permitted writes; failed SELECT could become writable | Enforce read-only selection, clear selection before loading and publish selection only after success | EXAMINE/STORE and failed-SELECT tests |
| FLAGS retained omitted flags | Correct replacement, addition and removal semantics | Existing starred flag is cleared by FLAGS(Seen) |
| Backend failures were reported as successful FETCH/STORE | Fail the tagged command when body/write API fails | Rejection tests |
| Size-only FETCH emitted an unsolicited body; INTERNALDATE used HTTP date syntax | Separate size/body requests and format IMAP date-time | Size-only and literal date tests |
| Revocation only affected new logins | Revalidate app-password, active workspace/mailbox and commercial entitlement before authenticated data commands and before SMTP DATA submission | Established-session revocation and mid-DATA revocation tests |
| Date-only values shifted to the previous day on UTC-positive hosts | Construct calendar-date input in UTC consistently with the formatter default | Tokyo, Lagos and Los Angeles subprocess tests |

UIDPLUS is no longer advertised: the gateway does not implement its APPEND/COPY UID response contract. This change does not claim a complete general-purpose IMAP mailstore implementation.

No schema migration, entitlement grant, production flag change, provider credential rotation or production deployment was performed by this branch.

## Verification

- Full source Jest suite: final post-review run passed 237 suites / 1,125 tests.
- Additional scripts test suite: 6/6 passed (`scripts/public-assistant-production-diagnostic.test.ts`); the default Jest roots exclude this directory, so it was run separately.
- Changed-file ESLint: 0 errors / 0 warnings.
- Targeted final regressions: 15/15 passed, including real request-lifecycle behavior with transport/database boundaries doubled.
- TypeScript: final post-review run passed.
- Vinext/Cloudflare build: final post-review run passed.
- Migration baseline: SQL order, Drizzle journal and latest snapshot aligned. No new migration.
- ESLint: 0 errors / 120 warnings at the latest run (baseline 121 warnings). Existing warnings are not claimed to be eliminated.
- Independent review: one important failed-SELECT state finding, reproduced and fixed. Lifecycle coverage was strengthened to exercise the real `withRequestDatabase`, fresh client creation, cleanup and concurrent AsyncLocalStorage isolation.

Local pnpm is 11.25.0 while the repository specifies 10.28.1. The local runner attempted automatic dependency reinstallation when launching tooling. Verification used locked dependencies, direct executable entry points and `pnpm_config_verify_deps_before_run=false`; subprocess/socket-dependent checks used the permitted elevated runtime. No package/lockfile changes are included.

## Current production evidence

| Gate on baseline SHA | Run | Observed state |
|---|---:|---|
| CI | 36681536540 | Success |
| Cloudflare vinext smoke | 36681536508 | Success |
| Mail production | 36681536861 | Success |
| Mail gateway production | 36681536393 | Success |
| Mail functional acceptance | 36683253272 | Failure at IMAP SELECT |
| MegaLinter | 36681536613 | Failure: 9 Checkov and 5 historical Gitleaks findings |

Functional acceptance logs prove direct authorized auth/index succeed, then the TCP gateway receives an index failure. The cross-request database lifecycle defect is reproduced locally and corrected, but only a new production run can establish that it closes the live symptom.

Checkov findings are in the PgBouncer Dockerfiles and network-resolver diagnostic image (root initialization and absent health checks/non-root user). Historical Gitleaks fingerprints identify test fixtures and synthetic acceptance code. These were inspected without printing secret material; they were not blanket-suppressed or declared fully remediated. Docker is unavailable locally, so PgBouncer image/runtime changes cannot be honestly certified here.

Direct live HTTPS probes from this environment receive Cloudflare HTTP 403 / error 1010. Raw-TCP gateway hostname resolution fails locally. Those results block fresh interactive/live acceptance from this runtime; they are not evidence that the actual services are down. Existing production Actions logs remain the available host/infrastructure evidence.

## Integration and secret access

Referenced secret names and workflow use were inventoried. Production Mail/Gateway workflows demonstrate working Coolify, Cloudflare and private-DB access on the baseline. The connected GitHub API can inspect runs and prepare a PR; it does not reveal stored secret values or expose a workflow-dispatch operation. No infrastructure/provider credentials are present in this execution environment. Secrets must remain in repository environments/Worker storage or encrypted platform connections.

## Required completion sequence

1. Certify the audit PR exact head, including isolated candidate tests with repository-managed secrets.
2. Promote the certified merged SHA through guarded Mail application and gateway workflows; require fresh self-cleaning functional acceptance including SELECT/read/SMTP policy/revocation and fixture cleanup.
3. Complete real Mail customer-domain onboarding, inbound/outbound delivery, verified payment-to-entitlement and customer-update suppression acceptance. Only then expose external clients intentionally.
4. Verify authenticated app/admin navigation, platform-control binding and live runtime performance.
5. Complete Enterprise managed Workers AI, external managed provider, BYOK failure isolation, prepaid funding/accounting/provider-cost envelope and durable capacity retry acceptance.
6. Connect the controlled real customer hostname; prove white-label login/handoff and cross-tenant isolation. Complete Starpips Telegram/web/operator-inbox/handoff/accounting acceptance.
7. Intentionally enable production customer inference only after all required evidence succeeds.

Teams inbound/Bot Framework and true standalone Media SSO are explicitly outside the current implemented contract; the current outbound Teams adapter and Media connector must not be represented as those future features. Trading remains an enterprise standalone solution.

## References

- [Baseline Mail functional failure](https://github.com/MketyDigital/mksaas/actions/runs/36683253272)
- [Baseline CI](https://github.com/MketyDigital/mksaas/actions/runs/36681536540)
- [Cloudflare request-scoped connection guidance](https://developers.cloudflare.com/hyperdrive/observability/troubleshooting/)
- `docs/handoffs/2026-09-30-final-platform-completion.md`

## Enterprise AI continuation and production hardening

This section supersedes the earlier local verification/security status for the continuation changes. The b47d581 candidate evidence above belongs to that earlier head; the expanded PR must pass fresh exact-head checks before promotion.

| Reproduced risk | Implemented correction | Coverage |
|---|---|---|
| Customer admin wildcard could authorize global contract/media writes | Require the Platform Control identity/tenant guard before PBAC and target lookup | Wrong tenant, unapproved identity, missing permission and approved operator |
| Funding replay could cross checkout/customer boundaries or revive cancelled/historical access | Bind immutable settlement to its original tenant/subscription/period/quote; serialize period funding and preserve cancellation/current period | Real database settlement, replay, concurrent top-up and failed later top-up tests |
| Prepaid allowance could be granted twice | Exclude prepaid-partial policy from ordinary period allowance grants | Real database credit ledger assertions |
| PostgreSQL aggregate strings broke customer dashboard/top-up arithmetic | Decode aggregate int8 values to BigInt before calculations | Funded billing-state rendering data and remaining top-up checkout |
| Other product subscriptions, missing periods and parallel requests bypassed managed cost limits | Scope Enterprise contract/policy explicitly, enforce half-open period boundaries and fail closed; serialize admission and persist in-flight conservative cost | Real database policy/boundary/concurrent reservation/ambiguous outcome tests |
| Lost queue leases or ambiguous provider outcomes could dispatch twice | Atomically check current ownership and persist reconciliation before chargeable dispatch; only explicit capacity rejection may retry | Stale claimant, cancellation, ownership races, unknown outcomes and reply persistence failure |
| IPv4-mapped IPv6 bypassed private endpoint checks | Deny mapped IPv6 outbound URLs | Canonicalized public/private address regressions |

The regression harness executes production Drizzle queries and transactions against PGlite locally and PostgreSQL in CI. Its dedicated disposable schema includes only the necessary commercial/runtime tables; it is not a full-schema migration certification. The PostgreSQL CI URL guard permits only the local disposable test database. Existing migration consistency remains a separate check. Node's VM module flag is required for PGlite; CommonJS Jest fixtures now use explicit `.cjs` extensions.

Container hardening adds real health probes to PgBouncer, Mail gateway and resolver images and an unprivileged resolver user. PgBouncer retains **three explicit root-bootstrap Checkov exceptions** because initialization writes mounted TLS/config files before `su-exec` drops the database daemon privilege. The scanner exceptions do not prove deployed privilege behavior; image builds and production runtime acceptance remain required. Local Docker Checkov: 486 passed, 0 failed, 3 skipped. GitHub Actions Checkov: 3,552 passed, 0 failed (repository-configured CKV_GHA_7 exclusion retained).

Five historical Gitleaks findings were reviewed as repeated-character test encryption/relay fixtures or public browser storage keys and excluded by exact commit/path/rule/line fingerprint only. No secret values are printed and no blanket source/history allowance was added. Local full-history scan: 4,943 commits, no leaks found after the reviewed exclusions.

Repository import-order cleanup is mechanical. Enterprise settings labels now have explicit accessible names and associated checkbox IDs. Final lint: 0 errors, 11 existing browser-image optimization warnings; zero-warning lint is not claimed.

Final local verification for the expanded changes: 241 source suites / 1,166 tests, six separate script tests, TypeScript, Vinext build and migration consistency must all remain green after final cleanup. Independent read-only review found no remaining critical/important defect and independently ran 41 targeted regressions. New CI also builds all five audited operations images and exercises the commercial tests against actual PostgreSQL. Exact-head remote evidence will be recorded in PR #223.

No production flag enablement, migration, deployment, customer payment, registrar transaction or real-customer domain/channel acceptance is implied by this branch. The required completion sequence above remains binding, including explicit intentional customer-inference enablement after controlled acceptance.

## Complete dependency audit and editor/tooling continuation

The existing nonblocking vulnerability scanners were insufficient for final readiness: a production-only pnpm audit found 96 advisory entries, including 3 critical/42 high. After production patches, the complete build/test graph still reported 73 entries, including one critical. Updated direct dependencies and major-scoped compatible transitive overrides now produce **zero advisories at every severity across the complete lockfile**, using the repository's pinned pnpm 10.28.1. This is an advisory database result, not a claim of freedom from unknown vulnerabilities or proof that each historical advisory was exploitable on the deployed Vinext runtime.

Security fixes cover Next/image binaries, Drizzle, DOMPurify, Tiptap, XML parsing, URL/glob/YAML/Markdown parsing and build/test dependencies. The unused webpack Storybook framework was removed; the configured Vite framework is retained. This removes the unpatched elliptic dependency path rather than excluding it from scans. Obsolete DOMPurify/UUID type stubs were removed. Sharp 0.35 and the legacy esbuild loader are intentional compatibility boundaries: native PNG/WebP/AVIF encode/decode and legacy TypeScript transforms were exercised. Caret refresh also updates next-intl, so full Cloudflare and connected candidate route checks remain required.

New real-component tests reproduced two existing rich-editor defects: controlled external content never applied because it was compared with the same render's initialContent; Link was registered twice by StarterKit and the custom extension. The sync condition now compares to actual editor content and disables the StarterKit copy, preserving custom link policy. Regressions cover externally updated formatted notes without emitting an external-update edit, read-only notes, extension registration, benign rich HTML and removal of executable markup.

Storybook initially failed because it inherited Vinext's server asset-manifest plugins in its browser-only preview. A dedicated minimal Storybook Vite config now isolates the preview and retains explicit source aliases/stubs. The complete component build passes. CI now blocks on the complete dependency audit and the isolated component preview build, alongside actual PostgreSQL race tests and operations image builds.

Final local evidence for this continuation: **244 source suites / 1,174 tests**, six script tests, TypeScript, Vinext/Cloudflare build, component preview build, Drizzle metadata check and migration consistency pass. Lint remains 0 errors / 11 existing browser-image warnings. Independent review passed native images, sanitization, editor and legacy esbuild probes and found no important issue. Exact-head remote results must be taken from PR #223 after this commit; the previous 74fb232 revision's successful CI/MegaLinter/candidate results do not certify dependency changes.

Authoritative security references include the maintained package advisories GHSA-2xp9-vwfh-vxw4 (Next/native image), GHSA-m7jm-9gc2-mpf2 (XML parsing) and GHSA-gpj5-g38j-94v9 (Drizzle). Full pnpm audit is now blocking, so nonblocking MegaLinter vulnerability-tool download problems cannot substitute for a clean dependency result. Guarded production and real-customer acceptance remain outstanding as described above.

## Continuation: public experience and Mail candidate investigation

- The isolated public candidate at prior SHA `116265ff` failed after initial route smoke because the detailed `/mail` content request repeatedly returned HTTP 500. `src/app/(public)/mail/page.tsx` queried the active commercial catalog without a request-scoped database. The page now wraps that read in `withRequestDatabase`; `src/app/(public)/mail/page.test.tsx` reproduces absence of the scope and checks a fresh context for each request. A fresh deployed candidate is still required to confirm the specific HTTP 500 is gone.
- The collapsed, centered transparent public Mkety AI command width was halved (560px maximum to 280px maximum; viewport calculation halved). Its top/inset alignment, transparency and expanded panel were preserved. Its component test checks the new width.
- Seed-owned homepage hero and SEO defaults now lead with business outcomes and route ready buyers through pricing; uncertain visitors can ask Mkety AI. `llms.txt` and the public assistant system prompt carry the same navigation and truthfulness boundaries. Existing admin-edited CMS content is intentionally protected by the seeder and may need a deliberate editorial review/publish in Platform Control; a code default is not proof that every live public page changed.
- Routing source review: pricing self-service CTAs use `/signup?plan=...` and checkout activates only on verified payment; Enterprise and specialized Trading use `/enterprise`; Academy discovery uses `#mkety-ai` and direct Academy access is `academy.mkety.com`; contact uses `/contact#mkety-ai`; standalone Media and Mail use their product surfaces. Automated route contracts cover customer and admin destinations. These are code-level checks, not a complete browser acceptance across signed-in roles.
- Public AI still has its own dynamic provider gateway/adapters, while authenticated Workspace and managed channels call `runCentralAi`. It shares the Mkety model/provider ecosystem in concept, but is not yet a single executable transport. Do not claim the user's central-AI requirement is fully met until the public execution path is consolidated and connected provider/memory/security tests pass. Do not silently switch its tenant identity, billing, prompt isolation or provider fallback behavior.
- Local full Jest run: 243/245 suites passed, 1171/1175 tests. One assistant width expectation was updated and focused rerun passed; three Vite resolver assertions executed `pnpm exec` through system pnpm 11 while repository pins pnpm 10, so the current environment cannot establish that gate. TypeScript `--noEmit` passed. Re-run full suite with the pinned package manager and deploy the exact head through public candidate, security, app and Mail acceptance before declaring production readiness.
- No production inference, live customer onboarding, DNS, Mail gateway or commercial switch has been enabled by this continuation. The prior handoff's controlled sequence and verified customer acceptance remain mandatory. Live secrets were not printed or used as test data.
