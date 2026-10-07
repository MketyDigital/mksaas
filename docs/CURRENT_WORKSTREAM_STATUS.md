# 2026-10-07 Mkety Mail rollout — current audit authority

This section supersedes earlier Mail status summaries below where they describe a stale branch, PR, or production state. It keeps first-party Mkety Mail, the Starpips customer pilot, and later internal Enterprise AI acceptance as separate gates.

## Verified current state

- Public copy: the new platform-first Mkety wording is live at `https://mkety.com`; main contains `18d2393a047dc8537189d02eaf293d2dac469949`. No site copy change is needed for this Mail work.
- First-party implementation plan: Tasks 2–7 (SMTP-only reserved credential, queued first-party sender, invitations, operator-only support inbox, producer wiring, and guarded ZITADEL workflow) are marked complete in `docs/superpowers/plans/2026-10-02-mkety-first-party-mail.md`. That is implementation status, not live acceptance.
- First-party plan still open: Task 1's DNS/provider/reserved-workspace preflight; Task 8's sender/DNS readiness, controlled delivery, full signup/recovery/invitation/support acceptance, exact evidence, current complete gates, and integration.
- PR #333 is merged. The older section below that still calls PR #333 active, points to a stale branch/head, or lists its old dependency blocker is historical and must not be used as current release status.
- Enterprise Mail offer work: PR #348 is open at `c7970741d10e5cd1cdc40283fa1797ad3052606e`. The regression-test run `37582110741` intentionally exposed three review gaps (rotation test used stored provider rather than submitted credentials; Enterprise terms lacked `termDays` and linked into self-service checkout; checkout provider failure stranded an awaiting-payment offer). The related lint run `37582110782` found an import-order error in the new test. Typecheck, build, migration baseline, Cloudflare smoke, workspace smoke, Content DB smoke, PR validation and MegaLinter passed on that pre-fix head. Candidate fixes are being applied; these results do not certify the fixed head. Public Candidate Deploy failed because its test step hit the same red regressions and performed no deployment.
- Production readiness evidence available so far is limited to health/host/API checks and TLS reachability. It does not establish that the reserved mailbox/credential is ready, that ZITADEL signup or recovery mail is delivered, or that a customer IMAP/SMTP journey is accepted. Customer external Mail clients remain disabled.
- Starpips plan: all tasks remain open. No approved Starpips price, term, limits, billing contact, customer-owned domain, verified settlement, or customer acceptance has been established by the evidence in this audit. Do not create a checkout or entitlement before those terms and provider settlement are confirmed.
- AI sequence: the internal Mkety Enterprise AI acceptance in the Starpips plan starts only after Starpips Mail acceptance. Production customer inference stays disabled.

## Exact next sequence

1. Complete the reviewed PR #348 corrections and pass exact-head repository, migration, and applicable Cloudflare checks. Review the resulting head before integration.
2. Complete the read-only first-party Mail preflight; record DNS/MX ownership, reserved workspace/mailbox/credential status, ZITADEL provider, and actual producer inventory without exposing secrets. Do not alter DNS while ownership/readiness is unresolved.
3. Test controlled first-party delivery and complete signup, recovery, invitation, billing notification, and operator-only support paths. Keep Brevo available until Mail-backed auth acceptance passes.
4. Inspect Starpips' approved agreement and account using read-only controls. Stop without checkout if exact customer, price, currency, term, included limits, verified billing contact, domain, or payment route is missing.
5. After provider-verified settlement, configure Starpips' customer-owned domain and verify the contracted Mail journey: login, mailbox/team, send, reply/inbound, quotas, suppressions, billing and isolation. Record exact SHA, run IDs and settlement reference without unnecessary personal data.
6. Only after those Starpips acceptance facts are recorded, run the isolated internal Mkety Enterprise AI acceptance and record fixture cleanup/accounting evidence. Keep production inference disabled.


