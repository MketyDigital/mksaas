# Mkety Auth + ZITADEL + Cloudflare Handoff

## Current status

Implementation branch: `feat/mkety-auth-zitadel-vinext`

This branch contains the approved design and implementation work for replacing Auth.js with Mkety Auth and using ZITADEL as the initial OIDC adapter.

Do not merge or deploy `main` from this branch without explicit promotion approval.

The verified vinext runtime baseline from `main` is integrated into this branch. The provider-neutral Auth implementation, test/type/lint gates, vinext compatibility check, production build, and Cloudflare packaging dry-run are green on the merged runtime.

## Architecture to preserve

```text
Application
  ↓
Mkety Auth Core
  ↓
ZITADEL OIDC adapter
  ↓
ZITADEL
```

ZITADEL is replaceable provider infrastructure. Mkety owns application sessions, internal users, tenant membership, roles, permissions, and authorization.

## ZITADEL configuration

Create/configure the ZITADEL application as an OIDC application using Authorization Code + PKCE.

Required values:

- issuer URL
- client ID
- client secret
- callback URI
- post-logout redirect URI

Application environment names:

```text
MKETY_AUTH_PROVIDER=zitadel
MKETY_AUTH_ISSUER
MKETY_AUTH_CLIENT_ID
MKETY_AUTH_CLIENT_SECRET
MKETY_AUTH_REDIRECT_URI
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI
MKETY_AUTH_SESSION_SECRET
```

For preview, use the exact `workers.dev` hostname returned after the `mkety-platform-preview` Worker is created. The preview workflow derives the callback as `<preview-url>/api/auth/callback` and the post-logout URI as `<preview-url>/login`; these exact URIs must also be registered in ZITADEL before the real browser smoke.

## GitHub preview configuration

The durable workflow is `.github/workflows/mkety-cloudflare-preview.yml`.

It deploys only the Wrangler named environment `preview`. `wrangler.jsonc` disables `workers.dev` and Preview URLs for the top-level Worker configuration and explicitly enables them only inside `env.preview`. Cloudflare therefore names the isolated environment Worker `mkety-platform-preview`.

Required preview secret names:

```text
CLOUDFLARE_API_TOKEN
STAGING_DATABASE_URL
MKETY_AUTH_CLIENT_SECRET
MKETY_AUTH_SESSION_SECRET
```

Required preview variables:

```text
CLOUDFLARE_ACCOUNT_ID
MKETY_AUTH_ISSUER
MKETY_AUTH_CLIENT_ID
```

`MKETY_AUTH_PROVIDER` is fixed to `zitadel` by the preview workflow. The redirect and post-logout URIs are derived from the exact deployed workers.dev URL instead of being guessed or duplicated as repository variables.

The development GitHub connector cannot read secret plaintext values after creation. Never commit them or put them into documentation.

Optional Workers Builds API automation value:

```text
CLOUDFLARE_BUILD_TOKEN_UUID
```

## Cloudflare

Target runtime: Cloudflare Workers.

Cloudflare Containers are intentionally not part of this architecture.

Use `workers.dev` for feature/preview smoke tests. Keep the production branch as `main`; non-production branches must not automatically deploy production.

Cloudflare API automation uses a user API token. Workers Builds also has a separate build/deploy token used by the build system. Keep those credentials distinct.

## Verification evidence

### Auth/runtime integration

- Runtime baseline merged to `main`: `95b6759dc45120f2276ad2129b1bc3918bed99ab`.
- Auth/runtime integration head after the verified merge: `cd0beeb56a6b8fe49834a05a82e3ac3d7ef2d1b2`.
- Integration Actions run: `34061355480`.
- Integration run passed frozen install, full tests, type-check, lint, `vinext check`, `pnpm build`, and `pnpm run deploy --dry-run` before the merge commit was pushed.
- The temporary integration/diagnostic workflows self-deleted after successful integration.
- Temporary main-to-Auth PR #19 closed as merged after the integration commit landed.

### OIDC WebCrypto repair

The merged runtime exposed a cross-realm verification failure caused by converting already-decoded signature bytes into a new `ArrayBuffer` before calling `SubtleCrypto.verify`. Runner diagnostics proved that the reconstructed `Uint8Array` is accepted directly while the unnecessary explicit `ArrayBuffer` conversion is rejected in the Jest/Node WebCrypto boundary.

The repair passes the decoded `Uint8Array` directly to WebCrypto and narrows its TypeScript return annotation to `Uint8Array<ArrayBuffer>`. Signature verification, issuer/audience/nonce checks, and all other ID-token security checks remain intact; no security assertion was weakened.

### Preview pipeline

- Preview config commit: `6fa864f99e9b6a55cc7edcbaaa2c7eb6d24257c3`.
- Durable preview workflow commit: `f42629b7fa54f1ca85ef6b1460c827c4297b3bf3`.
- First preview Actions run: `34061791905`.
- `Verify preview candidate` passed frozen install, tests, type-check, lint, `vinext check`, production build, and `pnpm run deploy --env preview --dry-run`.
- The deployment job then stopped at its credential preflight before contacting Cloudflare. No Worker was created and no production Worker was touched.
- `STAGING_DATABASE_URL` is available to the preview environment in GitHub Actions.
- Current external deployment blockers proven by that run are exactly:
  - missing `CLOUDFLARE_API_TOKEN` secret;
  - missing `CLOUDFLARE_ACCOUNT_ID` variable.
- ZITADEL preview variables/secrets are also not yet configured in GitHub (`MKETY_AUTH_ISSUER`, `MKETY_AUTH_CLIENT_ID`, `MKETY_AUTH_CLIENT_SECRET`, `MKETY_AUTH_SESSION_SECRET`). They do not block the public Worker bootstrap, but they block the Auth-ready binding and real ZITADEL smoke.

No secret value was printed by the workflow. GitHub masked the existing staging database value, and the preflight reports missing variable names only.

## Required verification before promotion

- Auth.js/NextAuth dependencies and imports are gone.
- Auth0/NEXTAUTH environment names are gone from active application configuration.
- ZITADEL-specific code exists only in the provider adapter/configuration boundary.
- Login uses Authorization Code + PKCE.
- Callback validates state and ID-token issuer/audience/signature.
- Mkety creates an internal user and provider-neutral external identity mapping.
- Mkety creates an opaque hashed application session.
- Protected tenant routes remain fail-closed.
- Logout revokes the Mkety session and clears the cookie.
- No tokens or secrets are logged.
- `vinext check`, type-check, lint, tests, production build, and preview dry-run pass.
- The real `mkety-platform-preview` workers.dev URL is captured from a successful Cloudflare deployment.
- The exact callback and logout URIs are registered in ZITADEL.
- Browser smoke completes real login → callback → Mkety session → protected route/tenant authorization → logout.

## Evidence to record at completion

- final branch SHA
- CI run IDs and results
- preview Worker URL
- ZITADEL application issuer/client configuration state (never the secret)
- Cloudflare Worker name/account ID
- exact redirect/logout URIs
- real authenticated smoke results

## Promotion boundary

The code/config side of the Auth + preview baseline is deploy-ready, but PR #16 remains a draft until the external Cloudflare credentials and ZITADEL preview configuration allow the real workers.dev deployment and authenticated smoke to complete.

No merge to `main`, no production deployment, and no connection of `mkety.com` is implied by this document.
