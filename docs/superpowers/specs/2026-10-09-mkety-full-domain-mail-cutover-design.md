# Mkety Full-Domain Mail Hosting and Migration Design

| Field | Value |
| --- | --- |
| Status | Approved by user 2026-10-09 |
| Date | 2026-10-09 |
| Repository | `mksaas` |
| Work branch | `feat/mkety-root-mail-address-split` |
| Scope | Move all `@mkety.com` inboxes to Mkety Mail, with a guarded Cloudflare inbound cutover and provider-neutral history importer. |

## Goal

Make Mkety Mail the single mailbox home for `@mkety.com`. The existing Zoho account has one mailbox, `hello@mkety.com`; `cloudflare@`, `billing@`, and the other addresses are aliases that currently forward into `hello@`. Import that one source mailbox once. Do not create duplicate source imports for aliases. The first independent Mkety Mail mailboxes are `hello@mkety.com`, `cloudflare@mkety.com`, `billing@mkety.com`, `info@mkety.com`, and `support@mkety.com`. After cutover, `cloudflare@`, `billing@`, and the other selected addresses must deliver to their own mailbox records instead of forwarding into `hello@`.

Migrate existing messages from Zoho and any other provider, including Spaceship Spacemail, through a provider-neutral importer. Do not move the domain's MX records until every named mailbox is provisioned, history import is reconciled, and real inbound and outbound acceptance checks pass. Keep the Zoho account available during cutover and the DNS-cache overlap so a rollback or delayed delivery can be handled without losing messages.

## Current Repository State

- The user confirmed there is one Zoho source mailbox (`hello@mkety.com`); other root addresses are aliases forwarding to it. The importer should therefore copy the Zoho mailbox once. Alias history is already part of that same mailbox and must not be duplicated into separate imports.
- The current split-address plan still leaves apex MX with Zoho and forwards selected addresses to exact `mail.mkety.com` Cloudflare routes. This design replaces that direction after review and implementation; its production evidence remains historical and must not be described as full-domain readiness.
- `src/features/mail/server/migration-actions.ts` currently accepts small batches of `.eml` files (at most 20 files / 25 MB total) and imports parsed messages into a mailbox. It is not a folder-preserving mailbox migration tool and has no generic IMAP source connector.
- Inbound Mail already runs through Cloudflare Email Routing and `mkety-mail-ingress`, resolves a recipient to a Mail mailbox, stores message content in R2, and persists message metadata in PostgreSQL.
- Cloudflare Email Routing is transport into the Worker, not mailbox storage or a user-facing inbox. Mkety Mail remains the mailbox and access-control system.
- Production DNS/provider inventory and the exact Zoho forwarding configuration must be rechecked read-only before any migration or DNS change. Earlier evidence recorded Zoho MX at the apex and a Cloudflare Email Routing settings API response of 403; that does not establish the current live state.

## Approved Direction

### All-domain inbound mail

At cutover, the `mkety.com` apex MX records will point to Cloudflare Email Routing, which sends mail to the existing `mkety-mail-ingress` Worker. The Worker resolves the full recipient (`hello`, `cloudflare`, `billing`, `info`, `support`, and future addresses) against the active Mkety Mail domain/mailbox records and stores messages in the selected mailbox. Remove Zoho MX only in the guarded cutover after the readiness gates pass.

Use a single apex catch-all Worker route, not one Cloudflare rule per mailbox. Cloudflare currently documents a 200 routing-rule limit per domain and allows a catch-all action to target a Worker; the Worker and Mkety database perform recipient-specific resolution. Unknown recipients must be rejected or safely bounced; they must not be silently filed in a default mailbox. Do not add a wildcard DNS MX record.

Cloudflare Email Routing and Zoho cannot both be active as competing primary MX delivery systems for the same apex. There is no supported per-recipient MX split that makes Zoho receive only `hello@` while Cloudflare receives the rest. After apex MX cutover, `hello@` is a normal Mkety Mail mailbox. Retain the Zoho service/account during the transition for source history, delayed deliveries, and rollback; do not depend on Zoho forwarding in the target design.

Outbound mail continues through the existing Mkety Mail queue and Cloudflare Email Sending configuration. Inventory all current senders and DNS authentication before changing records. Add or merge SPF authorization without creating a second SPF record; publish/verify Cloudflare DKIM; preserve a valid DMARC policy and existing third-party sender authentication that is still in use. Keep Cloudflare bounce/subdomain records and unrelated website/auth/billing DNS untouched. Sender readiness is a separate gate from inbound MX readiness.

### Mailbox ownership and capacity

Create `hello@`, `cloudflare@`, `billing@`, `info@`, and `support@` as distinct active Mail mailbox records before cutover. Verify ownership, sign-in/access, storage, and sending for each. Import Zoho's `hello@` mailbox once into the Mkety `hello@` mailbox. Do not attempt to split its historical messages by the alias originally addressed; Zoho exposes them as one mailbox, and the original recipient headers remain available for search. Retire the old alias-to-hello forwarding only after cutover acceptance; during DNS overlap, inspect the Zoho inbox and reconcile any late deliveries.

Use the reserved first-party `mkety-ops` workspace and current internal custom profile. “Create as many mailboxes as needed” means no public customer-plan mailbox cap for this internal workspace; it does not mean infinite storage, provider throughput, or operational capacity. Keep storage, anti-abuse, queue, send-rate, and platform capacity protections active. The one Worker catch-all removes Cloudflare's per-address rule ceiling from normal mailbox creation.

### Provider-neutral importer

Extend the existing migration experience rather than creating provider-specific Zoho-only code. The import job takes a source type, mailbox mapping, and resumable run ID:

1. **Generic IMAP over verified TLS**: user supplies server, port, TLS mode, username, and app password/credential; import all chosen folders. Use it for Zoho when IMAP access is available, Spaceship Spacemail, and other IMAP providers. Do not assume a provider has IMAP enabled or that every plan permits it; the connection preflight must report the source limitation without changing source settings.
2. **Archive import**: support EML and MBOX, with ZIP containers where all entries are supported formats. Keep the current bounded EML upload as a compatibility path, but move large imports to resumable background jobs. Zoho's official export supports ZIP/PST; confirm ZIP contents against a real user-provided sample before claiming compatibility. PST support is a separate format-adapter gate; if it cannot be safely parsed in the approved runtime, provide a documented conversion-to-EML/MBOX fallback rather than claiming PST support.

The importer must preserve raw message content, Message-ID, sender/recipient headers, sent/received date, attachments, folders, and read/unread state when the source format exposes them. Report per-folder counts, imported/skipped/failed totals, and reasons. Make retries idempotent using source mailbox + folder + source UID where available, then Message-ID/content fingerprint as fallback. Never delete or mark source messages read. Support an initial copy and a final delta sync after inbound traffic is directed to Mkety.

Store source credentials encrypted only for the duration of the job; redact them from logs, delete them on completion/abort, and let the user revoke them at the source. The IMAP runner must use egress restrictions and validate DNS/IP results to prevent SSRF, private-network access, and DNS-rebinding to internal services. Require TLS with certificate validation by default. Archive parsing must enforce decompressed-size, file-count, per-message, MIME-depth, attachment, and total storage limits; quarantine malformed or unsafe content without blocking the rest of a batch.

### Cutover states and safety gates

The implementation must expose auditable states: `inventory`, `mailboxes_ready`, `initial_import`, `acceptance`, `cutover_authorized`, `dns_overlap`, `delta_reconcile`, `complete`, and `rollback`. DNS mutation remains an explicit operator action behind the existing guarded workflow; a completed import or passing code test must not trigger MX changes automatically.

Do not authorize cutover until all of these pass on the exact deployed candidate:

1. **Read-only inventory:** record current MX, SPF, DKIM, DMARC, Cloudflare Email Routing/Sending settings, the single Zoho `hello@` mailbox and its aliases/forwarding, every live root address, current outbound senders, DNS TTLs, and backup/restore values. Identify where `cloudflare@` forwarding is configured; do not infer it.
2. **Mailbox readiness:** reserved tenant/workspace/domain and all five named mailbox records exist; each mailbox has tested access, capacity, and permitted send capability. Verify `hello`, `cloudflare`, and `billing` are separate mailbox IDs and routes.
3. **History import:** initial copy and final delta complete for the single Zoho `hello@` source mailbox. Compare source and destination folder/message counts, attachment totals, sample raw headers, dates, and sent-folder content. Confirm aliases were not imported as extra source mailboxes. Resolve or explicitly accept every failed/skipped item. Keep source unchanged.
4. **Real send and receive:** from each named Mkety Mail mailbox send to an external controlled mailbox and receive a message from an external controlled mailbox. Reply from Mkety Mail. Confirm messages appear only in the intended mailbox, with accepted queue/delivery status and valid SPF, DKIM, and DMARC results at the recipient. Include verification for `hello@`, the currently forwarded `cloudflare@`, and `billing@`; verify `info@` and `support@` as well.
5. **Production path checks:** verify Cloudflare Email Routing catch-all reaches the Worker; ingress resolves known addresses and rejects an unknown test address; R2 content and Postgres metadata persist; app inbox/read/reply works; SMTP gateway and ZITADEL transactional paths pass their applicable acceptance; delivery events and failure alerts are visible. Keep customer external-client flags unchanged unless separately accepted.
6. **Rollback rehearsal:** prove the prior MX/TXT records can be restored from the inventory, the existing Zoho mailbox remains accessible, both systems remain readable during overlap, and messages delivered to either side can be reconciled. Preserve the current ZITADEL provider separately until its own first-party send tests pass.

After authorization, lower TTL in advance where useful, switch apex MX to Cloudflare, and monitor delivery and queues continuously through at least the documented DNS TTL/cache overlap. Keep Zoho active and do not delete historical source messages. Run a final incremental import for late source mail, compare counts, and leave the migration in overlap until no new Zoho deliveries appear for the agreed monitoring window. If a gate fails, restore prior MX and preserve access to both inboxes; reconcile messages accepted by either system before declaring rollback complete.

## Non-goals

- No Zoho-to-Zoho forwarding chain or special Zoho gateway as the target architecture.
- No customer-visible automatic root MX changes during onboarding.
- No removal of Zoho or deletion of source messages on initial cutover.
- No assumption that Cloudflare Email Routing itself provides mailbox storage, IMAP, or a mailbox UI.
- No changes to `customer-apps/assist`, its branch, its standalone repository history, or unrelated customer projects.
- No blanket claim of unlimited mailbox storage or unlimited sending.

## External references checked 2026-10-09

- Cloudflare, [Email Routing rules and addresses](https://developers.cloudflare.com/email-service/configuration/email-routing-addresses/) and [Email Routing subdomains](https://developers.cloudflare.com/email-service/configuration/subdomains/): Worker destinations, catch-all availability at the apex, and subdomain boundaries.
- Cloudflare, [Email Service limits](https://developers.cloudflare.com/email-service/platform/limits/): routing-rule limits.
- Zoho, [Email account export and backup](https://www.zoho.com/mail/help/adminconsole/email-backup.html) and [Migration options](https://www.zoho.com/mail/help/adminconsole/migration.html): ZIP/PST and IMAP/archive migration paths.
- Spaceship, [Migrate emails to Spacemail](https://www.spaceship.com/knowledgebase/migrate-emails-to-spacemail/): Spacemail's migration tool uses IMAP source connectivity.

## Review decision

Approved by the user on 2026-10-09. The initial migration source is exactly one Zoho mailbox, `hello@mkety.com`; the other current addresses are aliases forwarding to it, so import the source once and do not duplicate history. The target is to move all root-domain inbound mail to Cloudflare Email Routing and Mkety Mail only after the import, mailbox-specific send/receive acceptance, and rollback gates pass. No production DNS, Zoho, Cloudflare, or mailbox configuration has been changed by this design document.
