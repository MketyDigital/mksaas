# Mkety Auth Live Promotion Handoff — 2026-09-10

## Governing architecture

`AGENTS.md` remains the highest-priority repository instruction. Mkety owns application authentication, sessions, authorization, tenant membership, roles, and permissions. ZITADEL is the first replaceable OIDC provider adapter.

Active Mkety code/config/docs must not retain Auth.js, NextAuth, Auth0, or `NEXTAUTH_*` architecture residue after Auth promotion. The target is removal/sanitization, not an Auth.js upgrade.

## Current release state

- Public-site PR #24 is merged into `main`.
- Current merged public-site baseline: `0693b00fba639549d92c4dd82a2fcef618d0bd47`.
- Production `mkety.com` route cutover is still a separate protected action and is not authorized by this handoff.
- Active Auth PR: #16, branch `feat/mkety-auth-zitadel-vinext`.
- Auth branch head before this handoff commit: `0b4e20bf6988707a30d1a5172739787ca40dd73b`.
- Temporary integration PR #25 (`main` -> Auth branch) was opened to absorb the merged public-site baseline.
- GitHub rejected the automatic merge of #25 because the branches have merge conflicts. Do not force-update the Auth branch. Resolve the overlapping files deliberately, preserving both the merged public-site baseline and the Mkety Auth architecture.

## Required order from here

1. Resolve #25 / integrate current `main` into `feat/mkety-auth-zitadel-vinext` with a true two-parent merge; no force-push and no flattening.
2. Re-run the complete Auth verification gate on the resulting exact SHA.
3. Verify Auth.js/NextAuth/Auth0 sanitization on the integrated tree.
4. Deploy the isolated `mkety-platform-preview` Cloudflare Worker.
5. Capture its exact `workers.dev` URL.
6. Configure the ZITADEL OIDC application with the exact callback `<preview-url>/api/auth/callback` and post-logout `<preview-url>/login`.
7. Complete real browser smoke: login -> callback -> Mkety-owned session -> protected route/current tenant authorization -> logout.
8. Only after the exact Auth SHA and external smoke are green may PR #16 be promoted.
9. Continue the stack in order: #15 Automation Webhooks -> #21 Billing -> #22 Entitlements -> #23 Usage/Credits.

## Existing Cloudflare/Auth preview configuration

Cloudflare credentials are reported by the repository owner as already provisioned. The workflow must verify that claim at runtime; do not print secret values.

Existing preview configuration consumed by `.github/workflows/mkety-cloudflare-preview.yml`:

### GitHub Actions secrets

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `STAGING_DATABASE_URL`
- `MKETY_AUTH_CLIENT_SECRET`
- `MKETY_AUTH_SESSION_SECRET`

### GitHub Actions variables

- `MKETY_AUTH_ISSUER`
- `MKETY_AUTH_CLIENT_ID`

`MKETY_AUTH_PROVIDER` is fixed to `zitadel` in the preview workflow. Redirect and post-logout URIs are derived from the exact deployed Cloudflare preview URL.

## ZITADEL management automation

Do not use a human administrator password in GitHub Actions. Use a ZITADEL service/machine account with a Personal Access Token (PAT) and only the permissions needed to manage the Mkety OIDC application. ZITADEL application updates require project application write permission (`project.app.write`).

Add the following for automated preview callback/logout registration:

### New GitHub Actions secret

- `ZITADEL_MANAGEMENT_PAT` — PAT belonging to a ZITADEL service/machine account authorized to manage the Mkety project/application.

### New GitHub Actions variables

- `ZITADEL_PROJECT_ID` — ZITADEL project containing the Mkety OIDC application.
- `ZITADEL_APP_ID` — the Mkety OIDC application ID.

The automation should use `MKETY_AUTH_ISSUER` as the ZITADEL instance/custom-domain origin and call the ZITADEL application-management API after Cloudflare returns the preview URL. It must set the exact preview callback and post-logout URIs, fail closed on non-2xx responses, and never echo the PAT or client secret.

## What the repository owner must provision

Do not paste sensitive values into chat. Add secret values directly in GitHub repository Settings -> Secrets and variables -> Actions, preferably in the `preview` environment when the workflow consumes that environment.

Required ZITADEL information:

- issuer/custom-domain URL -> `MKETY_AUTH_ISSUER` variable;
- OIDC application client ID -> `MKETY_AUTH_CLIENT_ID` variable;
- OIDC client secret -> `MKETY_AUTH_CLIENT_SECRET` secret;
- strong random Mkety application-session secret -> `MKETY_AUTH_SESSION_SECRET` secret;
- project ID -> `ZITADEL_PROJECT_ID` variable;
- OIDC application ID -> `ZITADEL_APP_ID` variable;
- service-account PAT -> `ZITADEL_MANAGEMENT_PAT` secret.

The connected GitHub automation interface can edit workflows and repository files but intentionally does not expose GitHub secret-management APIs or secret plaintext. Secret insertion therefore remains a GitHub UI action by the repository owner; after insertion, Actions can consume the values without revealing them to this chat.

## Promotion invariants

Before PR #16 can merge:

- no active `next-auth`, `@auth/*`, Auth.js, Auth0, or `NEXTAUTH_*` dependency/import/config residue;
- provider-neutral Mkety Auth boundary remains authoritative;
- ZITADEL-specific implementation stays inside provider/configuration boundaries;
- Authorization Code + PKCE remains enabled;
- callback validates state and ID-token issuer/audience/signature;
- application session is opaque, Mkety-owned, stored hashed server-side;
- current tenant membership is resolved from Mkety data and fails closed;
- logout revokes the Mkety session and clears its cookie;
- no provider tokens, PATs, client secrets, session secrets, or database credentials are logged;
- frozen install, tests, type-check, lint, migration checks, `vinext check`, production build, preview dry-run and real preview deployment pass on the same integrated code;
- real ZITADEL browser smoke passes against the exact deployed preview URL.

## Production boundary

This handoff does not authorize production route cutover. The public production workflow remains separately gated by its exact verified SHA and literal cutover confirmation phrase.
