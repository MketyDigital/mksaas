# 2026-10-10 Mkety Mail production follow-up

The Mail production secret-targeting fix is merged as `66d7d4d67bde875b9547a688afcbade95ca14567` (PR #369). Guarded Mail Production run #75 completed successfully for that exact SHA, including production DB migration, app build/deploy, Mail Worker deploy, top-level secret attachment and name verification, custom-domain reconciliation, and smoke checks: https://github.com/MketyDigital/mksaas/actions/runs/38071466955

Production debugging found why the Ops bootstrap reported a missing tenant: `app.mkety.com` runs on the separate `mkety-app-host` Worker, while the earlier Mail release attached the setting only to `mkety-platform`. PR #371 (`28a7b9ca7c435eb0abccddc7c1fc10f0c60cdc2c`) now attaches and verifies the masked tenant binding on both Workers. All PR checks passed. Guarded Mail Production run #76 succeeded for exact main SHA `54e3ffc74ef0f33ac5c39ce6b31b219fbc39f9fd`: production DB migration/readiness lookup, app and Mail Worker deploys, top-level secret attachment, app-host binding verification, custom-domain reconciliation, and Mail smoke all passed: https://github.com/MketyDigital/mksaas/actions/runs/38074269648

The run confirms the tenant binding is present on the app-host Worker; it does not bootstrap the Mail workspace. Its preflight still reported `workspace=missing` and root sending authentication/domain/mailboxes as missing or disabled. The Ops bootstrap action can now resolve its configured tenant, but its successful completion has not yet been observed. No test routes or inboxes were created.

No root MX or Zoho settings were changed, no test message was sent, and no Zoho import was started. The importer remains provider-neutral; the only current source mailbox to import is Zoho `hello@mkety.com`, once, into Mkety `hello@`. Current aliases are not separate imports. Assist and standalone Assist paths remain out of scope.

**Next required work:** confirm the reserved internal Mail workspace bootstrap in Ops; create distinct active `hello@`, `cloudflare@`, `billing@`, `info@`, and `support@` mailboxes; verify root sending authentication; import and reconcile the single Zoho `hello@` mailbox (the user will perform the import); then test send/receive for every mailbox through the temporary `mail.mkety.com` routes and rehearse rollback. Keep root MX on Zoho until all cutover gates are evidenced.

---

# 2026-10-09 Mkety full-domain mail move — design review

The user has selected a simpler target: host all `@mkety.com` mailboxes in Mkety Mail, including separate `hello@mkety.com`, `cloudflare@mkety.com`, and `billing@mkety.com` mailboxes, with `info@` and `support@` included. Zoho currently has only one mailbox, `hello@`; all other addresses are aliases forwarding into it, so its history is imported once into `hello@` and not duplicated. A provider-neutral history importer must support generic IMAP sources (including Zoho when available and Spaceship Spacemail) plus portable archives. The root MX cutover is gated on mailbox setup, reconciled imports, real inbound/outbound delivery checks, and rollback readiness.

Approved design: `docs/superpowers/specs/2026-10-09-mkety-full-domain-mail-cutover-design.md`. Implementation plan: `docs/superpowers/plans/2026-10-09-mkety-full-domain-mail.md`. PR #368 is based on current `main` at `82008e3a28fea6593fc0548336bc769aa8719155`; its code branch is `feat/mkety-full-domain-mail-migration`. The existing `feat/mkety-root-mail-address-split` branch is not being overwritten. The PR changes no `customer-apps/assist` paths. Code includes the single-source Zoho import, generic resumable IMAP/archive paths, temporary `mail.mkety.com` test routes, one apex Worker catch-all, guarded cutover/rollback actions, and separate mailbox provisioning. The IMAP Worker checks the resolved TLS peer address before sending credentials; Cloudflare's socket runtime rejects private and Cloudflare-owned destinations. The worker also uses linear folder-list parsing and exact Cloudflare MX hostname validation. The test encryption fixture is now generated at runtime; the exact historical synthetic-key fingerprint is allowlisted. On code commit `e6205b7b85577293f2f0aad13f6ad9b11bcb6524`, exact-head checks passed for CI, test workflow, type-check, lint, build, MegaLinter, migration baseline, Cloudflare/vinext smoke, Platform Core smoke, Mail live-readiness HTTP/TLS diagnostics, PR validation, the staging content DB smoke, and the isolated Workers.dev candidate deployment. The Mail and internal Mail API Jest suites passed 153 tests across 30 suites locally. The full repository Jest run on an earlier candidate had 295 suites pass and 1 skip; 7 tests in 2 unrelated subprocess suites failed because child Node processes were blocked with `EPERM`. **No Cloudflare root DNS, Zoho settings, production database, or ZITADEL configuration has been changed.**

The code phase is ready for real acceptance; production cutover is still blocked on read-only inventory, importing and reconciling the one Zoho `hello@` mailbox, verified send/receive for every root mailbox, a final `hello@` delta, and rollback rehearsal. Keep root MX on Zoho until those live checks have evidence in Ops. The historical address-split proposal immediately below is superseded as the target architecture.

## Historical address-split proposal — superseded

This amendment supersedes the address-routing decision in the 2026-10-08 section below. The intended split is `hello@mkety.com` in Zoho and `info@mkety.com`, `support@mkety.com`, and other explicitly provisioned root mailboxes in Mkety Mail. Root Zoho MX and DMARC remain unchanged. Cloudflare Email Routing stays off at the apex; root Cloudflare Email Sending is allowed only for the reserved first-party tenant after DNS verification. Zoho selectively forwards Mkety root mailboxes to exact `mail.mkety.com` Worker routes, which map to canonical root mailboxes.

Implementation branch `feat/mkety-root-mail-address-split` is based on current `main` commit `5a537a6f7066bd513394b386b257e20a5bb82690`; it contains no `customer-apps/assist` changes. The branch adds root-only sender policy, exact ingress alias records/resolution, Ops route setup, no-catch-all protections, and updates the ZITADEL sender and Reply-To. Local evidence: 66 focused Mail tests pass; type-check, ESLint (0 errors; existing warnings), Vinext build, migration baseline, and `git diff --check` pass. Full Jest reports 289 suites passed, 1 skipped, and 2 unrelated child-process suites failing 7 tests (`vite-runtime-alias` resolver outputs and timezone utility subprocesses blocked with `EPERM`); rerun exact-head CI before merge. The production deployment remains PR #355 at `c78a127b183ac9c775e3a480ff59a922be1de6d6` until this branch is reviewed, certified, merged, and deployed.

Still open: fresh CI on this candidate, production root sending authentication, reserved root mailboxes and SMTP credential, Cloudflare `mail.mkety.com` inbound route, Zoho verified forwards, actual app queue/gateway and ZITADEL tests, and a support receive/reply round trip. No DNS, production database, Zoho, Cloudflare, or ZITADEL configuration was changed by this branch.

# 2026-10-08 Mkety Mail rollout — production evidence

This section supersedes earlier Mail status summaries below where they describe a stale branch, PR, or production state. First-party Mkety Mail, the Starpips customer pilot, and later internal Enterprise AI acceptance are separate gates.

## Verified state and plan reconciliation

### Latest Mail release checkpoint — 2026-10-08

- PR #355 merged as `c78a127b183ac9c775e3a480ff59a922be1de6d6` after exact-head verification on `5c42682d486ab87530858116224c05178686c243`. CI `37749645114`, tests `37749645240`, typecheck `37749645133`, build `37749645113`, lint `37749645119`, MegaLinter `37749645073`, migration baseline `37749645184`, Cloudflare/vinext smoke `37749645097`, Danger `37749645078`, and isolated candidate `37749645086` passed. Candidate staging DB, route/copy, payment-safety, and AI privacy smokes passed; managed-AI acceptance fixture remained skipped.
- Mail Production run `37750898634` succeeded on the exact merge SHA: production migration, app deploy, R2/queues, Mail workers, runtime secrets, application domains, and production smoke all passed.
- Production readiness reporting from that run found the reserved first-party workspace/domain missing, sending disabled, SPF/DKIM/DMARC missing in the app's sender record, and the `info` mailbox missing. The successful release deploy therefore does not mean the app sender is provisioned or that app transactional mail is ready.
- The user confirmed receipt in the Zoho inbox of the controlled Cloudflare message from `info@mail.mkety.com` to `hello@mkety.com` (run `37742278847`). This proves one direct delivery only. Apex Zoho MX and root DMARC remain unchanged; Cloudflare Email Sending is isolated to `mail.mkety.com`.
- ZITADEL reconcile run `37750898167` ended `action_required` with no jobs. No ZITADEL provider change occurred; Brevo remains active until the reserved Mkety sender credentials and end-to-end signup/recovery/invitation/notification tests pass.
- Starpips remains blocked on an approved offer/agreement and verified terms, billing contact, customer domain, payment route/settlement and acceptance. The internal Enterprise AI acceptance stays downstream of completed Starpips Mail acceptance.
- Exact next order: provision the reserved first-party workspace/domain/mailbox through the guarded Ops path; pass live readiness; issue its SMTP-only credential; verify app queue/gateway and ZITADEL auth/support flows; then complete Starpips's approved contract and Mail acceptance; only then run internal AI acceptance.


- Public copy: the new platform-first Mkety wording is live at `https://mkety.com`; current public main includes `18d2393a047dc8537189d02eaf293d2dac469949`. No site-copy change is part of this Mail release.
- First-party implementation plan: Tasks 2–7 (SMTP-only reserved credential, queued first-party sender, invitations, operator-only support inbox, producer wiring and guarded ZITADEL reconciliation) are checked complete in `docs/superpowers/plans/2026-10-02-mkety-first-party-mail.md`. Those checks describe code implementation, not live delivery acceptance.
- First-party work still open: Task 1 DNS/provider inventory is captured, but reserved tenant/workspace/domain/mailbox/app-credential evidence is still missing. Task 8 Step 2 now records one Cloudflare test message confirmed received at Zoho; production app sender readiness remains missing. Task 8 Steps 3–4 (application/gateway/ZITADEL delivery, signup/recovery/invitation/notifications/support acceptance) remain open. Repository integration is complete through PR #355.
- PR #333 is merged. Older status sections below that call it active or cite its historical head, base, or dependency blocker are not current release status.
- PR #348 merged into `main` as merge commit `403b8cf7ea65d5795ba21c8127022259b66774d7` after exact branch-head checks and candidate validation passed. The PR branch had merged current main `9ebe54e71be2e10e5f33c59e5f8a7dc066413001` non-force through `564c952fdb4ca2f3e660807e2c8f9d4a28fd9c13`; the final PR diff contained 41 paths and no `customer-apps/assist` files. The merge commit message has no `[mail-production]` authorization marker, so it does not authorize production Mail deployment.
- The merged code contains the reviewed fixes for ZITADEL SMTP credential reconciliation, Enterprise Mail currency/term presentation and checkout routing, failed-offer cleanup, internal bootstrap idempotency retry, and serialized mailbox/shared-inbox/seat quota enforcement. An independent follow-up code review found no remaining actionable quota issue. GitHub Danger validation passed at branch head `a8ad556fb46c3ed3adfe34e5e139fb47247d0857`; no GitHub PR review submission was recorded.
- Follow-up seat-quota fix at code head `d23edfae53fbf7d085bdb8ad3584f8691211d232`: mailbox creation and shared-thread assignment now use the same tenant-scoped PostgreSQL transaction lock, recheck mailbox/shared-inbox quotas inside the lock, and count distinct users across mailbox membership and shared-inbox assignments. Existing assignees reuse seats. A pure helper has focused tests for reuse, limits, deduplication, free seats and uncapped internal plans. Independent code review found no remaining actionable issue in these quota paths.
- Final docs-updated PR head `a8ad556fb46c3ed3adfe34e5e139fb47247d0857` passed CI `37687589377`, tests `37687588714`, typecheck `37687588842`, build `37687588821`, lint `37687588940`, MegaLinter `37687588916`, migration baseline `37687588738`, Cloudflare vinext `37687589188`, Platform Core workspace smoke `37687588850`, PR validation/Danger `37687589086`, Public AI Provider Probe `37687588995`, and isolated Public Candidate Deploy `37687589165`. Candidate DB verification and route/copy, payment safety, and Public Mkety AI privacy smokes passed; managed-AI acceptance fixture/step was skipped by guard and cleanup succeeded. Separate Content DB Smoke `37687588780` was cancelled by concurrency while the candidate performed the connected DB check. Production Routing Preflight `37687588918` was skipped. These are PR-head checks; the merge commit itself is not claimed as separately verified by those run IDs.
- Exact code-head verification at `d23edfae53fbf7d085bdb8ad3584f8691211d232`: CI `37684909121`, tests `37684909096`, typecheck `37684909185`, build `37684909826`, lint `37684909203`, MegaLinter `37684909083`, migration baseline `37684909111`, Cloudflare vinext smoke `37684909209`, Platform Core workspaces smoke `37684909152`, PR validation `37684909145`, Public AI provider probe `37684909254`, and isolated Public Candidate Deploy `37684909178` succeeded. Candidate staging content-database verification passed; the separate Content DB Smoke `37684909317` was cancelled. Managed-AI commercial fixture/acceptance steps were skipped by their guard and cleanup succeeded. Production Routing Preflight `37684909210` was skipped.
- Starpips agreement search: connected Gmail and Drive searches did not locate an approved Mail agreement or offer. Contract price/currency/term/limits, verified billing contact, customer-owned domain, settlement and customer acceptance therefore remain unverified. Do not infer terms from unrelated legacy business documents.
- Cloudflare repo-secret read-only inventory run `37741950105` confirmed root MX is exactly Zoho (`mx.zoho.com`, `mx2.zoho.com`, `mx3.zoho.com`), root DMARC is `p=none`, and neither apex nor `mail.mkety.com` had Cloudflare Sending configured. Safe Email Sending setup run `37742125709` enabled only `mail.mkety.com`; Cloudflare created bounce MX/SPF/DKIM and `_dmarc.mail.mkety.com` with `p=reject`. The workflow verified root Zoho MX and root DMARC unchanged. Controlled send run `37742278847` from `info@mail.mkety.com` to `hello@mkety.com` with Reply-To `hello@mkety.com` was accepted into Cloudflare's queue; The user confirmed receipt in the Zoho inbox on 2026-10-08 for that controlled test only. No root DNS changes, Email Routing changes, or ZITADEL provider changes were made.
- PR template gate: Danger initially failed at head `3ef15fba72fb6fbe3c0c6a0c671670cc6a0c3607` because the description omitted three required sections. The body was corrected, and Danger passed on final PR head `a8ad556fb46c3ed3adfe34e5e139fb47247d0857` in PR validation run `37687589086`.
- The candidate workflow’s internal Enterprise AI fixture now runs only for a manual dispatch with `run_enterprise_ai_acceptance=true`; its default is false, and fixture cleanup remains unconditional. Automatic PR candidate validation cannot start internal Enterprise AI acceptance before Starpips Mail.
- TDD evidence: pre-fix run `37583062404` on intermediate head `2dfaf8dc173ee97be1edb8c0df42b949d529e3b0` confirmed the Enterprise formatter signature and acceptance-order guard were missing; the corrected code was tested on `436491f29cbcc20528803d89dacff4d3eb767d43`. That code head passed CI `37600084253`, tests `37600084115`, typecheck `37600084359`, lint `37600084167`, build `37600084541`, MegaLinter `37600083975`, migration baseline `37600084095`, Cloudflare vinext `37600083936`, workspace smoke `37600084531`, PR validation `37600084145`, Public AI Provider Probe `37600083980`, and candidate `37600084151`. Content DB smoke `37600084013` was cancelled, while connected Content DB verification within the candidate passed. These runs predate the current-main merge and subsequent documentation update; rerun exact-head checks before merge.
- Production readiness evidence remains limited to health/host/API checks and TLS reachability. It does not prove reserved-mailbox credential readiness or delivery through ZITADEL signup/recovery. Customer external Mail clients remain disabled.
- Fresh production read-only checks on main at `48142e2001cf770141d9ecd51cb16c65852f2bbb`: Mail Live Readiness `37597717874` succeeded (health 200; Mail redirects 307; public page 200; autoconfig 503; unauthenticated Mail APIs 401; IMAP 993 and SMTP 465 TLS reachable). ZITADEL Registration Diagnostic `37598077167` succeeded. New Cloudflare/ZITADEL preflight run `37682717115` succeeded on audit branch commit `4ab11a7b1fe2c78c285fe7398c5258032ca2974c` and made no changes: apex SPF absent; MX points to Zoho; DMARC is `p=none`; a Resend DKIM record exists; `imap`/`smtp` are DNS-only at `89.168.70.209`, while `mail`/`autoconfig`/`autodiscover` AAAA `100::` are proxied. Cloudflare Email Routing settings returned 403, so its enabled status is unknown. ZITADEL's active SMTP provider is Brevo at `smtp-relay.brevo.com:587`, sender `hello@mkety.com`, TLS enabled, with a configured user; no password was returned. Registration, local authentication and username/password are enabled. The reserved Mail tenant/workspace/domain/mailbox/SMTP credential and actual delivery still lack evidence.
- Starpips plan: all tasks remain open. This audit has not established the approved customer identity, contract price/currency/term/limits, verified billing contact, customer-owned domain, verified settlement, or customer acceptance. Do not create a checkout or entitlement until those commercial facts are confirmed and payment settles through the provider.
- Enterprise AI sequence: internal Mkety acceptance follows completed Starpips Mail acceptance. Production customer inference remains disabled.

- User clarified the live support mailbox `hello@mkety.com` is Zoho Free Mail and must remain working. Cloudflare Email Sending is enabled only for `mail.mkety.com` in run `37742125709`; its bounce MX/SPF/DKIM and subdomain DMARC passed the controlled DNS gate in run `37742278847`, while apex Zoho MX and apex DMARC stayed byte-for-byte unchanged. The user confirmed receipt in the Zoho inbox on 2026-10-08 for that controlled test; it does not prove application-gateway or ZITADEL delivery.
- PR #355 (`codex/mail-zoho-safe-sending-domain`) at implementation head `60963ce418314e474ada23b0dc24d561fa33121d` rejects `mkety.com` before Cloudflare provisioning, reserves `mail.mkety.com` to the configured first-party tenant, and verifies expected public SPF, DKIM and DMARC before setting first-party sender readiness. Ops repeats the live check; the first-party credential and sender paths accept only `sending_ready`. Independent review found no active path that can newly set first-party readiness without DNS proof. Review caveats: existing persisted `sending_ready` rows from older code are not invalidated, and there is no direct action-level regression test for the Ops live-DNS/reject-`verified` branches.
- Exact-head verification on `60963ce418314e474ada23b0dc24d561fa33121d`: CI `37746668697`, Run tests `37746668751`, typecheck `37746668787`, build `37746668675`, lint `37746668747`, MegaLinter `37746668923`, migration baseline `37746668903`, Cloudflare/vinext smoke `37746668728`, PR validation workflow `37746668723`, Public AI Provider Probe `37746668844`, and isolated Public Candidate Deploy `37746668799` all succeeded. Candidate staging database verification and route/copy, payment-safety, and Public Mkety AI privacy smokes passed; managed-AI commercial acceptance was skipped by guard and cleanup succeeded. Separate Content DB Smoke `37746668878` was cancelled while candidate verification covered the connected database.
- PR #355's corrected description passed fresh Danger on exact PR head `5c42682d486ab87530858116224c05178686c243` in run `37749645078`; that head also passed CI/tests/build/typecheck/lint/MegaLinter/migration/Cloudflare smoke and isolated candidate `37749645086`.
- Production Mail run `37750898634` succeeded on merge SHA `c78a127b183ac9c775e3a480ff59a922be1de6d6`: exact app deploy, migrations, queues/R2, mail workers, runtime secrets, Mail domains and production smoke passed. Its internal first-party readiness report still said workspace/domain missing, sending disabled, SPF/DKIM/DMARC missing and `info` mailbox missing. Root Zoho MX and DMARC stayed unchanged. The user confirmed the Cloudflare controlled send reached Zoho, but app/gateway/ZITADEL signup, recovery, invitation, notifications and support acceptance remain open.
- Merge commit `c78a127b183ac9c775e3a480ff59a922be1de6d6` triggered Mail Production run `37750898634`. ZITADEL reconcile run `37750898167` ended `action_required` with no jobs, so Brevo remains active. The next task is to provision the reserved first-party workspace/domain/mailbox through the guarded Ops path, verify internal readiness, issue the SMTP-only credential, and complete app/ZITADEL delivery acceptance before retiring Brevo. Starpips remains blocked on an approved offer/agreement, commercial terms, verified billing contact/domain/payment route and acceptance; internal AI acceptance remains after Starpips Mail.

## Exact next sequence

1. After the guarded Mail release and exact-head checks, complete the reserved-workspace/mailbox read-only check. Require the isolated sender domain, mailbox and SPF/DKIM/DMARC plus gateway readiness before issuing a first-party credential. Separately confirm root Zoho MX remains unchanged for inbound support; apex MX is not an outbound-sender readiness requirement.
2. Test controlled first-party delivery and complete signup, recovery, invitation, billing-notification and operator-only support paths. Retain Brevo rollback until Mail-backed auth acceptance passes.
3. Inspect Starpips' approved agreement/account using read-only controls. Stop without checkout if customer, approved price, currency, term, limits, verified contact, domain or payment route is missing.
4. After provider-verified settlement, configure Starpips' customer-owned domain and verify login, mailbox/team, send, reply/inbound, quotas, suppressions, billing and tenant isolation. Record exact release SHA, run IDs and settlement reference without unnecessary personal data.
5. Only after Starpips acceptance is recorded, manually run the isolated internal Mkety Enterprise AI acceptance; record accounting and fixture-cleanup evidence and keep production inference disabled.


<!-- Historical checkpoint; superseded by the Oct 7 section above. Its PR, branch, and blocker details describe the Oct 3 state only. -->

# 2026-10-03 first-party Mail and checkout — current resume authority

This section supersedes the older platform-completion and production-promotion summaries below for the active Mkety Mail / checkout workstream. Historical entries remain useful context but describe earlier repository states.

- Active PR: [#333](https://github.com/MketyDigital/mksaas/pull/333), branch `codex/mkety-first-party-mail-20261002`, current code head `5c1ee4b08e29617657d4c724f3d877f381a97f06`, based on production main `65493225017a358ad5fcd9c8ffd58c57c73b9ca7`.
- Completed in code: account-bound checkout foundations, first-party SMTP-only credential creation and atomic rotation, platform invitation sending, normalized Flutterwave FX readiness, and a safe legacy ZITADEL SMTP overwrite guard. The production workflow now validates and correctly masks the reserved Mail tenant binding before release/deploy work.
- Current-head verification: GitHub tests, typecheck, build, lint, MegaLinter, PR validation, migration baseline, Mail readiness, staging Content DB smoke, Cloudflare smoke, Public AI provider probe, and Platform Core workspace smoke succeeded. The dependency audit fails on high-severity GHSA-vfj7-8cjw-p6xm in `braces <=3.0.3`, reached through the dev-only Next ESLint toolchain. GitHub currently lists no patched version; the upstream fix remains unmerged. No dependency override or audit waiver was added. Do not merge while this required gate is failing without a reviewed remediation or explicit repository-owner risk decision.
- The isolated Public Candidate Deploy is cancelled before its first step on the current head. No fresh candidate deployment is certified for this head.
- No production deployment, DNS/MX/TXT change, or payment charge occurred in this workstream. Root DNS, reserved-tenant secret presence, active `info@mkety.com` mailbox/domain readiness, controlled SMTP delivery, and ZITADEL/account/support acceptance remain unverified.
- Customer external Mail clients and production Enterprise AI inference remain disabled. Starpips is the first paid Enterprise Mail pilot. Only after Starpips accepts Mail should MKETY use its own internal system for Enterprise AI acceptance; that test does not enable production Enterprise AI inference.

## Next exact sequence

1. Resolve the upstream `braces` advisory with a reviewed, tested patch/release; keep the dependency-audit gate intact.
2. Re-run all exact-head Actions, including the isolated Public Candidate Deploy, and require success.
3. Complete read-only DNS/provider/tenant preflight. Verify the reserved Mail tenant binding and `info@mail.mkety.com` readiness on isolated sending DNS before any DNS or provider mutation.
4. Perform guarded first-party SMTP delivery, ZITADEL, login, invitation, recovery, and support-path acceptance with controlled recipients.
5. Complete Starpips' contracted Mail purchase, domain onboarding, send/receive, team, and billing acceptance; record the customer's acceptance and exact evidence.
6. Only after Starpips Mail acceptance, run the isolated internal MKETY Enterprise AI acceptance and record cleanup evidence. Keep production Enterprise AI inference off.
7. Update the active plans and this handoff with evidence before considering production promotion.

---

# 2026-09-30 exact-main production promotion update

Current main is `4508e116519e4950feeaaac4c0e41e6f401c7912` after PRs #223 and #224. App Host Repair `36738352148`, Mail Production `36738755076`, Mail Gateway Production `36739410624`, real synthetic IMAP/SMTP/revocation acceptance `36741052849`, and Enterprise AI Production `36746234704` all succeeded. Production migration `0036_platform_editorial_drafts` was applied. Enterprise AI promotion included exact-SHA authorization, production migration, application/delivery Worker deployment, domain attachment and fail-closed smoke. See `docs/handoffs/2026-09-30-production-promotion-progress.md` for scope and limits; it supersedes the older failed IMAP SELECT and unmerged-branch state below.

External Mail clients and Enterprise AI customer inference remain OFF. Controlled real customer Mail commerce/domain/send/receive/suspension and Enterprise provider/commercial/tenant/white-label/Starpips paths are required before enablement. Public/auth/app/admin signed-in role and no-code publish/rollback checks remain. Main-push MegaLinter still reports historical whole-codebase actionlint/ShellCheck debt although changed-file PR MegaLinter passed.

---

# 2026-09-30 repository audit — current resume authority

This section supersedes older implementation/production status below.

- Audited remote baseline: `65e1fcebefbffa1b9304d86360eeb3a2d0c77faa`.
- Exact-main CI `36681536540`, Mail Production `36681536861`, and Mail Gateway Production `36681536393` succeeded.
- Mail functional acceptance `36683253272` FAILED: direct authentication and direct message index succeeded, but real IMAP SELECT failed with `message_index_failed:Error`. Infrastructure acceptance is not customer acceptance.
- The audit branch fixes request-scoped database lifecycle for all five Mail gateway APIs; serialized IMAP/SMTP command handling; IDLE termination; read-only/failure-state selection; flag replacement and backend failure handling; size-only FETCH and IMAP dates; and authorization revalidation on established connections and before SMTP submission.
- Calendar-date formatting now preserves the intended UTC day on hosts in different time zones.
- Local full verification and limitations are recorded in `docs/handoffs/2026-09-30-repository-audit-results.md`. This is repository verification, not production certification of the audit branch.
- External Mail clients and production Enterprise customer inference remain gated. Real Mail domain/send/receive, white-label hostname/login isolation, Enterprise commercial/channel/BYOK/provider acceptance, and controlled Starpips acceptance remain required.
- Existing PR #222 is a separate gateway-concurrency change. Do not merge stale branches or interrupt an exact-main release merely to bundle it into this audit.

Resume with the audit PR exact-head CI/candidate verification, then guarded exact-SHA Mail application/gateway deployment and self-cleaning functional acceptance. After that, follow `docs/handoffs/2026-09-30-final-platform-completion.md` in order. Never label the whole platform complete from the local tests alone.

---

# 2026-09-29 production Mail accepted — external-client gateway workstream

**Current production main:** `455a1359cbde16d9eae34b6683c19cb4088d481e`.

## Current authoritative truth

- Stabilization PR #173 is merged and repository-certified.
- Enterprise AI infrastructure production run `36568179070` is successful: production DB migration, `ai.mkety.com`, `api.mkety.com`, Queue/DLQ, scheduler worker and fail-closed host/API smoke passed.
- Enterprise AI customer inference remains intentionally OFF until first-customer acceptance.
- Mkety Mail Production run `36576563773` is successful on current production main: exact-main authorization, production DB migration, Cloudflare permission preflight, Hyperdrive/app deploy, R2/Queues, ingress/dispatch/events/content workers, secret synchronization, Mail application domains and production smoke all passed.
- Latest Mail live-readiness diagnostic `36574979021` proved the dedicated external-client TCP layer is still absent: trusted TLS was unavailable on both `imap.mkety.com:993` and `smtp.mkety.com:465`.
- External-client customer UI remains fail-closed with `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED=false`.
- Active branch `feat/mail-external-client-gateway-20260929` adds the dedicated lightweight stateless IMAP/SMTP gateway, stable IMAP UIDs, protected internal gateway APIs, guarded Coolify deployment and certificate renewal.
- Architecture decision: the external-client gateway is an always-on stateless Coolify/OCI TCP service. Standard Workers cannot accept inbound raw IMAP/SMTP TCP; the gateway remains tiny (0.25 CPU / 128 MB) with no DB credential/local mail store, while Cloudflare continues to provide DNS/certificate automation. Spectrum may be considered later as an L4 proxy but would not remove the origin gateway.
- PR #178 security audit found one CodeQL workflow-injection finding in release-message interpolation; commit `742328e7fb31ea8bb56714e1a51ad83de4130b6d` fixes it by moving GitHub event/input values into environment variables. Final exact-head checks/review resolution remain required before merge.
- Latest handoff: `docs/handoffs/2026-09-29-mail-production-gateway-next.md`.
- No Starpips production acceptance has begun.

## Exact next sequence

1. certify this gateway branch with exact-head tests/type/lint/build/migration/vinext;
2. merge with `[mail-production] [mail-gateway-production]` so Mail Production first migrates/deploys the exact SHA;
3. require the gateway workflow to reuse/create one `mkety-mail-gateway` Coolify app at 0.25 CPU / 128 MB, expose only health 8080 + IMAPS 993 + SMTPS 465, issue trusted TLS, synchronize the internal secret and pass protocol/fail-closed smoke;
4. record exact production SHA/run evidence in this status + latest handoff;
5. next session begin one controlled real Mail customer acceptance, including the first real app-password IMAP/SMTP functional test and revoke/fail test;
6. after Mail acceptance, configure/accept the first Enterprise AI customer;
7. only then intentionally promote Enterprise AI customer inference;
8. only after these customer gates begin Starpips production acceptance.

---


Current production baseline: `main` at `8ec1bf52f96a7377490fb7fc4ccd2f1bcc031bf4` (PR #172).

## 2026-09-29 stabilization implementation progress

### 2026-09-29 exact-head pre-merge certification

Certified stabilization implementation SHA before this documentation reconciliation: `5e85c2331208d5c49380cec77683c352e8fcf2ad`.

Evidence on that exact SHA:
- aggregate CI `36563958996` — SUCCESS: tests, type-check, build and lint all passed;
- Migration Baseline `36563959225` — SUCCESS;
- Mkety Cloudflare vinext Smoke `36563959181` — SUCCESS, including Worker build and deployment-package validation;
- Mkety Platform Core Workspaces Smoke `36563959122` — SUCCESS;
- Mkety Production App Host Diagnostic `36563959087` — SUCCESS;
- Mkety Public Candidate Deploy `36563959073`, rerun exact job `109391516471` — SUCCESS after the original run was cancelled by workflow concurrency. The successful rerun passed tests, type-check, lint, vinext compatibility, connected staging database verification, operational Enterprise payment-gateway checks, isolated Worker deployment, real managed-AI commercial/accounting acceptance, public route/copy smoke, Enterprise payment safety, and Public Mkety AI memory/privacy acceptance.
- GitHub Advanced Security review thread for the Mail EML preview regex was fixed and resolved; the brittle script/style filtering regex was removed rather than suppressed.

This closes the repository-side pre-merge certification for the stabilization implementation. It does **not** certify production `ai.mkety.com`, `api.mkety.com/v1/ai`, Mail live ingress/dispatch, or customer inference. Those remain guarded production acceptance steps after merge.

- PR #173 is the active pre-Starpips stabilization branch and has completed implementation-level pre-merge certification; it remains unmerged until the documentation-only reconciliation head is rechecked.
- AI Workspace and Enterprise AI are explicitly separate product entitlements and user experiences. Shared identity, PBAC, billing, credits and runtime are platform primitives only.
- Tenant navigation has been simplified into Workspace / Products / Account; Admin exposes direct Product Operations entries.
- Public/app/product host separation is being enforced for `mkety.com`, `app.mkety.com`, `mail.mkety.com`, `ai.mkety.com` and `api.mkety.com`.
- Mail pricing is moving to active immutable database billing versions; Admin changes create a new version instead of rewriting history.
- Paid entitlements now fail closed after the paid period/grace window rather than treating paused or indefinitely past-due subscriptions as active.
- Enterprise AI solution settings now have real editable system instructions, approved solution knowledge, managed model selection and global pause state.
- Enterprise AI channel connections now support binding to a tenant-owned solution instance; the managed channel runtime consumes that solution's instructions/knowledge/model/pause and includes hidden context in reservation estimates.
- Enterprise AI now persists conversations/messages and exposes a per-conversation operator inbox with human takeover, manual reply, scheduled-action cancellation, and resume-to-AI.
- Enterprise AI now supports owner-configured reply pacing (0-900 seconds) and explicit future-commitment reminders. Scheduled work is persisted in Postgres, near-term work is queue-delayed, a minute sweep recovers missed/long-term work, and delivery re-checks entitlement/channel/solution/handoff state before sending.
- Enterprise AI recurring commercial access now has tenant-specific non-public versioned contract plans, negotiated monthly pricing, included entitlements/credits, verified Billing checkout activation, and fail-closed access after paid/grace periods.
- Enterprise AI now has a real playground and customer-safe runs view; playground disables reminder/pacing side effects but still uses commercial admission.
- Mail now exposes customer portability: existing contact CSV import/export plus workspace JSON export, RFC822/EML message export, and bounded authenticated EML import through the Mail content worker. Credentials, API keys, app passwords, provider secrets and verified settlements are intentionally excluded.
- Mkety Media now has a non-destructive tenant connector: Platform Control can link/suspend/disconnect an admin-verified external Media workspace reference, while tenant navigation routes through `/t/{tenant}/media`. Media runtime, subscription state, invoices and credentials remain standalone and are not copied into mksaas; true SSO/sync remains blocked until the Media runtime exposes a verified consumer API.
- Guarded workflow `.github/workflows/mkety-ai-production.yml` now defines exact-SHA deployment for `ai.mkety.com`, `api.mkety.com/v1/ai`, the AI delivery Queue/DLQ and scheduler worker. The workflow explicitly does not enable production inference.
- Dedicated customer setup/readiness runbook: `docs/MKETY_MAIL_ENTERPRISE_AI_CUSTOMER_SETUP_RUNBOOK.md`.
- Certified stabilization implementation SHA: `5e85c2331208d5c49380cec77683c352e8fcf2ad`.
- Exact implementation evidence: CI `36563958996` SUCCESS; Migration Baseline `36563959225` SUCCESS; Mkety Cloudflare vinext Smoke `36563959181` SUCCESS; Mkety Platform Core Workspaces Smoke `36563959122` SUCCESS; Production App Host Diagnostic `36563959087` SUCCESS; Public Candidate Deploy `36563959073` rerun SUCCESS.
- The successful Public Candidate run includes connected staging DB verification, payment-gateway checks, isolated Worker deploy, real managed-AI commercial/accounting acceptance, public route/copy and rendered-Docs smokes, Enterprise payment safety, and Public Mkety AI memory/privacy/commercial grounding.
- Dashboard stats authorization was tightened so a Server Action cannot query another tenant merely by supplying its UUID; tenant membership is checked from the authenticated tenant-role snapshot before stats reads.
- Candidate and production public-content acceptance now use bounded retry helpers for follow-up content fetches, preventing one transient edge/database 5xx from falsely failing an otherwise healthy release while preserving the full content assertions.
- Still incomplete before first Enterprise AI customer: guarded production-main execution/acceptance for `ai.mkety.com`, `api.mkety.com/v1/ai`, delivery Queue/DLQ/scheduler verification, and then real customer acceptance before inference promotion. Pre-merge implementation CI/candidate acceptance is closed.
- Starpips production acceptance remains blocked until this stabilization checklist is closed.

## Current production truth

- PR #159 is merged. The Enterprise AI / Platform / Mail / Domains implementation is no longer a pending completion candidate.
- Production hardening/finalization PRs #162, #163, #164, #165, #166, #167, #168, #170, #171 and #172 are merged.
- `app.mkety.com` is served by the dedicated `mkety-app-host` Worker; root/app/login/auth routing, production Hyperdrive/runtime bindings and the Worker Custom Domain were accepted in production.
- Auxiliary workers.dev and preview URLs for the production app host are disabled.
- DomainNameAPI fixed-egress relay acceptance has passed in both Live and OT&E quote-only modes through `registrar-relay.mkety.com`; the old HTTP 401 / missing-credential blocker below is historical.
- Production Enterprise AI `customerInferenceEnabled` remains deliberately OFF. Starpips real-customer acceptance has NOT started and must not start during this stabilization workstream.
- PR #169 and historical certification PR #147 were closed as superseded on 2026-09-29.

## Active workstream

Before any Starpips production acceptance, stabilize and simplify the authenticated Mkety application so completed backend/product capabilities are actually discoverable, manageable and fast in the UI.

Scope, in order:

1. audit/refactor `app.mkety.com` information architecture, first-login/dashboard experience, tenant/workspace navigation and admin navigation;
2. keep public `mkety.com` routes public-facing and ensure authenticated/admin/workspace routes live on their intended application/product hosts rather than leaking into public-site navigation;
3. reconcile implemented backend capabilities with customer UI and Platform Control/admin UI, especially Mkety Mail, Enterprise AI, Workspaces, Billing/Usage/Credits, Domains/DNS and entitlement-aware product entry points;
4. expose safe editable configuration through Platform Control where architecture already permits it, while keeping secrets, settlement, tenant isolation and immutable accounting protected;
5. verify `ai.mkety.com` and `api.mkety.com` route/host contracts and implement missing customer-visible Enterprise AI console entry points without enabling production customer inference;
6. preserve the implemented non-destructive `media.mkety.com` tenant connector/add-on path while keeping the existing standalone Media production customer/runtime/billing boundary; true Media-side SSO/sync requires a separately verified Media API;
7. remove stale/duplicate app-side paths, simplify navigation, reduce avoidable repeated reads, and add route/navigation/performance contract tests;
8. compare the uploaded legacy StarAI application only for customer-facing capabilities (assistant settings, knowledge, channels, human takeover, test console, logs, etc.); do not import its separate Worker/database architecture into Mkety;
9. certify exact-head CI/build/type/lint/tests and targeted host/navigation/product-surface smokes before beginning Starpips acceptance.

## Commercial behavior to preserve

Enterprise AI supports separately entitled/contracted customers. A customer may have a recurring commercial subscription (for example $100/month) plus included/prepaid usage. Billing/entitlement state must gate the service: when a subscription or required prepaid entitlement is inactive/expired and no allowed grace/committed capacity applies, customer-facing Enterprise AI execution must fail closed while preserving data/configuration. Add-ons/extra capacity must remain additive rather than replacing the base contract.

The exact customer price is a commercial configuration decision, not a hard-coded runtime amount. Verified payment/settlement remains authoritative; browser/client claims never grant service.

---

## 2026-09-28 sequencing update

Repository merge is no longer waiting on the real customer-hostname test. The remaining DomainNameAPI authentication issue and real white-label hostname acceptance remain unresolved external acceptance items. Enterprise customer inference remains disabled until those later acceptance requirements are intentionally completed.

## 2026-09-28 post-hotfix reconciliation and exact-head verification

- PR #160 merged to main as `909c3d31a524075763c0a1c7d7985f89254e0b3a`; its guarded app.mkety.com repair workflow has not yet been executed in production.
- PR #159 was reconciled with that main through merge commit `f70a37414ac9e3494cb638274322babbdf76747e`; it is 0 behind main and mergeable.
- Exact-head CI `36475433490`, migration baseline `36475433506`, AI workspace smoke `36475433627`, Platform workspace smoke `36475433433`, vinext smoke `36475433555`, live-gate diagnostic `36475433650`, and app-host diagnostic `36475433582` all passed.
- Integrated Public Candidate run `36475433480`, attempt 3, passed the complete sequence including connected database verification, isolated Worker deployment, real managed-AI commercial/accounting acceptance, public/docs routes, Enterprise payment safety, and Public Mkety AI privacy/commercial grounding. Attempt 2 had failed only on one HTTP 000 docs-link transport timeout; the unchanged retry passed, confirming it was transient.
- DomainNameAPI live credentials are present, but the safe quote-only provider probe currently receives HTTP 401. No registrar mutation was performed. Genuine OT&E lifecycle acceptance remains external and incomplete.
- Real customer white-label hostname acceptance remains deliberately deferred until an actual controlled customer hostname is connected.
- Production Enterprise customer inference remains OFF and must stay OFF until the external promotion evidence is intentionally completed.

## 2026-09-28 final central-AI / live-gate repository certification

Certified implementation SHA: `de0cc9c27cb5d6b10b5c3561dbb365573584e53f`.

Exact-head evidence:
- CI `36463882071` — SUCCESS.
- Migration Baseline `36463882626` — SUCCESS.
- Mkety AI Workspace Foundation Smoke `36463882405` — SUCCESS.
- Mkety Platform Core Workspaces Smoke `36463882573` — SUCCESS.
- Mkety Cloudflare vinext Smoke `36463882696` — SUCCESS.
- Mkety Public Candidate Deploy `36463882316` — SUCCESS.
- Production App Host Diagnostic `36463882391` — SUCCESS as a read-only diagnostic; it proves the current production defect, not a repair.
- Live Gate Readiness Diagnostic `36463882183` — SUCCESS.
- DomainNameAPI Direct OT&E Diagnostic `36463882234` — SUCCESS as a credential-readiness diagnostic; no preview DomainNameAPI credentials are currently configured.

The public candidate now performs the complete connected acceptance sequence:
1. applies the base Drizzle migrations before legacy Mkety content migrations;
2. verifies the connected staging database;
3. deploys an isolated candidate Worker with the real Workers AI binding and non-production AI Gateway;
4. creates a self-cleaning ephemeral Enterprise AI tenant/API key/credits/budget fixture;
5. temporarily enables customer inference in staging only;
6. performs a real managed Workers AI request;
7. verifies immutable rate-card selection, provider usage/cost evidence, credit/budget reservation and settlement, and idempotent replay;
8. restores the previous staging AI runtime policy and deletes the ephemeral fixture;
9. completes public-route/copy, Enterprise payment-safety and Public Mkety AI memory/privacy/commercial-grounding smokes.

The real commercial inference/accounting gate is therefore CLOSED on this implementation SHA.

Acceptance evidence from Public Candidate run `36463882316`:
- request `3c764161-8c05-4d5c-99a7-e4dc1505c91e`;
- `mkety-economy` -> `@cf/google/gemma-4-26b-a4b-it` via `workers-ai`;
- 24 input tokens / 8 output tokens / 0 cached input tokens;
- 3 credits reserved / 2 credits settled;
- provider cost 6 micro-USD / minimum revenue floor 21 micro-USD;
- one budget reservation settled;
- exact idempotent replay blocked without provider redispatch.

Managed-model benchmark remains closed by run `36425084523`:
- `mkety-economy` -> Gemma 4;
- `mkety-smart` -> GLM-5.3 Flash;
- Qwen remains disabled reserve.
Migration `0027_ai_managed_model_selection.sql` encodes this selection.

app.mkety.com:
- live diagnostics prove production is currently misconfigured: no Worker Custom Domain, a proxied CNAME target of `mkety.com/app`, and HTTP 530 on `/` and `/app`;
- repository-side repair is isolated in draft PR #160 from current `main`;
- PR #160 is green in full CI and vinext;
- its manual production workflow deploys a dedicated `mkety-app-host` Worker, preserves the public `mkety.com`/`www.mkety.com` Worker, binds existing production Hyperdrive, adds app callback/logout URIs to ZITADEL non-destructively, backs up/restores app DNS, attaches only `app.mkety.com`, verifies `/ -> /app -> /login -> auth.mkety.com`, then disables workers.dev/preview exposure.
No production app-host mutation has been executed yet.

Still intentionally deferred real external gates:
- DomainNameAPI real OT&E quote/lifecycle: code and workflows are complete, but preview GitHub Environment currently has no `DOMAINNAMEAPI_USERNAME` or `DOMAINNAMEAPI_API_TOKEN`;
- real customer white-label hostname acceptance: requires an actual controlled customer hostname;
- production app.mkety.com repair execution: manual PR #160 workflow only after choosing to perform the production mutation;
- production Enterprise AI promotion: `customerInferenceEnabled` remains OFF and must stay OFF until the remaining external evidence is recorded.

## 2026-09-28 final repository certification and live-release tooling

Certified implementation head: `106390643a63ad4ecaa7bbaa0f4edc10a976c72f`.

Exact-head evidence:
- CI run `36445378970` — SUCCESS: Build, Test, Lint and Type-check all passed.
- Migration Baseline `36445379145` — SUCCESS.
- Mkety AI Workspace Foundation Smoke `36445378931` — SUCCESS.
- Mkety Platform Core Workspaces Smoke `36445378968` — SUCCESS.
- Mkety Cloudflare vinext Smoke `36445379557` — SUCCESS.
- Mkety Content DB Smoke `36445379296` — SUCCESS.
- Mkety Public Candidate Deploy `36445379381` — SUCCESS, including tests/type/lint/vinext, connected DB application, payment-gateway checks, isolated Worker build/deploy, public-route/copy smoke, payment safety and Public Mkety AI memory/privacy/commercial-grounding smoke.

The previous Public AI candidate failure was a false-positive acceptance rule that treated legitimate product names such as Mail Growth as a retired Platform plan. Candidate and production acceptance now reject only retired `Growth|Pro|Business` plan/tier/workspace phrases; the corrected integrated candidate passed.

Repository-side release tooling is now complete:
- `.github/workflows/mkety-ai-commercial-acceptance.yml` / `scripts/accept-mkety-ai-commercial.ts`: one tiny non-production managed request with direct DB verification of immutable rate-card selection, credit/budget holds and settlement, normalized usage, provider-cost evidence, and idempotency.
- `.github/workflows/mkety-domainnameapi-ote-acceptance.yml` / `scripts/accept-domainnameapi-ote.ts`: reads the active encrypted database DomainNameAPI connection, refuses non-OT&E operation, verifies availability transport, and optionally performs OT&E registration + renewal lifecycle acceptance.
- `.github/workflows/mkety-enterprise-ai-white-label-domain-acceptance.yml` / `scripts/accept-enterprise-ai-white-label-domain.ts`: read-only real-host acceptance for CNAME, HTTPS tenant proof, database tenant ownership, configured white-label login identity and wrong-tenant-path isolation.
- `.github/workflows/mkety-enterprise-ai-inference-promotion.yml` / `scripts/promote-enterprise-ai-inference.ts`: separate production operator enable/disable path. Enablement requires benchmark, commercial, domain and registrar evidence plus managed-route/rate/prepaid readiness. The application UI remains disable-only.

Production `customerInferenceEnabled` remains OFF. PR #159 must remain draft until the two remaining external real-environment acceptances are run and recorded: DomainNameAPI OT&E/lifecycle acceptance and a real customer white-label hostname acceptance. The managed commercial/accounting acceptance is already closed by run `36463882316`. Only after the external evidence is recorded may the guarded production promotion workflow be used.

## 2026-09-28 central AI runtime and dynamic-configuration authority

This section supersedes earlier statements below that describe Workspace AI, Enterprise BYOK, provider selection, or registrar integration as still separate/unimplemented.

- Mkety AI is one shared central transport/control layer with strict caller and credential isolation. Public AI, authenticated Workspace chat, managed Agent Builder/Automation execution, knowledge embeddings, the Enterprise AI product, and the Enterprise AI API consume that shared layer rather than maintaining independent provider transports.
- Managed Mkety inference remains Workers AI: `mkety-economy` resolves through the database model alias/route tables (currently Gemma 4), while `mkety-smart` resolves through those same tables (currently GLM-5.3 Flash). Routing is task-class based, not round-robin. Qwen 3.8 27B remains a benchmarked reserve. Because managed execution resolves active aliases/routes at request time, an approved model swap does not require an application rebuild.
- The shared external-provider adapter catalog is OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Cloudflare AI and AWS Bedrock. Public AI uses isolated Mkety-owned system connections; tenant Workspace/Enterprise BYOK uses tenant/project-scoped connections. A BYOK failure never silently falls back to Mkety-paid inference.
- Enterprise API BYOK execution is implemented through explicit `provider_connection_id`. Customer-provider token spend belongs to the customer provider account and is recorded separately from Mkety managed inference; Mkety does not manufacture managed-token charges for that call.
- Public AI routing, enablement, primary/fallback order and per-provider model selection are database-backed in Platform Control. Public AI provider credentials are encrypted database system connections. The old environment-based Public AI provider configuration is migration fallback only and is not the operational source of truth.
- Customer BYOK credentials and Mkety system-provider credentials are encrypted at rest and are never returned after save. Routine rotation does not require build/redeploy.
- Only bootstrap/root or infrastructure secrets belong in Worker/server secret storage. The shared connection-encryption root is `MKETY_CONNECTION_SECRET_ENCRYPTION_KEY`; the older `MKETY_AI_BYOK_ENCRYPTION_KEY` name is migration compatibility only. Mutable provider credentials, endpoints, model choices, routing, fallback order and reseller settings do not belong in deployment-time environment configuration.
- Domain registration is a system-wide Mkety service. DomainNameAPI is the concrete reseller adapter behind the shared domain-reseller abstraction; Enterprise AI, Deploy and future products consume it rather than owning registrar credentials.
- DomainNameAPI reseller credentials are encrypted in the database. OT&E/production mode, API endpoint override, nameservers and WHOIS privacy are database-backed Platform Control settings. Routine reseller credential rotation or configuration changes require no application redeploy.
- A guarded DomainNameAPI OT&E workflow exists for read-only transport/authentication verification. Production registrar mutations remain gated until OT&E lifecycle acceptance is recorded.
- Production Enterprise customer inference remains OFF. The shared runtime itself is not globally disabled by that Enterprise kill switch; the Enterprise commercial/API boundary enforces `customerInferenceEnabled` so Public/Workspace/internal isolated consumers are not incorrectly disabled.

Remaining release evidence is external/live rather than architectural: DomainNameAPI OT&E/lifecycle verification with the real reseller account, a real customer white-label hostname/login isolation test, the separate app.mkety.com production repair execution, and explicit production Enterprise inference promotion. Exact-head repository certification and the tiny managed commercial/accounting acceptance are already closed.



## 2026-09-28 managed-model benchmark decision

- Guarded paid benchmark rerun `36425084523` succeeded on commit `0b3fb85c78443cb471caeef7b66ac397535b607a` through isolated AI Gateway `mkety-ai-benchmark` using standard/postpaid Workers AI billing.
- Corrected benchmark evidence: Gemma 4 passed 8/10, GLM-5.3 Flash 9/10, Qwen 3.8 27B 9/10; provider errors were zero for all three.
- Managed launch selection is now Gemma 4 as the primary/economy model and GLM-5.3 Flash as the smart/complex model. Qwen remains a benchmarked reserve, not a default route.
- Routing is task-class based rather than round-robin: economy/general work -> Gemma; smart/complex work -> GLM-5.3 Flash; heavy work starts on GLM-5.3 Flash and may later escalate to full GLM-5.3 after a separate benchmark/integration decision.
- Public Mkety AI already has concrete adapters for OpenAI, Azure OpenAI, Google Gemini, Google Vertex AI, Cloudflare AI and AWS Bedrock. This is a separate public-runtime provider configuration boundary.
- Enterprise BYOK currently has entitlement, provider-connection schema and route abstractions, but the commercial Enterprise execution path still invokes managed Workers AI only. Do not claim tenant BYOK execution is complete until provider adapters/secret-resolution are wired into that path.
- The ordinary authenticated Workspace chat still uses its older environment-wide OpenAI-compatible provider layer (OpenAI/Groq/OpenRouter/custom); it is not yet unified with Enterprise BYOK/model routing.
- Production `customerInferenceEnabled` remains OFF. The next live gate is tiny non-production commercial inference/accounting acceptance through the real Mkety Enterprise API path.
# 2026-09-28 continuation audit reconciliation

Continuation audit started from PR #159 docs-only head `8dfa0d61296177e6ca59e8ff77a732cdfc579984`.

- Certified implementation SHA remains `6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`.
- Public Candidate Deploy run `36415088152` is confirmed SUCCESS in addition to the recorded CI, migration, workspace, vinext and Content DB gates.
- PR #159 remains open, mergeable and draft. PR #147 remains historical; stale AI PRs #145/#154/#157/#158 remain superseded.
- Documentation authority has been reconciled so Discord and LinkedIn Page Community match the implemented channel registry, Teams inbound is not claimed, and GLM/Qwen remain benchmark candidates rather than a preselected second managed model.
- Remaining blockers are live/external only: paid benchmark, tiny real provider/accounting acceptance, real customer-domain white-label/isolation acceptance, registrar/reseller adapter verification, and explicit guarded production promotion.
- Production `customerInferenceEnabled` remains OFF.

Use PR #159 itself for the latest docs-only branch head; do not encode a self-referential “current head” SHA into this file.

# 2026-09-28 exact session handoff pointer

Authoritative dated handoff:
`docs/handoffs/2026-09-28-enterprise-ai-platform-mail-completion.md`

Current handoff/docs branch head at the time this pointer was written:
`fa10bce4b0a274df5eb318fbfaf51c1e3a621043`

Certified implementation SHA immediately before the docs-only handoff commit:
`6304ba5b30f39a7f9cf9f83c736155ddd9aaa833`

Verified on that implementation SHA:
- CI run `36415088209` — success (build, type-check, tests, lint);
- Migration Baseline `36415088127` — success;
- Platform Core Workspaces Smoke `36415088120` — success;
- Cloudflare vinext Smoke `36415088190` — success;
- Content DB Smoke `36415088033` — success.

PR #159 remains draft intentionally. Production Enterprise AI inference remains fail-closed pending the manual paid model benchmark, tiny live provider/accounting acceptance, real customer-domain white-label acceptance, registrar/reseller adapter verification and guarded production promotion.

First action in the next session: read the dated handoff and current PR #159 workflow conclusions before making runtime changes.


# 2026-09-28 Platform, Mail and Enterprise AI completion update

Current completion branch: `feat/enterprise-ai-complete-platform-20260928` / PR #159.

In addition to the Enterprise AI runtime/commercial/white-label work already recorded below, the same completion branch now includes:

- Discord as a real Enterprise AI conversational channel with Ed25519 Interaction verification, deferred responses, background AI execution and outbound bot delivery.
- LinkedIn Page Community as an approval-gated connector for supported organization comments/mentions. It validates LinkedIn challenge/HMAC requests, retrieves the actual comment, and replies as the connected organization. It does not claim unrestricted LinkedIn inbox/DM access.
- Trading-style custom-domain verification fallback: strict Cloudflare for SaaS active+SSL-active remains accepted, but if provider SSL state lags, Mkety can verify a hostname only when a live HTTPS route proof reaches Mkety and returns the exact expected tenant identity.
- `app.mkety.com` hot-path optimization: request-cached auth/session, tenant lookup and effective entitlements; single-snapshot workspace filtering; concurrent dashboard metrics; reduced repeated membership/PBAC/entitlement reads.
- A new entitlement-aware tenant product dashboard with correct Projects, Billing, Usage & Credits, Mail, Enterprise AI, Media and Enterprise entry points.
- A real tenant Billing index showing all current Platform/Mail-family subscriptions, verified settlements, ledger activity and self-service checkout links. Platform and Mail subscriptions remain independently composable.
- Persistent Mkety Mail customer navigation covering overview, inbox, shared inboxes, domains, mailboxes, contacts, templates, customer updates, developer tools, analytics, apps and automation.
- Mail first-time onboarding now starts at domain verification before mailbox creation, and the `mail.mkety.com` workspace chooser resolves multi-tenant Mail access in parallel.
- Tenant user navigation now exposes Plan & Billing, Usage & Credits, Mkety Mail when entitled and Enterprise AI when entitled.
- Missing Admin routes are repaired: Analytics, Departments and Settings -> Features now have real destinations; the stale Integration Jobs -> /processing link now routes to Integrations.
- Navigation route-contract tests lock Admin, Mail, Billing, Enterprise AI and product-host handoff routes.

Release/certification rule remains unchanged:

1. exact-head CI/type/lint/tests/build/migration/vinext/core-workspace/content-db smoke must all pass;
2. production `customerInferenceEnabled` stays fail-closed until the guarded paid Workers AI benchmark and tiny live provider/accounting acceptance are explicitly run and recorded;
3. a real customer hostname must prove HTTPS, tenant-bound live-route identity and branded-login isolation before production white-label promotion;
4. registrar/domain-reseller checkout stays behind the provider-neutral adapter until the configured registrar implementation is identified and verified;
5. Mail/product/payment changes must preserve existing verified-settlement, entitlement and provider-secret boundaries.




## 2026-09-28 Enterprise AI completion workstream

Current authoritative implementation direction:

- Enterprise AI remains separately entitled from normal AI Workspace.
- PR #159 is the clean current-main reconciliation of the business console; do not merge stale PRs #145, #154, #157 or #158 as historical patches.
- White-label is a real product boundary: entitled customers may replace product name, logos, favicon, colors, support/legal links and customer login presentation.
- Customer hostnames are routing context for the same tenant/workspace, never a duplicate tenant, user store or billing system.
- Enterprise AI tenants can activate an exact managed `<subdomain>.mkety.app` hostname. Mkety provisions the Cloudflare for SaaS hostname plus the exact `mkety.app` DNS CNAME and only treats it as live after verification; white-label tenants may also attach a verified custom hostname.
- Custom hostname onboarding is designed for one customer DNS action: CNAME the selected hostname to the Mkety SaaS target; Mkety owns custom-hostname provisioning, TLS and routing.
- Product-session handoff tokens are one-time and destination-host-bound so customer domains can establish host-scoped sessions without wildcard Mkety cookies.
- Domain purchase is provider-neutral behind the Mkety domain-reseller adapter; registrar credentials remain server-side.
- Day-one channel vocabulary is Website, WhatsApp Business, Telegram, Instagram Direct, Facebook Messenger, Slack, Microsoft Teams and custom webhook/API. The registry is adapter-based so additional channels do not create another AI runtime.
- Authenticated inbound channel adapters now verify Telegram secret tokens, Slack signed requests with replay-window checks, Meta HMAC signatures for WhatsApp/Messenger/Instagram, and signed custom webhooks before any AI credits can be consumed. Microsoft Teams is outbound workflow/webhook only until Bot Framework inbound identity verification is implemented.
- Customer console exposes plan, subscription status, current period, prepaid credits, current-month AI requests and charged credits in non-technical language.
- Managed inference executes only after Enterprise entitlement, route/model policy, immutable rate-card resolution, worst-case credit reservation and every applicable budget reservation.
- Workers AI is invoked through the Worker `AI` binding with an explicit AI Gateway ID. Pre-dispatch failures release holds; any ambiguous failure after provider dispatch preserves holds and becomes `reconciliation_required` so Mkety cannot silently absorb upstream spend.
- Successful provider usage is normalized, exact customer credits are calculated from the admitted rate-card version, and credit/budget reservations are settled from actual usage.
- Provider cost is recorded separately from customer charge in micro-USD. The default commercial planning floor targets 65% gross margin plus 15% overhead reserve; public numeric pricing is not changed by this workstream.
- If upstream inference succeeds but local commercial settlement fails, the request becomes `reconciliation_required` and must not be sent upstream again.
- Production `customerInferenceEnabled` remains off until model benchmark, cost verification, exact-head CI/migration/smoke/security acceptance and guarded promotion pass.

# Mkety Current Workstream Status

**Updated:** 2026-09-28  
**Current workstream:** Enterprise Mkety AI completion — business console, white-label domains, multi-channel runtime, managed inference and exact commercial settlement  
**Current main:** `8f42835f7973d5c319e60a8bb6d4979208fc8d8a`  
**Active completion PR:** #159 — `feat/enterprise-ai-complete-platform-20260928`  
**Status:** AI runtime/commercial admission is merged on main; completion branch keeps production customer inference fail-closed until exact-head verification and guarded promotion.

## 2026-09-21 production auth recovery and public-site audit

The public site remains live on `mkety.com` and `www.mkety.com` through the existing `mkety-platform` Worker Custom Domains. A production authentication regression prevented login/signup from reaching ZITADEL because the live Worker database path was still bound to the legacy Hyperdrive route.

Verified recovery:

- isolated PgBouncer v2 local secure `SELECT 1`: pass;
- Workers VPC Service created against the PgBouncer private Docker IPv4;
- separate `mkety-production-db-v2` Hyperdrive created after VPC routing propagation;
- `SELECT 1` through the VPC-backed Hyperdrive v2: pass;
- existing `mkety-platform` public release redeployed with only the `MKETY_DB` binding changed to the verified VPC-backed Hyperdrive;
- required production Mkety Auth bindings remained present after deploy;
- live `/login` and `/signup` returned browser HTML;
- live `/api/auth/login?returnTo=/select-tenant` redirected to the configured ZITADEL origin with Authorization Code flow, PKCE `S256`, the production callback `https://mkety.com/api/auth/callback`, and a client id;
- rollback to the legacy Hyperdrive was not required.

Production auth cutover run: `35571673240`.

Repository audit findings relevant to the public milestone:

- current public routes are present for Platform, Workspaces, Solutions, Academy, Pricing, Enterprise, About, Contact, Privacy, Terms, and Mkety Docs;
- login and signup are Mkety-branded and both use the same Mkety Auth/ZITADEL flow;
- the root layout uses Mkety metadata rather than starter-template metadata;
- public docs are served from the Mkety docs route group and are protected by tests against stale template/runtime/auth claims;
- the root README was still starter-template branded and has now been replaced with current Mkety repository guidance;
- open PRs #93, #57, #78, and #20 are all materially behind current `main`; none should be merged blindly. PR #93 and #57 are superseded by current production recovery work. PR #78 is an authenticated Platform/Deployments workstream and must be reconciled separately. PR #20 is an old documentation decision branch and must be reconciled separately if still needed.

Public/auth production is now a verified baseline. Do not re-open the legacy Hyperdrive/PgBouncer repair paths unless a new production regression provides fresh evidence.

### Production ZITADEL self-registration repair

Post-auth-cutover validation found that the Mkety organization inherited a ZITADEL login policy with local authentication enabled but self-registration disabled. The production signup page therefore reached the hosted identity flow but could not create a new local user.

The repair created an organization-scoped login policy that preserves the current effective login settings and enables `allowRegister=true` without changing the instance-wide default policy.

Verification evidence:

- repair run `35572460697`: success;
- independent post-repair diagnostic run `35572489071`: success;
- effective production policy now permits self-registration, local authentication, and username/password authentication.

This means `/signup` can now use the same Mkety Auth/ZITADEL OIDC entry flow as `/login` while exposing ZITADEL's self-registration path for new users.

### Production sign-in vs registration intent repair

A live-user report showed that both Mkety `/login` and `/signup` were entering the same generic ZITADEL authorization flow. When ZITADEL remembered an older account/session, signup could therefore show the hosted account chooser instead of opening registration.

The application flow now carries an explicit Mkety auth intent end to end:

- Mkety sign-in → `intent=signin` → OIDC `prompt=login`;
- Mkety signup → `intent=signup` → OIDC `prompt=create`;
- Authorization Code + PKCE `S256`, one-time state/nonce transaction persistence, and the production callback remain unchanged.

Guarded production deployment run `35573336899` passed and independently verified both live redirect contracts against the production ZITADEL issuer. Rollback was not required.

Additional lifecycle verification established:

- disposable verified ZITADEL identities can be created through the existing production management credential;
- ZITADEL username/password session creation succeeds for those identities;
- production OIDC auth-request lookup succeeds;
- the CI management PAT intentionally cannot finalize an OIDC auth request: ZITADEL returns `403 No matching permissions found` because finalization requires the dedicated instance `IAM_LOGIN_CLIENT` / `session.link` capability;
- do **not** grant `IAM_LOGIN_CLIENT` to the general `ZITADEL_MANAGEMENT_PAT` or an application end-user merely to make CI impersonate the hosted login. ZITADEL's hosted login already operates with the appropriate login-client authority. A future deterministic callback smoke should use a separate least-privilege login-client service account/PAT if one is provisioned.

The earlier Playwright production lifecycle attempts are not evidence of a Mkety product failure: they failed inside ZITADEL's reactive hosted-login field before Mkety callback. The protocol smoke then isolated the final CI-only permission boundary above. Treat the live redirect/policy/database evidence as the production baseline unless a real browser user reports a new callback/session failure.

## 2026-09-21 public final-polish reconciliation

The public-site audit was completed against current `main`, the active release branch, historical PRs, and the production auth recovery evidence.

Final reconciliation completed:

- restored the five approved Mkety Academy hub photos to current `main` from the already-approved release blobs and restored local-first image rendering with a safe external fallback;
- confirmed the public release branch already carries the approved Academy image set and the explicit sign-in/signup OIDC intent repair;
- made the public Contact experience actionable using established Mkety-owned channels:
  - product/support: `info@mkety.com`;
  - Enterprise/partnerships: `hello@mkety.com`;
  - Telegram: `https://t.me/mketyadmin`;
  - Academy: `https://academy.mkety.com`;
- added a regression test preventing placeholder contact destinations;
- confirmed public `/docs` renders from the Mkety CMS/default documentation tree rather than the legacy starter-template docs source;
- closed historical PR #20 because its Trading-local bearer decision is superseded by the current central Mkety Auth Gateway authority;
- left PR #78 on hold because it is a separate authenticated Deployments/Cloud workstream and conflicts with current `main`.

Current public release candidate:

- release branch: `feat/mkety-public-site-production`;
- exact candidate SHA: `a44f672b0e89f6c6e0129c2d425cd1bed3b3aa44`;
- immutable certification branch: `certify/3f85da0`.

Exact-SHA certification is now complete and green for `a44f672b0e89f6c6e0129c2d425cd1bed3b3aa44`:

- Content DB Smoke — run `35586389825`;
- Public AI Runtime Diagnostic — run `35586392588`;
- Production Routing Preflight — run `35586395433`;
- Public Candidate Deploy — run `35586398082`;
- Cloudflare Preview, including real hosted ZITADEL login → Mkety session → workspace creation → protected tenant access → hosted logout — run `35586401611`.

The earlier `3f85da0...` certification attempt correctly exposed stale test expectations around explicit sign-in intent, request-scoped RBAC database access, and current onboarding copy. Those were repaired as test/smoke-contract changes without changing approved runtime behavior.

Production promotion remains behind the repository's guarded public cutover confirmation and must not be bypassed.


## 2026-09-21 branded authentication cutover

Customer-facing authentication is now Mkety-branded and stays on the Mkety domain:

- interactive login hostname: `https://auth.mkety.com`;
- Login V2 base path: `/ui/v2/login`;
- ZITADEL Cloud remains the OIDC issuer/backend at the generated `*.zitadel.cloud` instance domain; do not change issuer/token validation to `auth.mkety.com`;
- the official ZITADEL Login V2 service is self-deployed behind Mkety infrastructure with the required public-host / instance-host proxy boundary;
- `auth.mkety.com` is a trusted ZITADEL login domain;
- a dedicated machine identity with only `IAM_LOGIN_CLIENT` is used by the Login V2 runtime; the general management PAT is not embedded in the login service;
- Mkety label policy is active with Mkety logo/icon assets, Mkety colors, hidden login-name suffix, and the ZITADEL watermark disabled;
- the effective instance feature is `loginV2.required=true` with `baseUri=https://auth.mkety.com/ui/v2/login`.

Guarded production cutover run `35609958644` passed. Live verification proved:

- sign-in lands on `https://auth.mkety.com/ui/v2/login/loginname`;
- signup lands on `https://auth.mkety.com/ui/v2/login/register`;
- the rollback step was not invoked.

Important implementation note: per-application `loginVersion.loginV2.baseUri` was not sufficient because the instance already had Login V2 required at instance scope; instance-level Login V2 takes precedence. Do not remove the instance base URI unless intentionally rolling back to the ZITADEL-hosted login.

ZITADEL Cloud native custom domains remain a paid Pro capability. Mkety currently achieves a branded customer login hostname without changing the Cloud issuer by using the supported self-hosted Login V2 custom-base architecture.

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

NOWPayments remains the required production cutover payment check. Flutterwave v3 and Kora are optional until their complete credentials are configured; Flutterwave collection FX rates and markup are database-managed in Platform Control.

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

PR #65 narrowed that check to actual internal repository references such as `github.com/MketyDigital` while continuing to block internal repository identifiers, private origin hostnames, and stale runtime/template wording. Its v3 cutover progressed further: the preview returned HTTP 200 and passed the wording sweep, but the canonical smoke falsely required `rel="canonical"` to appear before `href` in the `<link>` tag. HTML attribute order is not significant. Branch `release/fix-canonical-smoke-2e871fe` reuses the repo's existing order-independent canonical-link parser and bumps the launcher to `worker-custom-domains-v4` for one clean retry.

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

Fixed-price self-service checkout now lives directly in MKSaaS Billing. NOWPayments remains the primary/default crypto path; Flutterwave v3 Inline and Kora embedded checkout become available only when fully configured. All three paths create pending billing state first and activate value only after verified, idempotent settlement through the Mkety Billing/Entitlements boundary.

Payment presentation may be native to Mkety, but provider UI remains provider-controlled and Mkety does not collect raw card details.

No production DNS/custom-domain mutation, production Deploy execution, OCI/Coolify mutation, or customer infrastructure provisioning was introduced by PR #79.

### Exact next order

1. Merge PR #79 after the documentation-only successor head remains green.
2. Implement live fixed-price self-service Billing checkout by reusing the approved shared Mkety billing-service contract and preserving verified/idempotent settlement boundaries.
3. Then resume APP-07 Deployments/Cloud from the already-verified Cloudflare candidate-adapter state: add an authorized non-production customer invocation path with explicit audit/approval boundaries before any production execution work.
## Self-service Billing checkout and MKSaaS billing authority

PR #80 (`feat/self-service-billing-checkout`) makes the MKSaaS Billing domain the explicit authority for Mkety Platform self-service subscriptions and removes stale MKSaaS documentation/workflow references that incorrectly pointed implementation work toward the independent `mklms` product. `mklms` production/main is not modified by this work and remains an independently deployed Enterprise Mkety product.

The self-service commercial path now covers the fixed-price Platform plans:

- Starter — $5.99/month
- AI Workspace — $16.99/month
- Automation Workspace — $16.99/month
- Deploy Workspace — $9.99/month
- Mkety One — $49/month

The implementation keeps Enterprise negotiated payments separate.

Billing now includes a server-owned fixed-price catalog, immutable plan-version-safe seeding, paid-workspace entitlement mappings, a non-entitling `pending_payment` subscription state, authenticated tenant checkout, NOWPayments invoice creation inside MKSaaS, signed webhook verification, exact amount/currency binding to Mkety Billing records, and idempotent verified settlement through the existing Billing ledger/service boundary. Browser return/success pages remain non-entitling.

The customer path is:

`/pricing` → selected plan → signup/login → tenant selection or first-workspace creation → authenticated tenant checkout → provider invoice → verified final settlement → Billing state → Entitlements.

Staging candidate and production DB release sequences seed and smoke the canonical Billing catalog. The standalone staging DB smoke is self-contained and independently seeds both CMS content and Billing catalog before smoke checks.

After this Billing slice is merged and production-promoted, resume APP-07 Deployments/Cloud from the previously documented next step: an authorized, audited, non-production customer invocation path over the existing deploy execution kernel. Production deployment, DNS/custom-domain mutation, OCI/Coolify mutation, and rollback execution remain outside that next slice unless separately approved.
## 2026-09-22 public legal and production-copy completion

A fresh public-site audit was run against current `main` at `d5ee4b4a0d34d8fdc68effdc290c039ec56b567f`, the authoritative architecture/handoff documents, the live public-content defaults, the remaining open PR state, and the protected legacy `MketyDigital/Mkety` repository.

Branch: `fix/public-site-production-copy-20260922`.

Findings and changes:
- the current `/privacy` and `/terms` routes existed but their defaults were short baseline summaries rather than production-complete legal pages;
- the legacy production site contained materially broader Privacy/Terms coverage, including billing/refunds, Academy, Enterprise, Trading, integrations and acceptable-use language;
- legacy wording was used only as coverage reference: obsolete plan names, automatic-renewal claims, blanket no-refund language, unsupported infrastructure/domain promises, provider-specific privacy guarantees and other stale product claims were not copied;
- Privacy now covers information categories, purposes, providers/integrations, AI processing, cookies/browser storage, retention/security, user choices and privacy contact without claiming unapproved certifications or fixed retention periods;
- Terms now cover account/access security, acceptable use, AI/automation/integrations, billing/cancellation/refunds, Academy/Enterprise/Trading boundaries, intellectual property, service evolution, suspension/termination, disclaimers and contact/update handling;
- stale template/demo/Auth.js-era customer wording was removed from the English getting-started docs and retained landing components so no reusable public surface advertises Mkety as a SaaS starter/boilerplate or promises a demo that does not match the current product;
- internal `saas_template` database/schema identifiers were intentionally not renamed because they are implementation details and changing them would be a migration/runtime concern, not a public-copy cleanup.

No production database, Cloudflare route, payment, authentication, deployment-provider or DNS mutation is part of this branch.

Remaining gate before merge/production use: exact-head repository CI, public candidate/route acceptance where triggered, and review of the rendered legal pages on the candidate.


## 2026-09-22 auth, onboarding and Platform Control boundary audit

The production auth/onboarding path was rechecked while finishing the public site.

Confirmed self-service sequence:

`/pricing` -> selected fixed-price plan -> signup/sign-in -> tenant selection or first-workspace creation -> authenticated tenant checkout -> provider invoice -> verified final settlement -> Billing state -> Entitlements.

This order is intentional. Non-Enterprise customers register before payment because subscriptions, payment records and entitlements are scoped to an authenticated Mkety tenant/workspace. A browser payment return never grants access. Enterprise remains separate and uses the protected negotiated-payment flow.

Auth behavior remains Mkety-owned and provider-neutral at the application boundary:
- sign-in uses `intent=signin`;
- signup uses `intent=signup`;
- both continue through the existing Authorization Code + PKCE flow;
- selected self-service plan keys survive auth and first-workspace onboarding into tenant checkout.

Login/signup presentation was reduced to one short explanatory sentence per page; the repeated card description/security copy was removed.

Security finding and correction:
- first-workspace creation correctly makes the creator an `admin` of that customer tenant;
- tenant `admin` currently resolves to wildcard tenant permissions;
- public CMS records are global Mkety content, not customer-tenant content;
- therefore Platform Control/CMS must not be reachable merely because a customer created a workspace.

Platform Control now fails closed unless the route tenant slug exactly matches the server-side `MKETY_PLATFORM_CONTROL_TENANT_SLUG` configuration and the signed-in identity is listed in `MKETY_PLATFORM_CONTROL_OPERATOR_EMAILS`. Normal customer tenant admins remain admins of their own workspace but cannot use the global Mkety Platform Control/CMS surface.

Bootstrap procedure for the first Mkety operator account:
1. configure `MKETY_PLATFORM_CONTROL_TENANT_SLUG` to a dedicated internal slug such as `mkety-ops`;
2. configure `MKETY_PLATFORM_CONTROL_OPERATOR_EMAILS` with the approved operator identity/identities;
3. create/sign in with one of those identities through the normal production auth flow;
4. create the dedicated workspace using that exact slug;
5. the creator becomes tenant `admin` and can open `/t/<slug>/admin/platform-control`;
6. invite/add later operator identities to that dedicated workspace and grant only the required operator roles/permissions.

Do not create a hidden hard-coded admin account, bypass identity, or grant customer workspaces global CMS authority.


The control-workspace slug alone is not an authorization secret. The server also requires the authenticated actor email to be present in `MKETY_PLATFORM_ADMIN_EMAILS`. This prevents a normal customer from claiming the reserved control slug and inheriting global CMS authority.


## 2026-09-22 canonical production plan/workspace feature sweep

Public plan/workspace capability copy has been normalized to the September 22 AGENTS/commercial contract across:
- homepage workspace/default content;
- /platform and /workspaces public page defaults;
- /pricing plan cards;
- public docs workspace articles;
- Public Mkety AI grounding;
- billing-facing plan descriptions;
- CMS repair migration pricing descriptions and feature rows;
- Platform Control pricing-module wording.

Canonical customer-facing feature dimensions now include:
- Starter: published websites/pages; landing pages, portfolios, simple business sites and supported blogs/docs; supported custom domains/SSL/edge delivery; supported forms/integrations; basic analytics/project management; asset/storage and usage/credits visibility.
- AI Workspace: Agent Builder; agents/published agents; drafts/version history; model choice/test playground; knowledge/storage/retrieval; tools/actions/API; Website AI, Telegram and supported messaging; conversation/run history; usage and team access.
- Automation Workspace: visual workflow builder; webhooks/schedules; API actions/conditions/notifications/integrations; secrets; retries; execution logs/history; execution/usage visibility and team access.
- Deploy Workspace: managed edge/serverless application runtime; lightweight web app/API/portal deployment; supported custom domains/SSL; environment variables/secrets; deployment history/logs/status where available; project/application/usage visibility.
- Mkety One: Starter + AI + Automation + Deploy capabilities expressed through projects/workspaces, domains, usage/credits, teams, operational controls, support and history/analytics rather than infrastructure slices.
- Enterprise: custom implementation/managed delivery, dedicated/private infrastructure when required, containers/persistent services/networking/high-throughput needs, specialized integrations/Trading infrastructure, and custom support/commercial terms.
- Trading Workspace remains visible as Custom / Enterprise with no self-service price.

Production content DB smoke now compares every published pricing feature array exactly against the canonical defaults. This prevents a stale CMS seed or edited pricing dataset from silently passing release verification. Public pricing remains free of CPU/RAM/VPS/server-allocation claims.


## 10. Self-service prepaid billing terms — September 22, 2026

Fixed-price self-service plans support four prepaid subscription terms:

| Term | Discount | Commercial meaning |
| ---- | -------- | ------------------ |
| 1 month | 0% | canonical monthly list price |
| 3 months | 5% | prepaid subscription total |
| 6 months | 10% | prepaid subscription total |
| 12 months | 15% | prepaid subscription total |

The discount applies only to the fixed subscription price. It does not automatically discount metered usage, credits, pass-through model/provider charges, or Enterprise/custom work.

The monthly plan version remains the immutable list-price source. The selected prepaid term deterministically calculates the server-owned checkout total and sets the Billing period end to the selected number of months. Browser/query values are never trusted as prices.

The selected term must survive:
`pricing -> signup/sign-in -> tenant selection/creation -> authenticated checkout -> provider checkout`.

Enterprise and Trading Custom / Enterprise terms remain separately quoted and are not governed by this self-service discount table.


## 2026-09-23 APP-07 deployment approval boundary

APP-07 now reconciles the historical deployment-request approval intent onto the current authorized Cloudflare candidate execution kernel.

Current contract:
- project manager/admin plus active `workspace.deploy` entitlement may request a non-production candidate;
- request stores tenant/project/application/environment plus required `releaseRef` and optional `sourceRef`;
- production/protected environments are rejected when requesting and again when executing;
- Platform Control operator access plus `platform:deployments` authority may approve or reject a pending request;
- approval does not execute a provider;
- an approved request may be consumed once by a project manager while Deploy entitlement remains active;
- request claim and queued `deployments` row creation happen in one database transaction;
- the queued execution is bound to the approved environment and exact release/source refs;
- provider execution uses the existing audited deployment kernel and Mkety-controlled Cloudflare candidate provider;
- request state moves through `pending -> approved/rejected -> executing -> completed/failed`;
- `executionDeploymentId` permanently links the request to its single execution;
- production deployment, DNS mutation, custom-domain mutation, rollback, arbitrary customer source execution, OCI, and Coolify remain out of scope.

Persistence is additive in `0015_deployment_requests`. The Deployments & Domains Platform Control module is now a foundation approval surface at `/admin/platform-control/deployments-domains`.


## 2026-09-23 production public cutover complete

The Mkety public production release is live and certified.

- deployed application release SHA: `6704dc1db64b2c24572c9f674a04bb2ac680f3b0`;
- production cutover workflow run: `35858120559` — success;
- production Worker: `mkety-platform`;
- public Custom Domains: `mkety.com` and `www.mkety.com`;
- canonical `www` redirect to `https://mkety.com/`: pass;
- runtime database binding: `MKETY_DB`;
- active Hyperdrive: `mkety-production-db-v2`;
- private production database migration: pass;
- Hyperdrive DB-backed production Worker preview: pass;
- direct production `DATABASE_URL` Worker secret removed;
- Platform Control runtime identity configuration attached;
- production public-route/canonical/sitemap/robots acceptance: pass;
- NOWPayments read-only credential validation and invalid-signature fail-closed acceptance: pass;
- Public Mkety AI canonical commercial grounding, Academy destination, Enterprise-first Trading sales, memory/privacy/private-source acceptance: pass;
- isolated candidate tests/typecheck/lint/Vinext/content DB/payment/live route/Public AI acceptance: pass;
- pre-mutation rollback evidence persisted and no rollback was required.

The production release path now consistently uses `mkety-production-db-v2`; active diagnostic workflows were aligned to the same Hyperdrive authority. Historical references to `mkety-production-db` are not production authority.

The public-site phase is complete. Continue authenticated application development from current `main`, preserving the production release controls and APP-07 approval boundary.


## 2026-09-24 final public-site production closure

The final public-site closure is merged and production-promoted.

Production application release:
- certified/released SHA: `ba1510d95c9c77ff9db7e95d2a5ae728e9d19b58`;
- guarded launcher run: `35967374372` — success;
- protected production cutover run: `35968252256` — success;
- rollback-guarded live acceptance completed successfully after `mkety.com` and `www.mkety.com` were attached to the release Worker;
- production database migration completed successfully;
- production uses `MKETY_DB` through `mkety-production-db-v2`; the legacy direct database Worker secret remains removed.

Final public contract now certified in candidate and production acceptance:
- Explore Mkety tabs remain horizontally scrollable on mobile and content/card containers are viewport-constrained with overflow-safe wrapping;
- collapsed Public Mkety AI bar sits below the header, uses a transparent background, and restores the Mkety logo;
- Public AI is the primary public support/sales/contact entry, searches published docs first, can answer from public context, captures voluntary lead/contact details when enabled, has deterministic fallback, and escalates to configured Telegram/email human support;
- Platform Control can update public support/sales emails, Telegram destination, Public AI prompt extension, fallback copy, lead-capture toggle, legal links, and public page/section payloads without code changes;
- Docs sidebar and article routing are generated from the same published docs tree, rendered docs links are release-smoked, and article previous/next navigation is present;
- login/signup preserve direct signin/signup intent into branded Mkety Auth; hosted auth link settings point to Mkety Terms, Privacy, Docs, and official support rather than ZITADEL legal destinations;
- Academy uses the five approved local uploaded hub images `class1.jpg` through `class5.jpg`;
- Academy public discovery/sales starts through Mkety.com/Public AI and official human support; `academy.mkety.com` remains the ready-to-learn sign-in/access handoff;
- Academy public CMS supports course/tier card structures with independently editable tier title, description, price badge and CTA, including add/remove/reorder through the structured page payload;
- Pricing currency rendering includes USD `$` and self-service prepaid terms remain 1/3/6/12 months with the approved discount ladder;
- Trading Workspace is visibly presented as `Custom / Enterprise` on Workspaces and Pricing;
- production acceptance explicitly fails on stale Academy tiers/ready-to-learn content, missing USD pricing, missing Trading Workspace, broken rendered docs links, missing Academy images, or a homepage Academy sales bypass.

PR #100 (`fix: close final public mobile, Academy and pricing issues`) merged successfully. Its final exact head was `f689c34696e32ea25fdcf41b824b15f9b9b4ac41`; merge/release commit was `ba1510d95c9c77ff9db7e95d2a5ae728e9d19b58`.

Known non-release blocker:
- MegaLinter may remain red from the pre-existing repository-wide Checkov baseline; all functional public release gates, exact-SHA candidate checks, production migration, production preview, hostname cutover and live acceptance passed.

### Next session

Public-site work is closed unless a new production regression is observed. Resume authenticated app development from current `main`, using the existing APP-07 approval-gated Deploy foundation as the starting point. Do not reopen historical public branches or PR #78 wholesale.



## 2026-09-23 authenticated SolutionHub catalog foundation

With the public production cutover complete and APP-07 approval-gated non-production Deploy execution merged, authenticated application work resumes with SolutionHub.

Current bounded SolutionHub contract:
- the authenticated project SolutionHub route is now a real discovery/catalog surface rather than a planned-only capability map;
- code-owned catalog entries are classified as shared-platform or Enterprise/Custom;
- shared-platform examples route only into existing project-scoped AI, Automation, or Deploy workspaces;
- approved shared examples include Customer Support AI, AI Knowledge Assistant, Lead Capture Automation, Telegram Workflow, Marketing Automation, and Business Website;
- complex ERP, substantial regulated-data systems, private/dedicated runtime requirements, and Trading Automation route to Enterprise rather than pretending to be self-service;
- no one-click install, clone, provisioning, entitlement mutation, billing mutation, infrastructure allocation, or Trading execution is introduced;
- SolutionHub continues to inherit the existing authenticated tenant/project access boundary from `requireProjectAccess`;
- Automation, Deploy, and SolutionHub registry availability now reflects implemented authenticated functionality instead of stale `Planned` labels;
- Deploy customer wording remains explicitly non-production: production execution and domains are still protected.

This slice is intentionally catalog/routing-first. Any future SolutionHub install/provision capability must introduce tenant/project-scoped persistence, entitlement/billing checks, approval/audit rules, idempotent provisioning state, and rollback/recovery design before enabling mutation.

## Mkety Mail commercial product + public production reconciliation — September 28, 2026

Requested outcome:

- make Mkety Mail a real separately subscribed/add-on Mkety product with public plans, enforced usage limits, shared payment settlement, authenticated product access and operations controls;
- publish Mail and Enterprise AI as first-class public product offerings without changing the existing AI Workspace product boundary;
- keep provider/internal infrastructure telemetry restricted to Mkety admin/ops;
- verify and complete the previously prepared Mkety public-site production cutover;
- do not alter authentication/session behavior for Academy, Media, Trading or unrelated `*.mkety.com` products.

Current implementation branch:

- `feat/mkety-mail-commercial-product-20260928`
- PR #146
- based on current `main` `7dc7884ebb28d96daa7820c51d37dfae183bf4b0`.

Implemented on the branch:

- Mail Starter $4.99/month;
- Mail Growth $9.99/month;
- Mail Business $24.99/month;
- Enterprise Mail remains contract/custom;
- `workspace.mail` entitlement;
- additive subscription-family checkout so a tenant can own one Platform-family subscription plus a separate Mail-family subscription;
- Entitlements composition across qualifying active subscriptions;
- Billing remains authoritative for purchased Mail tier;
- Mail workspace initialization resolves the paid Mail plan;
- plan-aware monthly outbound and Customer Update limits;
- existing daily/domain warm-up, bounce/complaint and reputation controls remain stricter safety boundaries when applicable;
- self-service Mail fails closed at quota; launch extra capacity is plan upgrade or Enterprise, not unimplemented prepaid capacity packs;
- customer-safe Mail usage view;
- global Platform Control Mail operations module for catalog reconciliation, tenant Mail state, onboarding and domain routing/sending/DNS readiness;
- public Mail marketing page expanded with professional inbox, aliases/forwarding, shared inboxes, contacts/templates, Customer Updates, transactional API, webhooks, supported external mail-client setup, deliverability controls, trust/security, plans, Enterprise and Marketing Coming Soon;
- public pricing/Enterprise/docs/llms/Public Mkety AI knowledge updated for Mail and separate Enterprise AI;
- CMS-safe public content refresh migration;
- product catalog/operations migration;
- Mail navigation and protected Mail routes require `workspace.mail`;
- canonical `/mail/app` resolves entitled Mail workspaces;
- Mail uses a product-scoped one-time session handoff rather than a wildcard `.mkety.com` application cookie.

Mail session-handoff safety:

- no wildcard Mkety application cookie;
- no central session token is placed in a URL;
- central app verifies its own Mkety session before issuing a Mail handoff;
- handoff token is opaque, one-time and expires after 60 seconds;
- Mail atomically consumes the handoff and establishes its own host-scoped Mkety session;
- audience is fixed to Mail;
- Academy, Media, Trading and unrelated Mkety subdomains remain unchanged;
- the pattern may be generalized to another product only through a separate explicit integration.

Payment boundary:

- NOWPayments remains primary/default crypto;
- Flutterwave v3 and Kora remain supported alternatives where configured;
- Mail uses the shared Mkety Billing/payment settlement path;
- browser redirect/success pages never grant Mail entitlement;
- provider webhook/re-query verification and idempotent Billing settlement remain authoritative.

Production audit findings:

- the live `https://mkety.com` apex is still serving the legacy Mkety marketing site as of this audit;
- the protected public production workflow is `Mkety Public Production Cutover`;
- that workflow promotes only `mkety.com` and `www.mkety.com`;
- it snapshots existing Cloudflare Custom Domains, apex/www DNS and Worker Routes before mutation;
- it refuses conflicting Worker Routes/custom-domain ownership;
- rollback rules explicitly preserve unrelated Worker routes and DNS;
- therefore Mail, API, Media, Academy, Trading, autoconfig/autodiscover and unrelated subdomains are outside the public cutover mutation set;
- the required release branch `feat/mkety-public-site-production` is currently stale: 187 commits behind `main` and 0 ahead, with merge base at the historical role-fix SHA;
- this stale release branch explains why repository public work and live public production diverged.

Release plan:

1. freeze PR #146 after documentation;
2. require exact-head CI, Migration Baseline, Cloudflare Vinext, Content DB Smoke and integrated Public Candidate success;
3. merge #146 to `main` only after exact-head certification;
4. verify exact new `main`;
5. fast-forward `feat/mkety-public-site-production` to the certified new `main` because that release branch has no unique commits to preserve;
6. run exact release-branch CI and integrated Public Candidate;
7. run the guarded public production cutover with the exact certified release SHA;
8. verify production DB/content migrations and public CMS seed/reconciliation;
9. smoke the real live `mkety.com`, `www.mkety.com`, pricing, Enterprise, Trust, Infrastructure, Academy discovery, Mail, docs, llms.txt, login/signup and Public Mkety AI;
10. separately verify `mail.mkety.com` product-session handoff, Mail entitlement, onboarding and customer dashboard;
11. confirm unrelated product hosts/routes are unchanged;
12. only after live acceptance passes, return to Enterprise Mkety AI implementation.

Known non-goals for this Mail release:

- Marketing campaigns remain Coming Soon;
- prepaid Mail capacity packs remain planned, not sold;
- external IMAP/SMTP remains subject to production certification where protocol infrastructure is not yet certified;
- no wildcard Mkety auth cookie;
- no Media/Academy/Trading runtime migration;
- no Enterprise AI inference-provider production activation.


## 2026-09-28 — Enterprise Mkety AI commercial safety and operations

**Current production/main authority before this branch:** `28e28562a5c5d08d5d050e15ab4b7af8c4901777`

### Completed and merged

- PR #150 — Enterprise AI runtime foundation, merged as `9ce9a3bd3591708b2604fa9f83b18e44ef102ede`.
- PR #151 — atomic AI credit reservations, merged as `43cadf485d105ed2fd1e9f6bc1a2f81fafe7cc95`.
- PR #152 — layered AI budget reservations, merged as `28e28562a5c5d08d5d050e15ab4b7af8c4901777`.
- Normal AI Workspace remains separate from Enterprise AI.
- Paid customer inference remains disabled.
- Credit admission now supports atomic hold, exact settlement, full failure release, idempotency, tenant/project/key/request ownership checks, immutable usage/ledger history, and concurrent-overspend protection.
- Budget admission now reserves every applicable active tenant/project/API-key budget in one transaction, distinguishes hard-stop and soft budgets, and settles/releases exact reserved counters.
- `docs/MKETY_AI_ENTERPRISE_CAPABILITY_MAP.md` defines the broad cross-industry Enterprise AI solution surface while preserving shared security/commercial primitives.

### Current workstream

Build the commercial-control and no-code Mkety Ops layer before any real paid customer inference:

- effective-dated, versioned AI rate cards;
- strict prepaid-only runtime policy;
- safe request/output/reservation limits;
- Platform Control visibility and emergency disable;
- simple business-facing Enterprise AI product experience with developer controls progressively disclosed;
- commercial admission orchestration that requires both credit and budget reservations before provider invocation;
- no production model/provider activation until exact accounting, failure repair, non-production inference, and model benchmark evidence pass.

### Commercial invariants

1. No managed inference without Enterprise entitlement, valid tenant/project/key scope, active route/model, active effective rate card, available prepaid credits, and all applicable hard budgets.
2. No silent postpaid overage. Enterprise AI remains prepaid/committed-capacity only unless a future explicit architecture and commercial decision changes this rule.
3. Rate-card values used for billable usage are historical facts. Future changes create a new version rather than rewriting prior pricing.
4. Browser success/return pages, client claims, API parameters, or provider responses never grant credits, entitlements, subscriptions, or budget bypasses.
5. Holds occur before paid provider work. Successful calls settle exact actual usage; failed calls release held value.
6. Customer BYOK never silently falls back to Mkety-paid credentials.
7. Mkety Ops may edit safe business configuration without code, but protected invariants, secrets, authorization, settlement logic, and production release gates remain non-editable.

### User-experience direction

Enterprise Mkety AI is presented as a business solution rather than an infrastructure console. The default customer journey is outcome-first (for example customer support, lead follow-up, knowledge assistant, booking/operations, internal helpdesk, and custom automation). Model/provider/API/routing controls remain available to advanced users and developers without becoming the default vocabulary for small and medium businesses.

### Remaining release sequence

1. Finish and certify AI commercial-control/no-code Ops configuration.
2. Implement one commercial admission orchestrator that acquires credit and every applicable budget reservation before provider invocation and compensates/release safely on partial failure.
3. Run the existing manual-only Gemma 4 / GLM-5.3 Flash / Qwen 3.8 benchmark and retain the JSON artifact.
4. Select the second managed model from benchmark evidence.
5. Bind Workers AI in non-production only and route through the isolated AI Gateway.
6. Prove exact rate-card selection, reservation, actual-usage settlement, idempotency, provider-failure release, timeout/retry behavior, reconciliation, and crash repair.
7. Add the focused `ai.mkety.com` customer console/host routing and central `app.mkety.com` Enterprise AI entry behind the correct entitlement, preserving Public Mkety AI isolation.
8. Add streaming only after accounting invariants hold for streaming/cancellation.
9. Add BYOK after managed inference is stable and tested.
10. Promote production/customer inference only after exact-head CI, migration, smoke, security, commercial, and live acceptance gates pass.


## 2026-09-30 audit continuation authority

PR #223 contains the Mail lifecycle/protocol repairs and Enterprise Platform Control authorization, immutable prepaid settlement, proportional credit, dashboard aggregate decoding, provider-cost reservation and durable claim/dispatch fixes. Current acceptance authority is `docs/handoffs/2026-09-30-repository-audit-results.md`; production sequence remains `docs/handoffs/2026-09-30-final-platform-completion.md`.

Fresh local evidence: 241 source suites / 1,166 tests plus six script tests, TypeScript, Vinext build and migration consistency pass; repository lint has 0 errors and 11 existing image optimization warnings. Independent review found no remaining critical/important issue. The expanded branch CI passed real PostgreSQL concurrency tests and all five operations image builds. Checkov/Gitleaks pass with the precisely documented bootstrap/synthetic-fixture exceptions. Exact-head remote results and SHA are recorded in PR #223; earlier-head runs must not be represented as certifying a later revision.

Production/customer readiness remains gated on certified-main promotion, app/admin authenticated navigation, fresh Mail functional/customer acceptance, and controlled Enterprise white-label/domain/channel/BYOK/external-provider/payment/accounting acceptance. Customer inference and external Mail client gates stay closed until those checks pass and enablement is intentional. No code merge or local test count completes those live gates.

Dependency/editor continuation: the complete pinned-pnpm lockfile audit now reports zero known advisories after direct/transitive patches and removal of the unused webpack Storybook framework. Controlled rich-text updates and duplicate Link registration are regression-fixed. Local verification now passes 244 source suites / 1,174 tests plus six script tests, TypeScript, Cloudflare build, isolated component preview and migration/Drizzle checks. CI now blocks on full dependency audit and component preview. New exact-head remote results remain tracked in PR #223; controlled live/customer release gates above are unchanged.


## 2026-09-30 post-promotion admin/commercial hardening (PR #227)

A follow-up branch from certified SHA `647fe6323f60a05766213f5869210b81034d7012` addresses the remaining signed-in usability and first-customer Enterprise AI provisioning gaps. It scopes Billing and Platform Control module DB reads to the request lifecycle; adds confirmed/versioned admin changes; adds migration `0037_enterprise_ai_pricing_policy`; introduces server-authoritative automatic Enterprise AI credit allocation, provider-cost-derived draft rate cards, and immutable zero-dollar manual credit grants; clarifies Azure Foundry configuration; and documents the strict customer/internal commercial boundary in `docs/MKETY_ENTERPRISE_AI_PRICING_PROVISIONING.md`.

Customer-facing surfaces must not expose provider costs, internal envelope/reserve/multiplier values or credit-conversion policy. Customers see their commercial price/top-ups, credits, usage, capabilities and simple Mkety model rates. Production inference remains fail-closed until controlled first-customer acceptance.
