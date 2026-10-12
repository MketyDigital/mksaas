# Mkety Mail archive upload release — 2026-10-12

## Scope

Deploy the merged same-origin multipart archive upload fix from PR #378 so the owner can import the Zoho export into the sole source mailbox, `hello@mkety.com`, without changing the migration source or recipients.

The production archive path is `POST /api/mail/migration/archive`. It checks workspace-manager access before parsing the multipart body, enforces origin and request-size limits, and calls the bounded idempotent importer. The import target remains the active Mkety `hello@` mailbox. All 354 EML messages from the uploaded archive are intended for that mailbox once; historical aliases stay in their original headers.

## Release guard

PR #378 merged as `007de3c92501f892d8a6ad7478045e64ba18b321`. The Mail Production workflow only deploys a main push when its commit message contains `[mail-production]`, or through an exact-SHA guarded manual dispatch. The purpose of this release record is to run that existing deployment gate on the current main SHA after this PR merges.

This release does not authorize root MX changes, apex Email Routing activation, Zoho settings changes, or a domain cutover. Keep root mail delivery on Zoho until archive reconciliation, mailbox send/receive checks, and rollback evidence are recorded.

## Acceptance evidence to record after deployment

- Exact main SHA and Mail Production workflow run URL/status.
- Confirm the archive migration page loads and accepts the uploaded ZIP.
- Confirm one or more migration runs complete with reconciled totals of 354 messages and expected imported/skipped/failed counts.
- Confirm imported messages are visible under `hello@` and retries do not duplicate them.
- Confirm source MIME/recipient headers remain intact.
- Leave root DNS, Cloudflare apex routing, and Zoho unchanged during this release.


## Deployment result — 2026-10-12

- Mail Production run [38284483246](https://github.com/MketyDigital/mksaas/actions/runs/38284483246) succeeded for main SHA `1ff183a959b59bba794e59dfe3e76426b71782d9`.
- Production DB migration, both app Workers, Mail workers, runtime-secret attachment, domain reconciliation, and production smoke passed.
- The user checked **Recent import runs** and confirmed `No migration runs yet`; no archive messages were imported. The earlier browser-tool import click was blocked by its URL policy before a migration run was created. The supplied 8.7 MB ZIP fits the deployed route's declared 10 MB per-file / 25 MB total limits; retry from the user's normal browser to `hello@mkety.com`.
- Root MX and Zoho cutover settings were not changed. Do not activate apex routing until all remaining readiness checks and rollback evidence pass.
