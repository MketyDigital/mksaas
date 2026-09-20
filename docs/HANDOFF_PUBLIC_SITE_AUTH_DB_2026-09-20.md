# Mkety Public Site / Auth / Production DB Handoff — 2026-09-20

## Scope

This handoff captures the September 20 production follow-up for:

- public `/login` and `/signup` browser behavior;
- production ZITADEL setup;
- MketyOS mobile clipping;
- Academy hub images;
- production PostgreSQL / Cloudflare Hyperdrive bridge recovery;
- public release promotion.

APP-07 remains out of scope until this public/auth recovery is fully closed.

## Public release

Current public release branch:

```text
feat/mkety-public-site-production
```

Current release head:

```text
a4bec5c5cc8768a6c60fa22fc8d825362f244373
```

This includes:

- MketyOS narrow-mobile containment fixes;
- forced full-document navigation for public auth entry links;
- Academy hub images uploaded under `public/academy-hubs/`.

The five expected Academy assets now exist:

```text
public/academy-hubs/class1.jpg
public/academy-hubs/class2.jpg
public/academy-hubs/class3.jpg
public/academy-hubs/class4.jpg
public/academy-hubs/class5.jpg
```

An extra `public/academy-hubs/logo.png` was also uploaded but is not required by the hub component.

## Login / signup findings

Direct production document navigation to:

- `https://mkety.com/login`
- `https://mkety.com/signup`

returns HTTP 200, `Content-Type: text/html; charset=utf-8`, no attachment `Content-Disposition`, and a real HTML document.

The original user-visible “downloads text file” symptom is consistent with client-side Next/vinext navigation requesting an RSC-style response when entering auth from public-site `<Link>` navigation.

Public auth entry links were therefore changed to full document navigation where appropriate:

- public header Sign In;
- public header Get Started;
- paid pricing signup CTAs;
- login ↔ signup cross-links.

Enterprise public AI routing remains a normal Next Link because it is not an auth document transition.

Exact UI/auth-navigation verification passed at `115dfca03206e47cf0a4b4a24d217b8d9b2e8e76`:

- tests;
- typecheck;
- lint;
- vinext check;
- build;
- mobile containment contract.

PR #92 was merged into the release branch as merge commit `14b69c970928c679f8b0b54183c848decdc14719`.

The user then uploaded the Academy assets, advancing the release branch to `a4bec5c5cc8768a6c60fa22fc8d825362f244373`.

## Production ZITADEL

Production initially had none of these Worker secret bindings:

- `MKETY_AUTH_ISSUER`
- `MKETY_AUTH_CLIENT_ID`
- `MKETY_AUTH_REDIRECT_URI`
- `MKETY_AUTH_POST_LOGOUT_REDIRECT_URI`
- `MKETY_AUTH_SESSION_SECRET`

A guarded production reconciliation created/reconciled:

```text
ZITADEL application: Mkety Platform Production
callback: https://mkety.com/api/auth/callback
post logout: https://mkety.com/login
OIDC: Authorization Code + PKCE, public Web client
```

The required Mkety Auth Worker bindings are now present by name.

The ZITADEL application reconciliation itself is idempotent and currently reports no further redirect changes needed.

## Remaining auth blocker

`/api/auth/login` does not reach the ZITADEL redirect yet.

Root cause:

`beginLogin()` first persists one-time PKCE/state/nonce data in `auth_login_transactions` using PostgreSQL. Production Worker DB connectivity is still blocked by the production Hyperdrive/VPC TLS bridge, so auth initiation stalls before `provider.createAuthorizationUrl()`.

Do not work around this by:

- disabling VPC TLS verification;
- exposing PostgreSQL publicly;
- pointing production auth to staging;
- moving PKCE or application sessions to unsigned/insecure client storage.

Mkety Auth intentionally owns DB-backed login transactions and sessions.

## Production DB recovery

Fresh `Mkety Production DB Protection` evidence succeeded on September 20 before repair:

- production PostgreSQL private;
- healthy;
- local backup policy valid;
- R2 offsite policy valid;
- latest Coolify backup fresh and non-empty;
- latest R2 backup object fresh and non-empty.

The active safe repair workflow is:

```text
.github/workflows/mkety-production-db-origin-ca-repair.yml
```

It:

1. requires fresh backup evidence;
2. snapshots DB state and existing certificate/key mounts;
3. issues a Cloudflare Origin CA certificate for the private DB origin;
4. stops PostgreSQL cleanly;
5. replaces only the existing server cert/key file contents;
6. restarts and requires healthy status;
7. resolves the existing tunnel-backed Workers VPC service with `cert_verification_mode=verify_ca`;
8. creates a disposable VPC-backed Hyperdrive;
9. deploys a minimal Worker and requires `SELECT 1`;
10. rolls back the original cert/key automatically on any repair failure;
11. cleans up disposable Hyperdrive/probe resources.

Never use the older diagnostic path that temporarily sets certificate verification to disabled.

## Public certification / cutover

The exact release head `a4bec5c5cc8768a6c60fa22fc8d825362f244373` already has successful exact-SHA certification evidence for:

- Content DB smoke;
- Public AI runtime diagnostic;
- Production Routing Preflight;
- Public Candidate Deploy.

A first launcher attempt failed only because it observed a cancelled Content DB certification run before the successful retry. The launcher has been re-run.

Before calling the public recovery closed, require the guarded production cutover for the exact current release head to complete successfully and re-check:

- public route HTTP/HTML contract;
- Academy image serving;
- public auth entry links;
- `/api/auth/login` real ZITADEL redirect + PKCE after DB repair.

## APP-07 boundary

Do not resume APP-07 until:

1. public release `a4bec5c5...` is deployed/accepted;
2. production DB bridge passes direct `SELECT 1`;
3. `/api/auth/login` reaches the real ZITADEL authorization redirect with PKCE;
4. callback/session persistence is verified against production DB;
5. public mobile/auth behavior is accepted.

Preserve:

```text
hold/app07-d59d409-before-public-recovery
```
