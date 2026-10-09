# Mkety First-Party Mail and Starpips Mail Customer Design

> **Address topology superseded (2026-10-09):** use `docs/superpowers/specs/2026-10-09-mkety-full-domain-mail-cutover-design.md` for root-domain hosting and cutover. The following address-split amendment is historical; it does not authorize keeping `hello@` in Zoho or forwarding other root addresses there.

## Historical address split amendment — superseded

This former proposal superseded the earlier `info@mail.mkety.com` sender and Zoho-only support clauses below. It proposed:

- `hello@mkety.com` remains hosted in Zoho and is never routed into Mkety Mail.
- `info@mkety.com`, `support@mkety.com`, and other explicitly created Mkety root mailboxes are stored in the reserved Mkety Mail workspace.
- Preserve the root Zoho MX and existing root DMARC records. Cloudflare Email Routing must not be enabled on the `mkety.com` apex.
- Cloudflare Email Sending may be enabled for the apex only for the reserved first-party tenant after exact public SPF/DKIM verification. Keep existing root DMARC unchanged; a published valid root DMARC policy is sufficient. The sending setup must not add or replace apex MX records.
- Zoho remains the root inbound MX and selectively forwards non-`hello` Mkety mailboxes to exact Cloudflare Email Routing addresses on `mail.mkety.com`. The ingress Worker maps those forwarding addresses to the canonical root-domain Mail mailbox. Do not add a catch-all route.
- Platform transactional mail is sent from `info@mkety.com` with `support@mkety.com` as Reply-To. Public contact and help destinations that explicitly use `hello@mkety.com` continue to resolve to Zoho.

This preserves the Zoho account without making Zoho the stored inbox for `info@`, `support@`, or other configured Mkety mailboxes. Production readiness still requires confirmed Zoho forwarding, Cloudflare subdomain routing, root sending authentication, and a real Mail gateway delivery test.

**Date:** 2026-10-02
**Status:** Design approved by the user on 2026-10-02; customer and internal-test sequence confirmed on 2026-10-02
**Repository:** `mksaas`
**Work branch:** `codex/mkety-first-party-mail-20261002`

## Goal

Use Mkety Mail as the first-party email service for the Mkety Platform itself. Signup verification, password recovery and other ZITADEL account emails, platform invitations and transactional account notices should be sent through Mkety Mail. Use `info@mail.mkety.com` as the first-party transactional sender, and set `hello@mkety.com` as Reply-To and the human support address. Keep Zoho Free Mail and all root-domain Zoho MX records for `hello@mkety.com`; do not enable root Email Routing or move root inbound mail. Starpips is Mkety Mail's first paid enterprise customer, not an Enterprise AI customer. After Mail is working end to end for Starpips, use Mkety's own internal system to verify that Enterprise AI works.

All behavior must remain tenant-isolated, auditable, rate-limited and fail-closed. Customer mailbox access and Enterprise inference must retain their existing entitlement and production acceptance gates.

## Current Repository Evidence

- The identity adapter is ZITADEL. The application delegates signup, password, email verification and login policy to ZITADEL.
- `.github/workflows/mkety-zitadel-email-reconcile.yml` currently reconciles ZITADEL’s email provider to Brevo SMTP and includes repository-secret fallback names. It must be updated to support a Mail-backed provider, without printing secret values or deleting the current provider configuration.
- Mkety Mail already has a transactional send API, durable message records, a dispatch queue, Cloudflare Email Sending transport, delivery-event handling, inbound routing, mailbox authorization and a dedicated SMTP gateway.
- Gateway SMTP submission verifies an app password, active Mail workspace, `workspace.mail` entitlement, mailbox and sending-enabled domain. It then records and queues the outbound message. This path should be reused; customer authentication rules should not be weakened for first-party use.
- First-party platform invitations currently create an invitation link but do not deliver it through Mail.
- The Mail product and gateway have prior production acceptance evidence. Synthetic SMTP acceptance suppresses the destination and therefore does not prove actual recipient delivery.
- The production runbook keeps `MKETY_MAIL_EXTERNAL_CLIENTS_ENABLED` off until the controlled customer path passes. This design does not turn it on globally.
- The separate Enterprise AI product remains fail-closed and is outside the Starpips Mail pilot. This work does not enable or sell Enterprise AI to Starpips.

## Approved Direction

### First-Party Mail Identity

Create a Mkety-owned Mail workspace and mailbox for `info@mail.mkety.com` under a reserved platform-owned tenant. Verify outbound sending for the `mail.mkety.com` subdomain and its SPF/DKIM/DMARC records. Do not require or change root `mkety.com` MX for outbound readiness. The reserved workspace must use an explicitly approved, bounded internal Mail entitlement through the existing operator controls; no customer tenant is borrowed and no customer entitlement check is bypassed.

Use `info@mail.mkety.com` as sender and `hello@mkety.com` as Reply-To. This keeps replies in the existing Zoho Free Mail inbox while transactional messages use the isolated Cloudflare Email Sending subdomain. Keep system traffic recorded as ordinary Mail messages and delivered through the existing queue, event and suppression path. Do not create a second provider transport.

### ZITADEL Authentication Email

Configure ZITADEL’s active SMTP provider to submit through `smtp.mkety.com` over implicit TLS. Authenticate it with a dedicated, rotatable SMTP-only credential for the reserved platform mailbox. Provisioning that credential must be restricted to the platform operator and must not require enabling external IMAP/SMTP access for all tenants. It must not grant IMAP access. The `hello@mkety.com` support inbox remains with Zoho.

Use the same Mail SMTP path for ZITADEL verification, password reset and other ZITADEL-generated account security messages. Preserve the current provider configuration as an inactive rollback option until Mail-backed signup and recovery have passed on the exact release SHA. ZITADEL supports configurable SMTP providers and an explicit provider test operation ([ZITADEL notification-provider docs](https://zitadel.com/docs/guides/manage/customize/notification-providers), [SMTP provider API](https://zitadel.com/docs/reference/api/admin/zitadel.admin.v1.AdminService.AddEmailProviderSMTP)).

### Platform-Generated Transactional Email

Add one server-only, first-party Mail sender contract for application-generated notifications. It must use the reserved sender mailbox and existing Mail message/queue pipeline. Before enabling it, inventory all customer-facing email producers across the Platform and route each one through this contract or ZITADEL’s SMTP path. At minimum, check:

- tenant membership invitations, including safe link expiry and resend behavior;
- account security, verification and recovery messages;
- billing, payment and subscription status notifications;
- domain and product status notifications;
- support acknowledgements, operator replies and contact-form messages.

Record any email that remains outside Mail as an explicit infrastructure or operational exception with its reason. Do not assume email is unused because a source search found no shared sender yet.

The service contract must restrict allowed message categories and sender identity, validate recipient input, deduplicate retryable sends, apply rate limits, and avoid logging credentials, reset tokens or invitation tokens. Avoid adding marketing or bulk campaign sending to this path.

### Support Inbox

Keep root inbound `hello@mkety.com` on Zoho. Do not route root email to Cloudflare Email Routing. Replies to Mail-sent messages must target `hello@mkety.com`. Any later move of inbound support into Mkety Mail needs a separate DNS cutover plan.

Before changing DNS, inspect the current `mkety.com` MX, SPF, DKIM, DMARC and Cloudflare Email Routing state. Preserve existing mail service records unless a reviewed cutover explicitly replaces them. Keep the root Zoho MX and DMARC records byte-for-byte unchanged. Configure outbound sending only on `mail.mkety.com`, with Cloudflare bounce/authentication records below that subdomain.

Cloudflare documents that authenticated SMTP submissions enter the same delivery pipeline as its REST API and Workers binding, so the gateway remains part of Mkety Mail rather than a direct provider bypass ([Cloudflare SMTP docs](https://developers.cloudflare.com/email-service/api/send-emails/smtp/)).

### Starpips Paid Enterprise Mail Customer

Use Starpips as the first paid enterprise customer of Mkety Mail after the first-party Mail path is accepted. Reconcile the correct Starpips tenant and Mail commercial terms through Platform Control. Use the explicitly recorded Mail plan or approved custom contract, currency and price; do not invent or silently default commercial terms. Customer access is activated only by provider-verified payment settlement and the normal idempotent `workspace.mail` entitlement path. Do not grant paid access by direct database mutation or a browser return.

After payment, verify Starpips tenant isolation, Mail onboarding, its customer-owned domain, sending and receiving, mailboxes/team or shared inboxes within the recorded plan, suppression/rate/usage accounting, and support handling. Do not configure AI or represent Starpips as an AI customer in this pilot. Keep the stop/rollback path without deleting the tenant, Mail workspace, contract or payment audit trail.

### Internal Enterprise AI Acceptance After Starpips Mail

Only after the Starpips Mail customer acceptance passes, use a Mkety-owned non-production staging fixture to exercise the Enterprise AI runtime, commercial accounting, idempotency and tenant isolation. Reuse the existing guarded AI acceptance workflow and always clean up the fixture, restore the prior staging inference policy and preserve production `customerInferenceEnabled=false`. This is an internal product test, not a Starpips AI purchase and not evidence by itself for production inference promotion.

## Rollout and Verification

1. **Source and branch integrity:** preserve the payment branch and its commits. Build this work on the isolated Mail branch. The local GitHub remote-tracking reference is stale; GitHub `main` has newer Assist-only commits. Before publishing, replay the Mkety-only changes onto the latest `main` with a non-force update. Do not check out, edit, cherry-pick from, or rewrite the standalone Assist branch. Do not include files under `customer-apps/assist`.
2. **Code-level Mail gate:** add regression tests for the first-party sender authorization, the complete outbound email inventory, invitations, SMTP-only credential lifecycle, message queueing, recipient validation, suppression/limits, operator-only support access and fail-closed behavior. Run focused tests, then repository CI checks on the exact candidate SHA.
3. **DNS and Mail preflight:** read existing domain/provider state without mutation. Verify the reserved Mail workspace/domain/mailbox and outbound SPF/DKIM/DMARC readiness on `mail.mkety.com`. Confirm root Zoho MX and DMARC are unchanged; inbound Zoho routing is outside the Mail setup.
4. **First-party delivery test:** use the configured platform-operator email as the controlled test recipient. Run the provider’s SMTP test and actual Mail gateway delivery. Verify delivery events without exposing the recipient or secret in logs. Confirm external-client access remains disabled for customer tenants.
5. **Auth and app acceptance:** on the candidate release, exercise a controlled new-account signup, verification, password reset, invitation, account/billing notice, and a support notification/reply round trip through `hello@mkety.com`. Confirm ZITADEL uses Mail and that failed Mail delivery is visible and recoverable. Keep the old ZITADEL provider as rollback until this succeeds.
6. **Starpips Mail customer acceptance:** confirm tenant identity and explicit Mail contract terms; run customer checkout; require provider webhook/API settlement; verify one entitlement activation, idempotent replay behavior, tenant isolation and the complete customer Mail journey.
7. **Internal Enterprise AI acceptance:** only after Starpips passes, run the guarded non-production Enterprise AI commercial/runtime acceptance with an ephemeral Mkety-owned fixture. Verify model execution, accounting, idempotency and cleanup; leave production inference disabled.
8. **Promotion and records:** create a reviewable PR against current GitHub `main`, run exact-head checks, then use the guarded Mail release workflows only for an accepted SHA. Record workflow IDs, SHA, enabled flags and test outcomes in the current handoff/runbook. Do not publish customer readiness based on local tests alone.

## Success Criteria

- ZITADEL signup verification and password recovery mail is delivered through Mkety Mail from `info@mail.mkety.com` with Reply-To `hello@mkety.com`.
- Invitation and supported platform account notifications use the same first-party Mail sender contract and queue.
- `hello@mkety.com` remains the support inbox in Zoho; replies to platform mail reach that address.
- Existing customer Mail entitlements, suppression, rate limits, tenant isolation and external-client feature gate remain effective.
- Starpips Mail access becomes active only after verified payment settlement; the customer Mail workspace and usage are isolated and auditable.
- After Starpips Mail acceptance, the Mkety-owned non-production system completes Enterprise AI runtime and commercial-accounting acceptance; the staging fixture is cleaned up and production inference remains disabled.
- Automated checks pass on the exact PR head; production acceptance evidence is recorded separately from CI evidence.

## Explicit Non-Goals

- Enabling external IMAP/SMTP access globally before the customer acceptance gate.
- Sending marketing campaigns through transactional Mail.
- Replacing or deleting the existing ZITADEL provider before Mail-backed account flows pass.
- Forging payment, entitlement or acceptance evidence for Starpips.
- Selling or enabling Enterprise AI for Starpips as part of this Mail pilot.
- Running internal Enterprise AI acceptance before the Starpips Mail customer acceptance passes.
- Touching the separate Assist branch or changing Assist-only product files.

## Open Preflight Facts (Read Before Mutation)

- Current root Zoho MX and DMARC state, plus `mail.mkety.com` sending DNS readiness.
- Whether the reserved platform tenant, Mail entitlement, `info@mail.mkety.com` mailbox and app-password credential already exist.
- The exact Starpips tenant/contact, approved Mail plan or custom terms, currency/price and customer-controlled Mail domain.
- The current GitHub `main` head at the time the implementation PR is prepared.
