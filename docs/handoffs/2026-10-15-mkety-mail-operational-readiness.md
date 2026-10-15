# Mkety Mail operational readiness — 2026-10-15

## Release and storage

- Latest main release: `a0df21ed5abe5186d86087d7d7ee9840b91950e7`.
- [Mkety Mail Production run 38742231316](https://github.com/MketyDigital/mksaas/actions/runs/38742231316) completed successfully for that exact SHA. Production database migration, app/app-host deployment, Mail Worker deployment, runtime binding checks, and production HTTP smoke all passed.
- The release's authenticated Mail content Worker R2 put/read/delete smoke passed.
- The `hello@mkety.com` archive run `3ba91016-e7f9-4baf-a624-664635ad1877` is complete with 354 imported and 0 failed. The first-party mailbox inventory contains independent `hello`, `cloudflare`, `billing`, `info`, and `support` records.

## Runtime acceptance still open

- Live readiness run [38715148412](https://github.com/MketyDigital/mksaas/actions/runs/38715148412) confirmed the public Mail HTTP surfaces and TLS reachability on `imap.mkety.com:993` and `smtp.mkety.com:465`. It explicitly does not verify SMTP/IMAP credentials, protocol behavior against production data, or real delivery.
- [Gateway Production run 38715614703](https://github.com/MketyDigital/mksaas/actions/runs/38715614703) stopped at release authorization before any gateway mutation. [Gateway Functional Acceptance run 38715667152](https://github.com/MketyDigital/mksaas/actions/runs/38715667152) was skipped because no successful gateway deployment exists.
- The authenticated first-party Ops panel shows root routing inactive and root sending authentication not ready. Retrying root domain setup returned `setup=error`; the page reports that the Cloudflare domain setup service could not be reached.
- No real application send/receive test, transactional-notification delivery, per-mailbox inbound test, rollback rehearsal, or post-cutover receive test has been recorded.
- No root MX or Cloudflare Email Routing cutover has occurred. Customer external IMAP/SMTP remains disabled. Starpips has not been provisioned.

## Immediate infrastructure prerequisite

The app-host Worker uses Cloudflare's v4 API, the same API used by the existing repository `CLOUDFLARE_API_TOKEN`. Per the user's instruction, the production workflow attaches that existing secret to `mkety-app-host` under the runtime binding name `MKETY_MAIL_CLOUDFLARE_API_TOKEN`; no second GitHub secret is needed. This shares the token's full permissions with the app-host. The isolated wiring change is ready for review; after it is merged and deployed, retry domain setup. Until Cloudflare domain setup succeeds, the system cannot authenticate outbound sending or prepare the temporary inbound test routes.

The cutover gate remains closed until the per-mailbox live send/receive tests, root SPF/DKIM/DMARC checks, saved root MX/TXT rollback snapshot, and rollback rehearsal all have evidence. After root activation, test each root inbox again and run the final `hello@` delta import before marking the cutover complete.
