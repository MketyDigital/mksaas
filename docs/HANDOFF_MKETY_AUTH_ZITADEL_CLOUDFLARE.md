# Mkety Auth + ZITADEL + Cloudflare Handoff

## Current status

Implementation branch: `feat/mkety-auth-zitadel-vinext`

This branch contains the approved design and implementation work for replacing Auth.js with Mkety Auth and using ZITADEL as the initial OIDC adapter.

Do not merge or deploy `main` from this branch without explicit promotion approval.

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

For preview, use the exact `workers.dev` hostname assigned to the Worker. Do not guess the hostname before Cloudflare creates the Worker subdomain.

## GitHub secrets

Secret names to create in GitHub when the values are ready:

```text
MKETY_AUTH_CLIENT_SECRET
MKETY_AUTH_SESSION_SECRET
CLOUDFLARE_API_TOKEN
```

The development GitHub connector cannot read secret plaintext values after creation. Never commit them or put them into documentation.

Non-secret GitHub variables/configuration:

```text
MKETY_AUTH_PROVIDER
MKETY_AUTH_ISSUER
MKETY_AUTH_CLIENT_ID
MKETY_AUTH_REDIRECT_URI
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_WORKER_NAME
```

Optional Workers Builds API automation value:

```text
CLOUDFLARE_BUILD_TOKEN_UUID
```

## Cloudflare

Target runtime: Cloudflare Workers.

Cloudflare Containers are intentionally not part of this architecture.

Use `workers.dev` for feature/preview smoke tests. Keep the production branch as `main`; non-production branches must not automatically deploy production.

Cloudflare API automation uses a user API token. Workers Builds also has a separate build/deploy token used by the build system. Keep those credentials distinct.

## Required verification

Before promotion:

- Auth.js/NextAuth dependencies and imports are gone.
- Auth0/NEXTAUTH environment names are gone from application configuration.
- ZITADEL-specific code exists only in the provider adapter/configuration boundary.
- Login uses Authorization Code + PKCE.
- Callback validates state and ID-token issuer/audience/signature.
- Mkety creates an internal user and provider-neutral external identity mapping.
- Mkety creates an opaque hashed application session.
- Protected tenant routes remain fail-closed.
- Logout revokes the Mkety session and clears the cookie.
- No tokens or secrets are logged.
- `vinext check` passes or documented compatibility findings are explicitly accepted.
- Type-check, lint, tests, and production build pass.
- Cloudflare preview on `workers.dev` completes login/logout smoke testing.

## Evidence to record at completion

- final branch SHA
- CI run IDs and results
- `vinext check` result
- production build result
- preview Worker URL
- ZITADEL application issuer/client configuration state (never the secret)
- Cloudflare Worker name/account ID
- exact redirect/logout URIs

## Promotion boundary

This work is ready for handoff only after all verification gates are green.

No merge to `main`, no production deployment, and no connection of `mkety.com` is implied by this document.
