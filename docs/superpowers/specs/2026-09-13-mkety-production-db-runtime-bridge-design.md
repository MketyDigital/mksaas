# Mkety Production DB Runtime Bridge Design

Date: 2026-09-13

## Problem

The Mkety Cloudflare Worker currently reads `DATABASE_URL` and opens PostgreSQL connections directly with Postgres.js. Production PostgreSQL is intentionally private inside Coolify/Docker and is not reachable or resolvable from Cloudflare Workers. The production cutover workflow also attempted migrations from a GitHub-hosted runner, which cannot resolve the private Coolify database hostname.

## Goals

- Keep PostgreSQL private; never expose port 5432 publicly.
- Run release migrations inside the Coolify private network using an ephemeral, exact-SHA executor.
- Use Cloudflare Hyperdrive backed by Workers VPC and Cloudflare Tunnel for Worker runtime database access.
- Keep local development, CI, and migration scripts compatible with `DATABASE_URL`.
- Fail closed: production cutover cannot mutate public routes until private database migration/smoke and runtime connectivity checks have succeeded.
- Preserve the existing manual confirmation and exact-SHA release gates.

## Runtime design

A small database connection resolver will choose the connection string in this order:

1. Cloudflare Hyperdrive binding connection string when running in Worker runtime and a binding is present.
2. `DATABASE_URL` for local development, tests, GitHub staging, and Coolify-hosted migration execution.

Request-scoped Postgres.js clients will use the resolved connection string. Hyperdrive maintains the underlying connection pool, so request-scoped clients remain appropriate. The current Postgres.js version is compatible with Hyperdrive.

The Worker config will contain a dedicated `MKETY_DB` Hyperdrive binding only after the Mkety-specific Hyperdrive resource exists. Existing unrelated Hyperdrive resources must not be reused.

## Infrastructure design

Production runtime path:

Cloudflare Worker -> Hyperdrive (`MKETY_DB`) -> Workers VPC TCP service -> Cloudflare Tunnel -> private Coolify network -> `mkety-postgres:5432`.

The database remains `is_public=false`. Workers VPC is the preferred Cloudflare private-database path. PostgreSQL TLS must be enabled before the VPC service is activated; TLS configuration must be performed through supported Coolify controls and only after a fresh verified backup.

## Migration design

The production cutover must invoke a reusable Coolify migration executor that:

- receives an exact release SHA;
- creates an ephemeral Coolify application from that exact SHA;
- joins the private Docker network;
- injects `PRODUCTION_DATABASE_URL` as a secret environment variable;
- runs base migrations, Mkety content migrations, seed, and smoke in order;
- reports success only when all four operations succeed;
- deletes the ephemeral application on success or failure.

Cloudflare route mutation remains on GitHub-hosted runners and depends on successful private DB migration.

## Security constraints

- No public PostgreSQL port.
- No database password, Coolify token, Cloudflare token, Tunnel token, runner token, or raw secret-bearing logs in repository output.
- Coolify API calls must use HTTPS.
- Existing MKLMS Hyperdrive configurations are out of scope and must remain unchanged.
- Workers VPC provisioning requires an account identity with Connectivity Directory Admin; fail closed if unavailable.
- Do not enable Cloudflare Access solely as a workaround when Workers VPC is available.

## Release validation

Before production route binding:

- exact-SHA quality gates remain green;
- private Coolify migration/seed/smoke succeeds;
- Mkety-specific Hyperdrive binding is present;
- an isolated Worker candidate proves a real database-backed route through Hyperdrive;
- live Worker preview, payment, Public AI, and routing checks pass.

Only then may `mkety.com/*` and `www.mkety.com/*` be bound. Existing rollback behavior remains mandatory.