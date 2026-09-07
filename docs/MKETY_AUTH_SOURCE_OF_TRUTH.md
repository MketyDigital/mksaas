# Mkety Auth Source of Truth Addendum

> **Authority:** This document is an approved addendum to `AGENTS.md` for authentication and Cloudflare deployment. It overrides legacy Auth.js/Auth0 assumptions in older documentation.

## Permanent boundary

Mkety owns the application authentication boundary.

```text
Mkety Platform / Products
        |
        | provider-neutral Mkety Auth contract
        v
Mkety Auth Core
        |
        | provider adapter contract
        v
ZITADEL OIDC adapter (initial)
```

ZITADEL is an implementation adapter, not the application's permanent auth architecture. A future identity provider must be replaceable without rewriting application authentication consumers.

Application code must not import ZITADEL SDK types, ZITADEL-specific claims, or any third-party authentication framework API. Application code consumes Mkety Auth interfaces only.

## Mkety Auth owns

- internal immutable user identity
- external identity mapping
- login transaction and PKCE state
- application session lifecycle
- tenant membership and role/permission resolution
- server-side authorization checks
- login, callback, logout, and session endpoints
- provider-independent client/server auth APIs

## Provider adapter owns

The ZITADEL adapter implements standard OIDC operations:

- authorization URL generation
- Authorization Code + PKCE exchange
- issuer and ID-token validation
- JWKS lookup/signature verification
- normalized identity retrieval
- optional provider logout/end-session URL

The adapter returns normalized Mkety identity data. Provider-specific tokens and claims never become the application session contract.

## Session contract

Mkety application sessions are opaque random tokens.

- token is generated with Web Crypto
- only a SHA-256 hash is persisted
- raw token exists only in the secure browser cookie and request lifecycle
- cookie is `HttpOnly`, `Secure` in production, `SameSite=Lax`, scoped to the application path
- expired/revoked sessions fail closed
- provider access tokens and ID tokens are not persisted as Mkety sessions

## Identity data model

Mkety-owned `users`, tenant memberships, roles, permissions, persons, organizations, and projects remain authoritative application records.

Provider linkage is provider-neutral through an external-identity record keyed by `(provider, subject)`.

The existing generic `accounts` table remains available for non-auth integration records such as GitHub connections. It must not be reused as an Auth.js-compatible authentication table.

## Login flow

```text
GET /api/auth/login
  -> Mkety creates state + PKCE transaction
  -> ZITADEL authorization
  -> GET /api/auth/callback
  -> validate state + PKCE + issuer + ID token
  -> normalize external identity
  -> upsert Mkety user/external identity
  -> create Mkety application session
  -> set secure session cookie
  -> redirect to safe return path
```

Logout revokes the Mkety session and clears the cookie before optionally redirecting to the provider's end-session endpoint.

## Application APIs

The stable server boundary is `@/shared/lib/auth`.

Expected operations include:

```ts
export async function auth(): Promise<MketySession | null>;
export async function requireAuth(): Promise<MketySession>;
export async function getCurrentUser(): Promise<MketySessionUser | null>;
```

Client components use the Mkety-owned `useAuth` facade. They must not call `next-auth/react`, Auth.js, or provider SDKs.

## Environment contract

```env
MKETY_AUTH_PROVIDER=zitadel
MKETY_AUTH_ISSUER=https://<instance>.zitadel.cloud
MKETY_AUTH_CLIENT_ID=<client-id>
MKETY_AUTH_CLIENT_SECRET=<client-secret>
MKETY_AUTH_REDIRECT_URI=https://<application-host>/api/auth/callback
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI=https://<application-host>/login
MKETY_AUTH_SESSION_SECRET=<random-secret>
```

Legacy `AUTH0_*`, `NEXTAUTH_*`, and Auth.js-specific configuration names are not part of the Mkety contract.

## GitHub and Cloudflare secret preparation

Secret names:

- `MKETY_AUTH_CLIENT_SECRET`
- `MKETY_AUTH_SESSION_SECRET`
- `CLOUDFLARE_API_TOKEN`

Non-secret configuration:

- `MKETY_AUTH_PROVIDER`
- `MKETY_AUTH_ISSUER`
- `MKETY_AUTH_CLIENT_ID`
- `MKETY_AUTH_REDIRECT_URI`
- `MKETY_AUTH_POST_LOGOUT_REDIRECT_URI`
- `CLOUDFLARE_ACCOUNT_ID`
- optional `CLOUDFLARE_BUILD_TOKEN_UUID` for Workers Builds API automation

Worker identity is configuration-owned in `wrangler.jsonc`: base `mkety-platform`, named preview `mkety-platform-preview`. Do not duplicate worker identity in environment variables.

The GitHub integration used by the development agent cannot read existing GitHub secret plaintext values. Secret values must be created/rotated by an authorized human or a secret-management interface; plaintext credentials must never enter Git history.

## Cloudflare target

Cloudflare Workers is the target runtime. Cloudflare Containers are explicitly out of scope.

Use the isolated `mkety-platform-preview` workers.dev environment for feature/preview verification before production promotion. Production deployment remains controlled through `main` and requires explicit promotion approval.

Workers Builds uses separate build/deploy concerns. The API token used to configure/operate Cloudflare is distinct from the Workers Builds deploy/build token used by the build system.

## vinext target

vinext is the authoritative Next.js-on-Cloudflare runtime for the Mkety Platform baseline.

`pnpm dev`, `pnpm build`, `pnpm start`, and `pnpm deploy` use the vinext path. `vinext check`, production build, and Cloudflare packaging dry-run are required baseline verification gates.

The auth architecture must not retain or restore Auth.js to satisfy compatibility tooling. Removing Auth.js is intentional and eliminates framework-specific authentication coupling.

## Non-negotiables

- Identity is not authorization.
- Provider identity is not the Mkety application session.
- ZITADEL is replaceable adapter infrastructure.
- No raw ZITADEL claims are the final application authorization authority.
- No frontend-only auth decision is trusted.
- No plaintext client secret, session token, access token, ID token, or private signing key is committed.
- Protected tenant routes fail closed.
- `main` is not merged/deployed until the feature branch is fully verified and promotion is explicitly authorized.
