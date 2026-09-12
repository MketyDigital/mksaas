# Mkety Auth Core + ZITADEL Adapter + Cloudflare/vinext Design

## Status

Approved architecture for implementation on `feat/mkety-auth-zitadel-vinext`.

This document extends the Mkety architecture with the concrete authentication boundary, the first ZITADEL adapter, and the Cloudflare/vinext deployment preparation required for handoff.

## Goal

Remove Auth.js/NextAuth from the Mkety application and replace it with a provider-neutral Mkety Auth core whose first provider implementation is ZITADEL over standard OIDC Authorization Code + PKCE.

The application must be able to replace ZITADEL later without changing application-facing authentication interfaces.

## Architectural boundary

```text
Application / Platform
        |
        | Mkety Auth contracts only
        v
+--------------------------+
|      Mkety Auth Core     |
| identity + session + RBAC|
+------------+-------------+
             |
             | provider adapter contract
             v
+--------------------------+
|   ZITADEL OIDC Adapter   |
| issuer / PKCE / exchange |
| JWKS / identity mapping  |
+--------------------------+
```

ZITADEL is an adapter, not the application's authentication architecture. No application module may import ZITADEL-specific SDK types or APIs directly.

The broader Mkety Auth Gateway remains the shared product-access boundary described by `docs/MKETY_AUTH_GATEWAY_ARCHITECTURE.md`. The application session created by Mkety Auth is distinct from future short-lived cross-product access assertions.

## Mkety Auth core responsibilities

Mkety Auth owns:

- provider-neutral identity lookup and internal user IDs
- login transaction state and PKCE state
- application session lifecycle
- tenant membership and role/permission resolution
- login/callback/logout orchestration
- fail-closed authorization checks
- stable application-facing auth types

The application session should be an opaque, random, HttpOnly, Secure, SameSite cookie token. Only a hash of the token is persisted server-side. Provider access tokens and ID tokens are not the Mkety application session contract.

## Provider adapter contract

The adapter must expose provider-neutral operations equivalent to:

```ts
interface IdentityProviderAdapter {
  createAuthorizationUrl(input: AuthorizationRequest): Promise<AuthorizationUrl>;
  exchangeCode(input: AuthorizationCodeExchange): Promise<ExternalIdentity>;
  getLogoutUrl(input: ProviderLogoutRequest): Promise<string | null>;
}
```

`ExternalIdentity` contains only normalized identity information needed by Mkety:

```ts
interface ExternalIdentity {
  provider: string;
  subject: string;
  email: string | null;
  name: string | null;
  image: string | null;
}
```

ZITADEL implements this contract using standard OIDC endpoints and Web APIs where possible.

## Database model

Mkety-owned users, tenant memberships, roles, permissions, persons, organizations, and projects remain application data.

Authentication provider linkage must become provider-neutral. Introduce an `external_identities` table (or equivalent final name) keyed by `(provider, subject)` and linked to the Mkety internal user.

Introduce Mkety-owned application sessions with:

- session id
- hashed session token
- user id
- expiration
- created/updated timestamps
- optional revoked timestamp

Do not delete or repurpose the generic integration `accounts` table until all usages are traced. Authentication identity linkage must not inherit Auth.js account semantics.

## Login flow

```text
GET /api/auth/login
  -> Mkety creates state + PKCE transaction
  -> ZITADEL authorization URL
  -> browser authenticates at ZITADEL
  -> GET /api/auth/callback
  -> Mkety validates state and PKCE
  -> adapter exchanges code and validates identity
  -> Mkety upserts internal user + external identity
  -> Mkety creates hashed application session
  -> HttpOnly session cookie
  -> redirect to requested safe application path
```

Logout revokes the Mkety application session first, clears the cookie, then optionally redirects through the provider logout endpoint.

## Authorization

Protected routes must resolve the Mkety session server-side. Tenant role/permission checks remain Mkety-owned and tenant-scoped. No browser-only auth state is trusted.

`src/proxy.ts` must call Mkety Auth session resolution and must remain fail-closed for protected tenant routes.

## Development/test authentication

No fake login may grant access in production. Development test login must be explicitly isolated from production and must not become a permanent provider dependency.

## Removal requirements

The migration is not complete until all of the following are true:

- `next-auth` is removed from `package.json` and lockfile.
- `@auth/drizzle-adapter` is removed from `package.json` and lockfile.
- No application source imports `next-auth`, `@auth/*`, Auth.js provider APIs, or Auth.js session types.
- `/api/auth/[...nextauth]` is removed.
- Auth.js schema type coupling is removed.
- Auth.js-specific documentation and environment names are removed or rewritten.
- Client components use Mkety Auth hooks/facades.
- Server components/API routes use Mkety Auth server utilities.

## Environment contract

Provider-neutral application variables:

```env
MKETY_AUTH_PROVIDER=zitadel
MKETY_AUTH_ISSUER=https://<instance>.zitadel.cloud
MKETY_AUTH_CLIENT_ID=<client-id>
MKETY_AUTH_CLIENT_SECRET=<client-secret>
MKETY_AUTH_REDIRECT_URI=https://<application-host>/api/auth/callback
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI=https://<application-host>/login
MKETY_AUTH_SESSION_SECRET=<random-secret>
```

These names are the application contract. Do not introduce `AUTH0_*`, `NEXTAUTH_*`, or provider-specific names into application code.

## GitHub secret preparation

The repository handoff must document these names without storing plaintext credentials in source:

- `MKETY_AUTH_CLIENT_SECRET` — GitHub Actions secret and Cloudflare runtime secret
- `MKETY_AUTH_SESSION_SECRET` — GitHub Actions secret and Cloudflare runtime secret
- `CLOUDFLARE_API_TOKEN` — GitHub Actions secret for Cloudflare automation/deploy operations

Non-secret configuration may use GitHub Actions variables or Cloudflare configuration:

- `MKETY_AUTH_PROVIDER`
- `MKETY_AUTH_ISSUER`
- `MKETY_AUTH_CLIENT_ID`
- `MKETY_AUTH_REDIRECT_URI`
- `MKETY_AUTH_POST_LOGOUT_REDIRECT_URI`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_WORKER_NAME`

The GitHub connector cannot retrieve existing GitHub secret plaintext values. A human must add or rotate secret values in GitHub/Cloudflare when requested.

## Cloudflare preparation

Cloudflare Workers is the target runtime. Containers are explicitly out of scope.

The repository must be prepared for Workers Builds with the current vinext direction. Production branch remains `main`; non-production branches must not automatically deploy to production.

Cloudflare credentials are prepared as:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- optional `CLOUDFLARE_BUILD_TOKEN_UUID` when Workers Builds API automation is used

Current Cloudflare documentation supports user API tokens for Workers Builds configuration and deployment. Workers Builds API automation requires the appropriate Workers Builds permissions; the dashboard-generated deploy token/build token remains separate from the API token used to configure builds.

## vinext direction

vinext is the intended long-term Next.js-on-Workers adapter. The migration must be checked with `vinext check` before production configuration is finalized.

Auth must not be preserved merely because an existing Auth.js dependency appears in a vinext compatibility report. Removing Auth.js is an intentional architecture change and reduces framework coupling.

## Verification gates

Before main is touched:

1. unit tests for provider contract, state/PKCE validation, identity mapping, session creation/lookup/revocation, and authorization fail-closed behavior
2. static proof that Auth.js/NextAuth dependencies and imports are gone
3. type-check and lint
4. vinext compatibility check
5. feature-branch production build
6. Cloudflare preview/`workers.dev` smoke test with ZITADEL
7. verify login, callback, session persistence, tenant access, logout, and protected-route denial
8. document exact runtime variables and redirect URIs for handoff

No merge to `main`, production deployment, or custom `mkety.com` connection is authorized by this document.
