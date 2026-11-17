# Mail and Enterprise AI audit handoff — 2026-11-17

## Scope and safety

- Audited the Mail and Enterprise AI workstreams on local branch `codex/audit-mail-enterprise-ai-20261117`, based on `main` at `390c6f6a47fb6b35477196841653a8f3f40e57d4`.
- Read the current workstream status, repository guidance, Mail and Enterprise AI handoffs/plans, production readiness notes, migration and release notes, and the relevant architecture/acceptance docs. `docs/CURRENT_WORKSTREAM_STATUS.md` remains the authority for production state.
- No production or external system was changed: no DNS/MX or Cloudflare actions, secrets, production database or migrations, Worker deployments, Mail client flags, ZITADEL changes, or Enterprise inference enablement. No PR was merged or closed. Assist and sibling app routes were left untouched.
- This handoff records local repository work only. It is not production acceptance evidence.

## Local work completed

- Updated vulnerable dependencies and lockfile, including Next, React/RSC, Storybook, Zod, DOMPurify, AWS SDK, and affected transitive packages. Added scoped overrides for patched transitive packages.
- Aligned the S3 client and presigner versions after type checking exposed a Smithy type mismatch.
- Configured Jest to resolve Node export conditions for server-side AWS modules while retaining the jsdom test environment.
- Mail and Enterprise AI feature code and their production gates were already present on the audited base; no feature code, production flags, migrations, or runtime behavior were changed in this pass.

## Verification

| Check                                     | Result                                                                                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `corepack pnpm audit --audit-level=low`   | Passed; no known vulnerabilities reported after dependency updates                                                            |
| Full Jest suite                           | Passed: 333 suites, 1,541 tests; one suite and one test skipped                                                               |
| Type check                                | Passed after AWS SDK client/presigner alignment                                                                               |
| Lint                                      | Passed with 0 errors and 56 existing warnings                                                                                 |
| `corepack pnpm build`                     | Passed; Vinext completed all five build stages                                                                                |
| `corepack pnpm install --frozen-lockfile` | Passed; lockfile matches the manifest                                                                                         |
| Migration baseline checker                | Passed before dependency-only follow-up changes; no migration files changed                                                   |
| Storybook build                           | Could not complete in this sandbox: Node reported `uv_interface_addresses returned Unknown system error 1` before compilation |
| `git diff --check`                        | Passed                                                                                                                        |

## Mail: local status and remaining production gates

- Mail routes, gateway, migration workflow, sender/recipient controls, and acceptance contracts are implemented and covered by the passing suite.
- The latest checked-in production status is dated 2026-11-03. It says the Mail app and gateway are deployed, but live sending and root-domain cutover are still gated. This audit did not refresh provider/DNS production evidence.
- Do not enable external Mail clients or cut over root MX until SPF, DKIM, and DMARC are verified; first-party SMTP credentials and outbound/inbound delivery are accepted; the imported `hello@` mailbox is reconciled; and rollback is rehearsed. Synthetic customer IMAP/SMTP remains rejected until acceptance.
- Do not generate or rotate the first-party SMTP password before sender authentication is ready and the operator is present.
- A guarded cleanup recovery for an old synthetic fixture was introduced upstream, but this audit did not confirm that the production fixture was removed. Confirm it through the documented guarded workflow before declaring cleanup complete.
- The approved full-domain plan remains the current design. Stale PR #360 describes a conflicting split-routing design and was left untouched.

## Enterprise AI: local status and remaining production gates

- Enterprise AI runtime, commercial controls, provisioning, managed-model parity, and guarded administration are implemented and covered by the passing suite. The central AI runtime parity plan is checked complete.
- Customer inference remains intentionally disabled. The latest checked-in production status requires DomainNameAPI OT&E/lifecycle evidence, a real customer white-label domain and login-isolation acceptance, and a separate explicit inference-enable decision.
- No production inference setting was changed. Keep public AI and its independent routes available while Enterprise inference remains off.

## Next actions

1. Review and merge the local dependency/test-config changes through the normal repository review and release path.
2. Complete Mail provider authentication and first-party end-to-end acceptance, reconcile the imported mailbox, rehearse rollback, and verify any outstanding fixture through the guarded recovery workflow.
3. Complete DomainNameAPI OT&E and customer white-label domain/login-isolation acceptance.
4. Re-read `docs/CURRENT_WORKSTREAM_STATUS.md` and the relevant production handoffs before any separately authorized Mail cutover or Enterprise inference enablement. Record operator evidence there; do not mark those gates complete from this local audit.

## Exact-head CI update — 2026-11-17

- PR #484 was opened at `efcd4547b05ce115abf6e3e8cb5dac30e5d3aee7`. Its initial CI attempt exposed an incomplete uploaded lockfile; the branch was corrected and advanced to `7811c087b66dca08969cafe238cb72be30e8d14c`, with the lockfile blob verified against the local Git object.
- On the corrected exact head, typecheck, lint, build, test, MegaLinter, Cloudflare vinext smoke, content DB smoke, migration baseline, and PR validation passed. The dependency security audit failed because `picomatch@4.0.7` is now reported by GHSA-fc5q-39xc-vjpf (high severity; affected through 4.0.7, with no patched version listed). The local audit predates that advisory update.
- npm's `latest` dist-tag and the upstream release list still resolve to `picomatch@4.0.7`; the GitHub advisory includes that version and supplies no patched version. The related upstream fix proposals remain unmerged, so do not substitute an unreviewed branch or guessed version.
- Per the user's explicit direction on 2026-11-17, proceed with the latest published version while recording this residual advisory as an accepted exception. Keep the dependency audit result visibly failing; do not claim the audit is clean or weaken the audit to conceal the advisory. The audited paths reported by CI are in developer/build tooling.
- The isolated Public Candidate workflow later passed as run `44157671331`. It is not a production deployment and does not enable Enterprise customer inference.
