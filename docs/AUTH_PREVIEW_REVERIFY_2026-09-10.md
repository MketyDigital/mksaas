# Auth Preview Reverification — 2026-09-10

Public-site PR #24 was promoted to `main` as merge commit `0693b00fba639549d92c4dd82a2fcef618d0bd47` after its exact-head release gate passed.

This note intentionally triggers a fresh Auth branch preview run so historical Cloudflare/ZITADEL blocker notes are not treated as current evidence.

Promotion remains gated on the existing Auth handoff requirements:

- deploy the isolated `mkety-platform-preview` Worker;
- record the exact workers.dev URL;
- bind the preview database and Mkety Auth runtime configuration when the configured values are available;
- register the exact callback `<preview-url>/api/auth/callback` and post-logout `<preview-url>/login` URIs in ZITADEL;
- complete real browser smoke: login → callback → Mkety-owned session → protected tenant authorization → logout;
- re-confirm application migration ordering before promoting downstream Automation Webhooks.

No production `mkety.com` or `app.mkety.com` cutover is authorized by this note.
