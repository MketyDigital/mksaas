# Mkety production promotion progress — 2026-09-30

This newer handoff supersedes the pre-merge and pre-promotion state in `2026-09-30-current-mksaas-handoff.md`. Read `AGENTS.md`, `2026-09-30-repository-audit-results.md`, `2026-09-30-final-platform-completion.md` and `../MKETY_MAIL_ENTERPRISE_AI_CUSTOMER_SETUP_RUNBOOK.md` for architecture and customer gates.

## Exact code and production evidence

- PR #223 merged as `af37dca14c3712887df8d8885d1af21a0b81a3a7`, with the same tree as certified PR head `9c0c1d806d4680557031caa4c9fecd386bbdc697`. Its PR CI, build, lint, typecheck, tests (including real PostgreSQL editorial concurrency), migration baseline, Cloudflare smoke, MegaLinter and Public Candidate run `36729259627` passed. Main CI, build, lint, typecheck, tests, Cloudflare smoke and CodeQL passed.
- [App Host Production Repair 36738352148](https://github.com/MketyDigital/mksaas/actions/runs/36738352148) succeeded on `af37dca1`; host and branded auth handoff checks passed.
- [Mail Production 36738755076](https://github.com/MketyDigital/mksaas/actions/runs/36738755076) succeeded on `af37dca1`; production migration `0036_platform_editorial_drafts`, content/Billing seed, shared Worker deploy and production smoke passed.
- [Mail Gateway Production 36739410624](https://github.com/MketyDigital/mksaas/actions/runs/36739410624) succeeded on `af37dca1` with public protocol/TLS checks.
- PR #224 merged as current main `4508e116519e4950feeaaac4c0e41e6f401c7912`. Its only changed files are the Mail functional acceptance workflow and contract test. The workflow now accepts manually authorized Gateway releases while preserving success, repository, SHA ancestry and narrow changed-path gates. Its exact-head PR CI, build, lint, typecheck, tests, Cloudflare smoke, MegaLinter and independent review passed. Main CI, build, lint, typecheck, tests, Cloudflare smoke and CodeQL passed.
- [Mail Gateway Functional Acceptance 36741052849](https://github.com/MketyDigital/mksaas/actions/runs/36741052849) succeeded on `4508e116`. The isolated fixture proved direct Gateway API auth; real TLS IMAP login, list, select, read and message body; SMTP app-password auth and submission reaching the expected recipient suppression policy; credential revocation and rejection; and cleanup. The SMTP recipient was intentionally suppressed, so this is not a real outbound delivery proof.
- [Enterprise AI Production 36746234704](https://github.com/MketyDigital/mksaas/actions/runs/36746234704) succeeded on exact main `4508e116`: authorization, production DB migration and `deploy-ai` all passed. This is guarded infrastructure promotion and fail-closed smoke, not customer inference enablement. Customer inference remains OFF.

Main-push MegaLinter fails in full-codebase mode on historical actionlint/ShellCheck diagnostics, including invalid heredocs in old diagnostic workflows. Changed-file PR MegaLinter passed. Do not state the whole-codebase lint debt is clean.

## Gates that remain closed

| Area | Required customer-path proof |
| --- | --- |
| Public/auth/app/admin | Inspect live canonical public hosts, copy/plans/legal and support/AI/payment routes; sign in as member, tenant admin and approved Platform Control operator; exercise dashboard navigation, cross-role denial, and admin draft/save/reopen/publish/rollback. Earlier direct probes from this workspace returned Cloudflare 1010, a vantage limitation rather than outage evidence. The initial public cutover workflow targets an obsolete branch and rejects already bound routes; do not use it on the live site. |
| Mail external clients | Controlled paid customer checkout-to-entitlement, domain provisioning, actual inbound and outbound delivery, suspended/revoked established-session denial and cleanup. Then intentionally enable `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED`. Synthetic acceptance does not prove those paths. |
| Enterprise AI customer inference | Managed Workers AI, external system provider, BYOK failure isolation, credits/budget/provider-cost/profit, durable retries, tenant/domain/white-label isolation, and controlled Starpips web/Telegram/operator handoff/accounting. Only then use the guarded inference promotion to enable `customerInferenceEnabled` and onboard outside customers. |

Platform Control supports broad staged editorial, navigation, pricing presentation, docs and support guidance changes. Protected access rules, secrets, settlement and executable runtime changes remain guarded; universal no-code mutation is not a verified capability. Media, Trading, Academy and MKLMS retain separate product/runtime authorities. No waiting customer was onboarded or messaged in this workstream. Repository secret values were not read or copied into this handoff.

## Next sequence

1. Complete public/auth/app/admin live role and route matrix and Platform Control edit/publish/rollback.
2. Complete the Mail real customer commerce/domain/send/receive/suspension test, then decide explicitly whether to enable external clients.
3. Complete Enterprise AI provider/commercial/isolation/Starpips acceptance, then decide explicitly whether to enable customer inference.
4. Reconcile full-codebase MegaLinter debt without weakening blocking security checks. Append exact run, flags and customer-path evidence to `AGENTS.md`, `docs/CURRENT_WORKSTREAM_STATUS.md`, `docs/MKETY_DEVELOPMENT_CONTINUATION.md` and the product runbook.

Green code checks and infrastructure deployment do not certify every production customer behavior. A failed gate stops its dependent enablement.
