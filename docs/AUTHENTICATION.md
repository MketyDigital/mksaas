# Mkety Authentication

> **Architecture authority:** `docs/MKETY_AUTH_SOURCE_OF_TRUTH.md` and `AGENTS.md`.
>
> This document describes the current Mkety application authentication implementation. Legacy Auth.js/Auth0 documentation is obsolete and must not be used for new work.

## Architecture

Mkety owns the application authentication boundary. ZITADEL is the first identity-provider adapter and is intentionally replaceable.

```text
Mkety application
      ↓
Mkety Auth Core
      ↓
ZITADEL OIDC adapter
      ↓
ZITADEL
```

Application code imports only Mkety Auth interfaces. It must not import ZITADEL SDK types or any third-party authentication framework.

## Responsibilities

### Mkety Auth Core

Mkety owns:

- internal user IDs
- external identity mapping
- login transactions and PKCE state
- application sessions
- tenant memberships
- roles and permissions
- server-side authorization
- login/callback/logout/session route handlers

### ZITADEL adapter

The adapter implements standard OIDC operations:

- authorization URL creation
- Authorization Code + PKCE exchange
- discovery metadata retrieval
- JWKS/ID-token signature verification
- issuer and audience validation
- normalized identity mapping
- optional provider logout/end-session URL

The rest of the application must not depend on provider-specific claims or token shapes.

## Environment variables

```env
MKETY_AUTH_PROVIDER=zitadel
MKETY_AUTH_ISSUER=https://<instance>.zitadel.cloud
MKETY_AUTH_CLIENT_ID=<client-id>
MKETY_AUTH_CLIENT_SECRET=<client-secret>
MKETY_AUTH_REDIRECT_URI=https://<application-host>/api/auth/callback
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI=https://<application-host>/login
MKETY_AUTH_SESSION_SECRET=<random-secret>
```

`MKETY_AUTH_CLIENT_SECRET` and `MKETY_AUTH_SESSION_SECRET` are secrets. Never commit their values.

## ZITADEL application setup

Create a ZITADEL OIDC application using Authorization Code + PKCE.

For a local application, use a callback such as:

```text
http://localhost:3000/api/auth/callback
```

For the isolated Cloudflare preview Worker, use the exact deployed `mkety-platform-preview` workers.dev origin:

```text
https://<preview-origin>/api/auth/callback
```

The post-logout redirect must use the corresponding application origin:

```text
https://<preview-origin>/login
```

Do not add a redirect URI that is broader than necessary.

## Login flow

```text
GET /api/auth/login
  ↓
create one-time state + PKCE transaction
  ↓
redirect to ZITADEL
  ↓
GET /api/auth/callback?code=...&state=...
  ↓
validate state and exchange code
  ↓
validate ID token against ZITADEL issuer/client/JWKS
  ↓
map provider subject to Mkety user
  ↓
create hashed Mkety session token
  ↓
set HttpOnly/Secure/SameSite cookie
  ↓
redirect to safe return path
```

## Sessions

Mkety sessions are opaque random values stored only as hashes in the database.

The browser receives a secure cookie. The raw session token is never logged and is not stored in plaintext in the database.

Expired or revoked sessions resolve to unauthenticated state.

Provider access tokens and ID tokens are not used as the application session.

## Server-side usage

Use the stable Mkety Auth facade:

```ts
import { auth, requireAuth, getCurrentUser } from '@/shared/lib/auth';

const session = await auth();
const requiredSession = await requireAuth();
const user = await getCurrentUser();
```

`auth()` returns the Mkety session or `null`.

Protected operations must use server-side session/authorization checks even when a client component also knows the user's authentication state.

## Client usage

Client components use the Mkety-owned `useAuth` hook:

```ts
import { useAuth } from '@/features/auth/hooks/use-auth';

const { user, isAuthenticated, isLoading, login, logout } = useAuth();
```

Client code must not import `next-auth/react`, Auth.js, or a provider SDK.

## Protected routes and proxy

`src/proxy.ts` resolves the Mkety session and continues to enforce tenant-scoped access and admin roles.

The proxy must fail closed for protected tenant routes. Custom-domain rewriting must not grant access by itself.

## Identity and authorization

A ZITADEL subject identifies an external identity. It does not define Mkety authorization.

Mkety-owned records determine:

- internal user identity
- tenant membership
- tenant role
- permissions
- workspace/project access

Provider changes therefore do not require application authorization rewrites.

## Database model

Provider linkage uses a provider-neutral external identity record keyed by `(provider, subject)`.

Mkety application sessions are stored separately from provider identity linkage.

The existing generic `accounts` table remains available for integrations such as GitHub OAuth connections. It is not the authentication identity table.

## Development authentication

A development/test login may exist only behind an explicit `ENABLE_TEST_LOGIN=true` setting and must not be usable in production.

A production deployment with no valid identity-provider configuration must fail closed rather than silently creating authenticated users.

## Cloudflare and GitHub handoff

Prepare these secret names:

```text
MKETY_AUTH_CLIENT_SECRET
MKETY_AUTH_SESSION_SECRET
CLOUDFLARE_API_TOKEN
```

Prepare these non-secret values:

```text
MKETY_AUTH_PROVIDER
MKETY_AUTH_ISSUER
MKETY_AUTH_CLIENT_ID
MKETY_AUTH_REDIRECT_URI
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_BUILD_TOKEN_UUID   # only when Workers Builds API automation is used
```

Worker identity is configuration-owned in `wrangler.jsonc`: base `mkety-platform`, named preview `mkety-platform-preview`. Do not add a duplicate worker-name environment variable.

The development GitHub integration cannot read plaintext GitHub secrets. Do not paste secrets into commits, documentation, or `.env.example`.

## Migration rule

The authentication migration is complete only when all application references to Auth.js/NextAuth/Auth0 are gone from active application dependencies, imports, session types, mocks, route handlers, and environment configuration.

The generic integration `accounts` table must not be removed until its non-authentication callers have been independently migrated.

## Verification

Before promotion to `main`, verify:

1. login redirects to ZITADEL
2. callback rejects invalid state
3. callback rejects invalid/incorrectly signed ID tokens
4. external identity maps to one Mkety user
5. session cookie is created and server lookup works
6. tenant authorization remains correct
7. logout revokes the Mkety session
8. protected routes deny access after logout
9. no secrets or bearer tokens are logged
10. `next-auth`, `@auth/*`, Auth.js, Auth0, and `NEXTAUTH_*` are absent from active application source/configuration
11. migration baseline, tests, type-check, lint, `vinext check`, production build, and isolated Cloudflare preview packaging pass
12. real workers.dev browser smoke passes before Auth promotion

## Related architecture

- `docs/MKETY_AUTH_SOURCE_OF_TRUTH.md`
- `docs/MKETY_AUTH_GATEWAY_ARCHITECTURE.md`
- `docs/CENTRAL_MKETY_AUTH_GATEWAY_RECOMMENDATION.md`
