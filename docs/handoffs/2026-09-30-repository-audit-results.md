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
