# Mkety Root-Domain Mail Routing with Zoho Hello Relay

**Date:** 2026-10-08  
**Status:** Draft for owner review; no implementation or DNS cutover is authorized by this document alone  
**Repository:** `MketyDigital/mksaas`  
**Branch:** `codex/mail-cloudflare-root-router-zoho-hello-relay`

## Goal

Host Mkety's platform email addresses on Mkety Mail at the root domain, including `info@mkety.com` and `support@mkety.com`, while retaining the existing `hello@mkety.com` mailbox in Zoho for now. Use Cloudflare Email Routing as the root inbound router. Preserve Brevo as ZITADEL's rollback provider until first-party application and authentication email flows pass acceptance tests.

## Owner-approved direction and constraints

- The user selected Cloudflare as the inbound router and wants only `hello@mkety.com` to remain hosted in Zoho.
- `info@mkety.com`, `support@mkety.com`, and other approved platform addresses must be actual Mkety Mail mailboxes or routes, not Zoho aliases.
- The previous direction to block root-domain Mail and use `info@mail.mkety.com` is superseded for the platform addresses by this request.
- The existing Zoho mailbox and its messages must remain intact and reachable.
- No root MX, SPF, DKIM, DMARC, Cloudflare Email Routing, Email Sending, ZITADEL, or Brevo changes occur until the implementation is reviewed, tested, and a rollback snapshot is ready.
- Customer Mail access remains gated. Do not enable external Mail clients for customer tenants.
- Do not store or print mailbox credentials in Git, workflow logs, application logs, audit events, or chat.

## Chosen architecture

Cloudflare Email Routing owns the root-domain MX after a controlled cutover and dispatches inbound mail to a dedicated, recipient-aware Email Worker. The Worker handles exact approved addresses only:

1. `info@mkety.com`, `support@mkety.com`, and explicitly provisioned Mkety addresses are ingested into their tenant-isolated Mkety Mail mailbox through the authenticated internal ingress path. The Worker acknowledges delivery only after durable acceptance.
2. `hello@mkety.com` is relayed to the existing Zoho mailbox using Zoho's authenticated SMTP submission endpoint over implicit TLS. The relay is restricted to this exact destination and uses a dedicated SMTP credential for the hello mailbox (prefer an app-specific password if the account supports one), stored only as a Cloudflare Worker secret. It must preserve the original message content and sender/reply information in a safe forwarded-message representation. It must not send through the public root MX, which will point back to Cloudflare.
3. Unknown recipients are rejected with a permanent recipient error. They are never silently discarded, caught into an unmonitored mailbox, or forwarded to an arbitrary address.

Zoho documents SMTP submission for Free Organization users, requires authentication, and notes that the correct server endpoint may depend on the account's data center. The implementation must confirm the exact endpoint shown for this mailbox; it must not assume a region-specific hostname. Cloudflare Email Workers can receive and process messages, while Workers cannot open outbound SMTP connections on port 25. The chosen Zoho path therefore uses authenticated SMTP submission on the account-supported TLS submission port rather than forwarding `hello@mkety.com` back through root MX.

## Addresses and sender identity

- Configure an active Mkety Mail mailbox for `info@mkety.com` and `support@mkety.com` under the reserved first-party tenant.
- Route platform transactional mail through the existing Mkety Mail sender/queue/gateway pipeline using `info@mkety.com` as the sender after the root domain passes live SPF, DKIM, and DMARC checks.
- Use `support@mkety.com` as the reply destination for support-related messages. Other transactional categories must use a documented, monitored reply destination.
- Keep `hello@mkety.com` in Zoho as a distinct mailbox. Do not create Zoho aliases for `info@` or `support@`.
- Retire the transitional `info@mail.mkety.com` sender only after application, ZITADEL, and support-path acceptance passes and the rollback window is complete.

## DNS and provider handling

Before any mutation, capture and review the exact current records and settings for root MX, SPF, DKIM selectors, DMARC, MTA-STS/TLS-RPT, Cloudflare Email Routing, and Email Sending. Root Zoho MX currently carries inbound mail and root DMARC is `p=none`; preserve the existing policy.

For a reviewed cutover:

- Configure Cloudflare Email Routing and its exact-address Worker rules for `mkety.com`.
- Add Cloudflare's required root MX and routing-authentication records only after confirming the Worker, Zoho relay, destination credentials, rollback, and test evidence.
- Merge SPF authorization for active Zoho and Cloudflare send/forward services into one valid SPF record; never publish multiple SPF records. Respect the ten-DNS-lookup SPF limit.
- Add required Cloudflare DKIM selectors alongside existing selectors; do not replace Zoho's selector.
- Preserve the current DMARC policy and reporting values unless a separate approved change is required.
- Configure Cloudflare Email Sending for the root sender only after assessing its record changes against existing Zoho authentication and confirming exact public DNS matches.
- Keep Cloudflare Email Routing and Email Sending as separate readiness checks; sending readiness does not prove inbound routing readiness.

## Failure handling and security

- The Worker accepts only exact configured recipients and enforces message-size limits, rate limits, abuse controls, and idempotent handling.
- For Mkety mailbox delivery, validate the recipient-to-tenant/mailbox mapping, authenticate internal Worker-to-app callbacks, persist the raw message and metadata, and acknowledge only on durable success.
- For Zoho relay, use a dedicated app-specific credential for the hello mailbox if Zoho supports it for this account. Treat it as mailbox-level access, not an SMTP-only permission. Keep it in a Worker secret, rotate it, redact it from diagnostics, and limit the relay function to `hello@mkety.com`.
- If either destination is temporarily unavailable, return a retryable SMTP failure so the sender can retry; never return success while losing the message.
- Reject unknown recipients and unsafe/oversized messages without exposing mailbox existence beyond normal SMTP behavior.
- Ensure retries cannot create duplicate inbox messages. Use a stable message identifier plus recipient as the idempotency key.
- Preserve original message data without logging message bodies, credentials, tokens, or full personal recipient data.

## Staged rollout and acceptance

1. **Code and design review:** update the previous root-domain guard and first-party readiness paths only on a reviewed PR. Add tests for exact address routing, Zoho relay restriction, spoof/tampering, duplicate delivery, retry/failure handling, unknown recipients, SPF/DKIM/DMARC checks, and tenant isolation.
2. **Credential readiness:** obtain a dedicated Zoho SMTP credential through the mailbox owner's supported account controls, preferring an app-specific password and never using the primary account password. Add it only to the Worker secret store; never put it in GitHub source or workflow output.
3. **Non-root route test:** deploy and test the Worker using a controlled test domain/address without touching root MX. Verify both the Mkety Mail ingest path and Zoho mailbox delivery using external test senders.
4. **Production preflight:** verify reserved tenant/workspace/entitlement, active root-domain mailboxes, outbound sender authentication, Cloudflare Email Routing permission, Zoho relay authentication, and the complete root DNS snapshot. The current production readiness report says the reserved workspace/domain/mailbox are missing; those gates must pass first.
5. **Root cutover:** in one guarded change, route root MX to Cloudflare and install exact recipient rules. Immediately test incoming `hello@` to Zoho and `info@`/`support@` to Mkety Mail from independent external accounts. Verify replies and operational notifications.
6. **Application and ZITADEL acceptance:** test signup verification, password recovery, invitation, billing notifications, support delivery/reply, delivery event visibility, retry behavior, and deduplication. Keep Brevo active until all ZITADEL cases pass.
7. **Rollback:** retain a machine-readable pre-change DNS snapshot and an action that restores the previous Zoho MX records and previous routing behavior. Keep both providers' required authentication records until rollback is no longer needed. Do not remove the Zoho mailbox or data.

## Stop conditions

Stop before root DNS changes if any of the following is true:

- The Worker cannot use the account's authenticated Zoho SMTP endpoint securely.
- No dedicated credential can be created or safely stored without exposing the primary account password.
- The exact Zoho mailbox fails the SMTP self-delivery test.
- The app has no durable, authenticated inbound-ingest path for the reserved workspace/mailboxes.
- The root SPF/DKIM/DMARC changes cannot preserve both Zoho and Cloudflare send/forward authentication.
- Cloudflare Email Routing permissions are unavailable or the live routing state cannot be inspected.
- The reserved first-party workspace, mailbox, or sending readiness is missing.
- The tested rollback does not restore the previous Zoho inbound behavior.

If a stop condition is met, keep root Zoho MX unchanged and Brevo active. Report the exact missing control or credential; do not substitute aliases or change the user's mail-hosting choice.

## Known evidence and open checks

- The controlled Cloudflare send from `info@mail.mkety.com` to `hello@mkety.com` was received. It proves that isolated subdomain outbound delivery only.
- The production Mail deploy succeeded, but its readiness report showed the first-party workspace/domain/mailbox missing and sending disabled.
- Root DNS inventory showed Zoho MX and DMARC `p=none`; no root MX or Email Routing changes were made.
- The previous Cloudflare Email Routing status read returned HTTP 403. The deployed route and current permission scope must be verified before cutover.
- The user selected this Cloudflare-router path on 2026-10-08. This spec requires review before the implementation plan and code changes.
