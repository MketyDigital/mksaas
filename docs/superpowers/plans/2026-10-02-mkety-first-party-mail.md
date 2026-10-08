# Mkety First-Party Mail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route Mkety account, invitation, transactional and support email through Mkety Mail using `info@mail.mkety.com` with `hello@mkety.com` as Reply-To, with tenant isolation and existing delivery safeguards intact.

**Architecture:** Keep ZITADEL responsible for identity flows and point its SMTP provider at the existing Mkety SMTP gateway. Add a server-only application sender contract that records and queues through Mkety Mail, plus a platform-owned workspace and SMTP-only credential path that does not enable external Mail clients for customer tenants.

**Tech Stack:** TypeScript, Next.js server actions/routes, Drizzle/PostgreSQL, Cloudflare Email Sending and Queues, ZITADEL SMTP provider, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-02-mkety-first-party-mail-and-starpips-pilot-design.md`

## Global Constraints

- Use the reserved platform-owned tenant and approved internal Mail entitlement; never borrow a customer tenant or bypass customer entitlements.
- Keep `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED` disabled for customer tenants throughout this work.
- Use the existing Mail message, queue, delivery-event and suppression path; do not add a provider bypass.
- Keep the current ZITADEL provider available for rollback until Mail-backed auth acceptance passes on the exact candidate SHA.
- Do not log SMTP credentials, passwords, reset tokens, invitation tokens or message bodies containing secrets.
- Inspect current `mkety.com` mail DNS and routing state before any DNS mutation; keep the root Zoho MX and DMARC unchanged; never enable Cloudflare Email Routing or Email Sending on the `mkety.com` apex; reserve `mail.mkety.com` for the configured first-party tenant.
- Do not treat Cloudflare Email Sending's `enabled` flag as SPF/DKIM/DMARC verification. Require exact public DNS matches for all three before marking first-party sender authentication verified; the Ops status update must repeat that live check.
- Do not modify files under `customer-apps/assist` or rewrite the standalone Assist branch.

## Review Focus

- Missing or malformed recipient, category or idempotency key must reject before message creation; cover in `platform-sender.test.ts`.
- Replay of the same transactional notification must not create another queued email; cover in the idempotency tests and its migration test.
- Existing customer credentials must be denied at authentication while external clients are disabled, while the configured first-party SMTP credential must authorize SMTP and reject IMAP; cover in gateway protocol/auth tests.
- A non-operator must not read or mutate the reserved support inbox, even when they are a normal Mail tenant admin; cover in support inbox authorization tests.
- Missing Mail readiness, active suppression or exceeded send capacity must fail closed without marking a message delivered; cover in sender and gateway tests.

---

### Task 1: Read-only Mail and auth preflight

**Files:**
- Read: `.github/workflows/mkety-zitadel-email-reconcile.yml`
- Read: `src/shared/db/schema/mail.ts`
- Read: `src/features/mail/server/{workspace,app-password-actions,shared-inbox-actions}.ts`
- Read: `docs/handoffs/2026-09-29-mail-production-gateway-next.md`

**Interfaces:**
- Produces: recorded, non-secret readiness facts for the reserved tenant, workspace, `mail.mkety.com` sending domain and `info@mail.mkety.com` mailbox, SMTP gateway and current ZITADEL provider; DNS inventory for MX, SPF, DKIM, DMARC and Cloudflare Email Routing; a producer inventory with any explicit exceptions.

- [x] **Step 1: Capture read-only DNS and provider state**

Run approved read-only DNS/provider diagnostics. Record current MX and routing ownership and whether required sending/authentication records are already valid. Do not mutate DNS or print secret values.

Evidence (2026-10-07): read-only Cloudflare/ZITADEL preflight run `37682717115` succeeded. Cloudflare DNS: apex SPF absent; MX remains Zoho (`mx.zoho.com` priority 10, `mx2.zoho.com` 20, `mx3.zoho.com` 50); DMARC is `p=none`; `resend._domainkey` exists; `imap` and `smtp` A records are DNS-only at `89.168.70.209`; `mail`, `autoconfig`, and `autodiscover` each have proxied AAAA `100::`. Cloudflare Email Routing settings returned HTTP 403, so its enabled state remains unknown. ZITADEL's active provider is Brevo SMTP at `smtp-relay.brevo.com:587`, sender `hello@mkety.com`, TLS on; the API did not return a password. No DNS or provider changes were made. This closes the inventory step with the 403 explicitly recorded; it does not establish Mail sender readiness.

- [ ] **Step 2: Capture reserved workspace and live ZITADEL state**

Use the configured operator/production diagnostics to record whether the reserved tenant, Mail workspace, entitlement, domain, mailbox and app credential exist, and whether ZITADEL currently uses the legacy SMTP provider. Store identifiers and status only; never dump credentials.

Current result: ZITADEL provider/login state is captured by run `37682717115`; the reserved tenant, workspace, entitlement, `mkety.com` Mail-domain row, `info@mkety.com` mailbox and SMTP-only app credential still lack read-only production evidence. Keep this step open.

- [ ] **Step 3: Inventory application email producers**

Search `src/` for outbound email clients, invitation generation, account notices, billing/payment notices, domain/product notices and support sends. Save the exact call sites and classify each as ZITADEL, first-party Mail, or a named operational exception.

- [ ] **Step 4: Verify preflight evidence**

Review the evidence against the spec's open preflight facts. Expected: no DNS changes, no external-client flag changes, and explicit stop conditions for missing sender readiness or conflicting MX ownership.

### Task 2: Add SMTP-only platform credential scope

**Files:**
- Modify: `src/shared/db/schema/mail.ts`
- Create: next sequential `src/shared/db/migrations/0039_mail_app_password_protocol_scope.sql` (confirm the next migration number first)
- Modify: `src/features/mail/server/app-password-actions.ts`
- Modify: `src/features/mail/server/gateway-auth.ts`
- Modify: `src/features/mail/server/external-clients.ts`
- Modify: `src/app/api/internal/mail/gateway/auth/route.ts`
- Modify: `ops/mail-gateway/gateway.mjs`
- Modify: `src/features/mail/server/admin-actions.ts`
- Create: `src/features/mail/components/FirstPartySmtpCredentialForm.tsx`
- Modify: `src/app/ops/[tenant]/platform-control/[module]/page.tsx`
- Modify: `.github/workflows/mkety-mail-production.yml` to pass the reserved tenant ID without printing it
- Modify: `src/features/mail/server/gateway-protocol.test.ts`
- Modify: `src/features/mail/server/gateway-request-lifecycle.test.ts`
- Create: `src/features/mail/server/gateway-auth.test.ts`
- Create: `src/features/mail/server/first-party-smtp-credential.test.ts`
- Create: `src/app/api/internal/mail/gateway/auth/route.test.ts`
- Test: focused tests above and migration baseline

**Interfaces:**
- Produces: `mailAppPasswords.protocolScope: 'all' | 'smtp'`; customer-created app passwords explicitly retain `'all'` behavior; an Ops-only `createFirstPartySmtpCredential(opsTenantSlug, state, formData)` action can create one credential scoped to `'smtp'` for the reserved mailbox and reveal it once.
- Gateway authentication consumes protocol scope and enforces `mailExternalClientsEnabled()` for customer credentials at authentication time, still checks workspace/mail entitlement and mailbox/domain readiness, rejects IMAP for `'smtp'` credentials, and permits this exact reserved-mailbox credential when global customer external-client access remains disabled.
- The reserved tenant is identified only by required server setting `MKETY_FIRST_PARTY_MAIL_TENANT_ID`; missing setting or tenant mismatch fails closed. The setting is not a customer-selectable form value.

- [x] **Step 1: Write failing protocol and provisioning tests**

Assert default/customer credentials remain all-protocol, customer authentication is denied while `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED` is false, first-party provisioning requires Platform Control access plus `platform:plans`, the configured reserved tenant, active `info@mail.mkety.com` mailbox and `workspace.mail` entitlement, and SMTP-scoped credentials are rejected on IMAP but accepted on SMTP. Missing `MKETY_FIRST_PARTY_MAIL_TENANT_ID` must fail closed.

- [x] **Step 2: Run focused tests to verify failures**

Run: `pnpm test -- --runTestsByPath src/features/mail/server/gateway-protocol.test.ts src/features/mail/server/gateway-auth.test.ts src/features/mail/server/first-party-smtp-credential.test.ts src/app/api/internal/mail/gateway/auth/route.test.ts`
Expected: new protocol-scope assertions fail before implementation.

- [x] **Step 3: Add scope schema and migration**

Add a non-null protocol-scope column defaulting existing rows to `'all'`; update the Drizzle schema and migration metadata using the repository's migration workflow. A special first-party path must be scoped by the reserved tenant and mailbox, never a tenant-wide feature bypass.

- [x] **Step 4: Enforce scope at the gateway boundary**

Pass requested protocol into credential verification and refuse IMAP for SMTP-only credentials. When external clients are disabled, refuse customer app-password authentication even if an old active password remains; allow only the configured first-party tenant's SMTP-scoped credential. Keep SMTP rate limits, mailbox/domain checks, suppression handling and queueing unchanged.

- [x] **Step 5: Add guarded first-party credential provisioning**

Provide `createFirstPartySmtpCredential(opsTenantSlug, state, formData)` in `src/features/mail/server/admin-actions.ts`. Require existing `requireMailOps` (Platform Control access plus `platform:plans`), resolve the tenant only from `MKETY_FIRST_PARTY_MAIL_TENANT_ID`, require its active workspace and `workspace.mail` entitlement, and select only its active `info@mail.mkety.com` mailbox. Associate the authenticated operator's user ID, audit the issuance, and show the secret once through `FirstPartySmtpCredentialForm` on the `mail-operations` Platform Control page. The action must not accept a target tenant ID, switch on external-client access or grant IMAP. Pass the configured tenant ID through `.github/workflows/mkety-mail-production.yml` without echoing it.

- [x] **Step 6: Run tests and migration checks**

Run: `pnpm test -- --runTestsByPath src/features/mail/server/gateway-protocol.test.ts src/features/mail/server/gateway-auth.test.ts src/features/mail/server/first-party-smtp-credential.test.ts src/app/api/internal/mail/gateway/auth/route.test.ts src/features/mail/server/gateway-request-lifecycle.test.ts` and `pnpm db:check:migrations`.
Expected: protocol scope tests pass and migration baseline passes.

### Task 3: Implement the first-party transactional sender

**Files:**
- Create: `src/features/mail/server/platform-sender.ts`
- Create: `src/features/mail/server/platform-sender.test.ts`
- Modify: `src/shared/db/schema/mail.ts`
- Create: next sequential mail migration for a tenant-scoped nullable idempotency key and unique index (confirm sequence after Task 2)
- Modify: `src/app/api/internal/mail/gateway/submit/route.ts` only if shared dispatch policy needs parity

**Interfaces:**
- Produces: `sendPlatformMail(input: { category: PlatformMailCategory; to: string; subject: string; text: string; html?: string; idempotencyKey: string }): Promise<{ ok: true; messageId: string; status: 'queued' | 'duplicate' } | { ok: false; reason: 'invalid_recipient' | 'category_not_allowed' | 'invalid_request' | 'not_ready' | 'suppressed' | 'rate_limited' | 'queue_failed' }>`.
- `PlatformMailCategory` is a closed union for `invitation`, `account_security`, `billing`, `payment`, `domain_status`, `product_status`, `support_acknowledgement`, and `support_reply`.

- [x] **Step 1: Write sender contract tests**

Cover recipient validation, allowed categories, fixed sender `info@mail.mkety.com` and Reply-To `hello@mkety.com`, bounded message fields, idempotent replay, missing reserved workspace/mailbox, suppression, capacity limits and queue failure.

- [x] **Step 2: Run focused tests to verify failures**

Run: `pnpm test -- --runTestsByPath src/features/mail/server/platform-sender.test.ts`
Expected: tests fail because the sender contract is not implemented.

- [x] **Step 3: Add idempotency storage**

Add a nullable idempotency key to `mailMessages` with a unique index scoped by tenant; use the next available migration number and preserve existing rows.

- [x] **Step 4: Implement `sendPlatformMail`**

Resolve only the reserved first-party tenant/workspace/mailbox; validate category and inputs; create the ordinary outbound Mail message; enforce existing suppressions and send capacity; queue through `pushMailQueueBatch`; return duplicate on idempotent replay; mark queue failures visibly. Never log body or token values.

- [x] **Step 5: Run focused tests and migration baseline**

Run: `pnpm test -- --runTestsByPath src/features/mail/server/platform-sender.test.ts` and `pnpm db:check:migrations`.
Expected: all sender assertions and the migration baseline pass.

### Task 4: Deliver tenant invitations through Mail

**Files:**
- Modify: `src/features/admin/services/invite-service.ts`
- Modify: `src/features/admin/services/__tests__/members-service.test.ts` or create `src/features/admin/services/__tests__/invite-service.test.ts`
- Modify: `src/features/admin/components/InvitesClient.tsx` only if it needs to display a delivery failure/resend state

**Interfaces:**
- Consumes: `sendPlatformMail` with category `invitation` and an idempotency key derived from the invite record and send attempt.
- Produces: invitations are not reported as successfully delivered unless queued; failed sends remain pending/retryable without exposing the raw token in logs.

- [x] **Step 1: Write failing invitation delivery tests**

Assert created invites queue one email with the expected expiry and invitation URL, duplicate invite attempts do not send twice, retry is safe, and failure does not log or leak the invite token.

- [x] **Step 2: Run focused invitation tests to verify failure**

Run the new invite-service test by path.
Expected: delivery assertions fail before wiring.

- [x] **Step 3: Queue the invitation through the first-party sender**

Call `sendPlatformMail` after durable invitation creation. Use the sender's idempotency contract and return a clear delivery-pending/error result while preserving the invite for safe resend.

- [x] **Step 4: Verify invite tests**

Run the invite-service test by path.
Expected: invite URL expiry, idempotency and safe failure tests pass.

### Task 5: Keep reserved Mail inbox access operator-only (inbound Zoho remains separate)

**Files:**
- Modify: `src/features/mail/server/workspace.ts`
- Modify: `src/features/mail/server/shared-inbox-actions.ts`
- Modify: `src/app/app/[tenant]/mail/shared/page.tsx`
- Create or modify focused authorization tests beside the touched server modules

**Interfaces:**
- Produces: a platform-operator-only access predicate for the reserved first-party Mail tenant; ordinary tenant membership and Mail entitlement checks remain unchanged for all customer workspaces.

- [x] **Step 1: Write failing cross-tenant and non-operator access tests**

Assert a normal customer admin cannot read or mutate the reserved support inbox, a platform operator can, and customer Mail inbox access continues to require tenant membership plus `workspace.mail` entitlement.

- [x] **Step 2: Run focused authorization tests to verify failure**

Run the new support authorization test by path.
Expected: the reserved-inbox access assertions fail before implementation.

- [x] **Step 3: Add the reserved-inbox operator boundary**

Gate support inbox reads and actions on platform operator identity and the exact reserved tenant. Do not broaden access by tenant slug alone.

- [x] **Step 4: Verify authorization tests**

Run focused tests for reserved and customer Mail access.
Expected: operator-only reserved access and unchanged customer entitlement behavior pass.

### Task 6: Route all application transactional producers

**Files:**
- Modify each producer recorded in Task 1; expected first call site: `src/features/admin/services/invite-service.ts`
- Modify: `src/features/mail/server/platform-sender.test.ts` for producer-contract coverage
- Modify: `docs/handoffs/2026-09-29-mail-production-gateway-next.md`

**Interfaces:**
- Consumes: `sendPlatformMail` or ZITADEL's SMTP provider for identity-owned messages.
- Produces: a complete producer inventory where each customer-facing transactional producer is routed to the correct Mail path or documented as an explicit infrastructure exception.

- [x] **Step 1: Add producer-specific tests before each wiring change**

For billing/payment, domain/product status and support acknowledgements/replies found in Task 1, assert category, recipient, idempotency key and safe failure behavior. Do not add sends for categories without an existing product event.

- [x] **Step 2: Run each focused test to verify the gap**

Run the owning test file for each producer.
Expected: new assertions fail until that producer uses the shared sender.

- [x] **Step 3: Wire each existing producer**

Route each actual producer through `sendPlatformMail`. Leave ZITADEL verification/recovery with ZITADEL SMTP. Record any non-application producer as an explicit operational exception in the handoff.

- [x] **Step 4: Verify inventory completeness**

Run the producer contract tests and repeat the source search from Task 1.
Expected: every inventoried first-party transactional producer maps to one supported path or a documented exception.

### Task 7: Reconcile ZITADEL to Mkety SMTP with rollback

**Files:**
- Modify: `.github/workflows/mkety-zitadel-email-reconcile.yml`
- Create or modify: workflow validation tests/scripts if the repository has a suitable workflow-contract test; otherwise validate the YAML and safe output locally

**Interfaces:**
- Consumes: existing SMTP gateway host `smtp.mkety.com:465`, SMTP-only platform credential and operator-controlled sender `info@mail.mkety.com` with Reply-To `hello@mkety.com`.
- Produces: workflow configuration that can test and activate Mkety SMTP while retaining the current Brevo provider values and an explicit rollback operation.

- [x] **Step 1: Write workflow contract checks**

Assert secrets are masked, no credential value is logged, the active SMTP provider is verified, the Mail provider test precedes activation, legacy Brevo configuration is retained, and rollback remains possible.

- [x] **Step 2: Run checks to verify missing behavior**

Run the workflow contract test or validator.
Expected: Mkety provider and rollback assertions fail before workflow changes.

- [x] **Step 3: Add Mail-backed provider selection and safe rollback**

Add explicit provider selection using the new SMTP-only credential. Keep the current Brevo provider definition intact. Do not automatically activate the new provider until readiness and delivery tests succeed.

- [x] **Step 4: Validate workflow configuration**

Run the workflow contract tests and repository YAML validation.
Expected: selected provider behavior, masking, test-before-activation and rollback checks pass.

### Task 8: Run controlled Mail acceptance and document evidence

**Files:**
- Modify: `docs/handoffs/2026-09-29-mail-production-gateway-next.md`
- Modify: `docs/README.md` only if its current index needs the new acceptance record
- Read: Mail and ZITADEL workflows used for acceptance

**Interfaces:**
- Produces: evidence for SMTP provider test, actual controlled delivery, signup verification, password reset, invitation, account/billing notification, and support notification/reply through the Zoho `hello@mkety.com` inbox; exact SHA, workflow IDs, feature flag state and rollback provider recorded.

- [x] **Step 1: Run non-mutating readiness and workflow checks**

Run: `pnpm test -- --runTestsByPath src/features/mail/server/platform-sender.test.ts src/features/mail/server/gateway-protocol.test.ts src/features/mail/server/gateway-request-lifecycle.test.ts` and `pnpm db:check:migrations`.
Expected: focused Mail checks and migration baseline pass; external-client flag remains off.

Local evidence on 2026-10-02: 11 focused suites / 52 tests passed, migration baseline passed, and no live flag/provider mutation was made. Full repository Jest has 7 child-process `EPERM` failures in two unrelated suites in this restricted environment; see the SDD progress ledger. Full CI gates remain required.

- [ ] **Step 2: Verify DNS and reserved sender readiness**

Repeat read-only DNS and Mail provider diagnostics. Never alter root Zoho MX/DMARC. Stop if the isolated sending domain records do not verify.

Evidence: Cloudflare Email Sending setup run `37742125709` enabled only `mail.mkety.com`, creating Cloudflare bounce MX/SPF/DKIM and `_dmarc.mail.mkety.com` (`p=reject`). The workflow verified apex Zoho MX and apex DMARC unchanged. A controlled test in run `37742278847` passed the provider's SPF/DKIM/DMARC gate and was accepted into the queue for `hello@mkety.com`; inbox/server delivery remains unconfirmed. This verifies isolated sending DNS, not the reserved Mail tenant/workspace/domain/mailbox or the SMTP gateway sender binding. Do not require apex MX for outbound sender readiness: root MX remains an inbound Zoho requirement only. Keep this step open until the reserved sender and mailbox diagnostics pass.

Code safeguard added in PR #355: public SPF, DKIM, and DMARC answers must match Cloudflare's expected records before the platform domain enters `sending_ready`; the Ops update path performs the same check. The `mkety.com` apex is rejected before Cloudflare provisioning, and `mail.mkety.com` is reserved for the configured platform tenant. These safeguards do not substitute for reserved mailbox, credential, or actual recipient-delivery evidence.

- [ ] **Step 3: Test actual controlled recipient delivery**

Use the configured platform-operator email only. Test ZITADEL SMTP and the gateway; confirm Mail message state and delivery event without exposing recipient or secret in logs.

- [ ] **Step 4: Exercise complete auth and support paths**

On the candidate release SHA, execute controlled signup verification, recovery, invitation, transactional notification and a controlled support notification/reply to the Zoho inbox. Confirm rollback can restore the prior ZITADEL provider.

- [ ] **Step 5: Record exact evidence**

Update the handoff with exact SHA, workflow/run identifiers, outcomes and remaining exceptions. Do not state production acceptance from local tests alone.

- [ ] **Step 6: Run the complete repository gates**

Run: `pnpm test`, `pnpm type-check`, `pnpm lint`, `pnpm build`, `pnpm db:check:migrations`, and applicable Cloudflare/vinext acceptance. Expected: all required gates pass on the same candidate SHA.

- [x] **Step 7: Integrate without dropping Mkety changes**

Before publishing, inspect the latest GitHub `main` and replay only Mkety changes onto it using a non-force update. Confirm payment-fix commits are still present and no `customer-apps/assist` files or standalone Assist history are included. Open a reviewable PR and require exact-head checks.

Evidence: PR #348 was merged into `main` as `403b8cf7ea65d5795ba21c8127022259b66774d7`. It preserved the main merge base, had no Assist paths in its 41-file diff, and passed exact-head checks and candidate validation at `a8ad556fb46c3ed3adfe34e5e139fb47247d0857`. This closes repository integration only; Task 8 live readiness and customer delivery acceptance remain open.
