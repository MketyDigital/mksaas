# Mkety Mail archive chunk retry release — 2026-10-14

## Scope

Release the bounded retry fix for the Mail archive uploader, then import the customer's 11-part ZIP archive into the existing `hello@mkety.com` mailbox. The validated archive contains 354 EML messages across 11 ZIP parts. The prior upload stopped on an HTTP 500 while sending part 02 and did not create an import run.

PR #405 merged as `874cd65d1cbbff85c3494f4fea3e6b3a3ca9a780`. The uploader now retries a network failure, HTTP 408, or HTTP 5xx up to three attempts total, reusing the same upload and chunk coordinates. This preserves idempotency and the final HTTP/Ray ID diagnostics.

## Release gate

This document change carries the `[mail-production]` release marker in its merge commit so the existing Mail Production workflow can deploy the exact main SHA. The workflow validates successful type-check, lint, test, build, migration-baseline, and Cloudflare smoke evidence before deployment.

The user authorized the guarded Mail release and archive import. Keep Assist, root DNS, MX, Zoho settings, and mail routing untouched.

## Verification

- Focused archive chunk retry tests passed locally (4 tests).
- Targeted ESLint and Prettier checks passed.
- `pnpm type-check` passed locally.
- PR #405 GitHub Actions passed: Build, Typecheck, Lint, Run tests, CI, MegaLinter, Pull Request Validation, and Mkety Cloudflare vinext Smoke.

## Acceptance evidence to record

- Exact main SHA and Mail Production workflow run result.
- Upload all 11 parts together to `hello@mkety.com` after the deployed fix is live.
- Reconcile the archive to 354 total imported plus skipped messages with zero failures.
- Confirm no duplicate messages were created by the earlier partial attempt.
