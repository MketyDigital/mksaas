# Mkety Production DB Runtime Bridge Design

Date: 2026-09-13

## Problem

The Mkety Cloudflare Worker needs production PostgreSQL access while the database remains private inside Coolify/Docker. GitHub-hosted runners cannot resolve the private database hostname, so release migrations already run through an ephemeral Coolify private-network executor. Worker runtime access was initially designed around Workers VPC, but production diagnostics proved the Coolify PostgreSQL TLS endpoint presents a Coolify-private certificate chain that Workers VPC cannot validate with `verify_ca` or `verify_full` because Workers VPC does not accept a custom private CA bundle.

The verified TLS facts are:

- PostgreSQL is `running:healthy`, `is_public=false`, and `enable_ssl=true`.
- A private-network client succeeds with PostgreSQL `sslmode=require`.
- PostgreSQL negotiates TLS 1.2.
- The server leaf certificate is issued by `Coolify CA Certificate`.
- Standard trust verification fails with `unable to get local issuer certificate` / `unable to verify the first certificate`.

Disabling Workers VPC certificate verification permanently is not acceptable for production.

## Goals

- Keep PostgreSQL private; never expose port 5432 publicly.
- Keep PostgreSQL TLS enabled.
- Run release migrations inside the Coolify private network using an ephemeral, exact-SHA executor.
- Use a supported Cloudflare private-database path that does not require disabling TLS certificate verification.
- Keep local development, CI, and migration scripts compatible with `DATABASE_URL`.
- Preserve the Worker `MKETY_DB` Hyperdrive binding interface so application code and the frozen release SHA do not change.
- Fail closed: production route mutation cannot occur until private database migration/smoke and runtime database connectivity checks have succeeded.
- Preserve the existing manual confirmation and exact-SHA release gates.

## Runtime design

The application-side database connection resolver remains unchanged:

1. In Cloudflare Worker runtime, use the `MKETY_DB` Hyperdrive binding connection string when present.
2. Use `DATABASE_URL` for local development, tests, GitHub staging, and Coolify-hosted migration execution.

Request-scoped Postgres.js clients continue using the resolved connection string. Hyperdrive remains the connection-pooling layer for Worker traffic.

## Production network architecture

Production runtime path:

Cloudflare Worker -> Hyperdrive (`MKETY_DB`) -> Cloudflare Access -> dedicated Mkety Cloudflare Tunnel -> private Coolify network -> PostgreSQL TLS endpoint.

This is Cloudflare's supported Tunnel + Access architecture for Hyperdrive private databases. `cloudflared` runs inside the private network and creates an outbound-only tunnel to Cloudflare; no inbound database firewall rule or public PostgreSQL listener is required.

### Dedicated resources

Use Mkety-only resources and never reuse or alter unrelated MKLMS resources:

- Tunnel: dedicated Mkety production database tunnel; the currently created Mkety tunnel may be reused only after verifying its identity and that it is not attached to any unrelated route.
- Database hostname: a dedicated Cloudflare-managed hostname under the Mkety zone, used only for Hyperdrive-to-database transport.
- Access service token: dedicated to the Mkety production Hyperdrive path.
- Access application/policy: self-hosted application protecting only the database hostname; policy action `Service Auth`; include only the dedicated service token; no interactive identity providers.
- Hyperdrive: exactly one configuration named `mkety-production-db`.

The tunnel published application route must use TCP and forward only to the private PostgreSQL service/port reachable inside the Coolify network. Hyperdrive configuration for a Tunnel + Access private database must include the Access client ID and client secret and omit an explicit origin port, allowing the tunnel service configuration to select the private PostgreSQL port.

## TLS model

PostgreSQL remains TLS-enabled. The Tunnel + Access path terminates the Cloudflare-facing hostname with Cloudflare-managed TLS and then forwards through the outbound tunnel to the private PostgreSQL TLS endpoint. We do not set Workers VPC `cert_verification_mode=disabled`, do not expose PostgreSQL publicly, and do not weaken PostgreSQL TLS.

The Coolify private CA is treated as an implementation detail of the private origin. No private CA material is committed to the repository or printed in CI logs.

## Migration design

The production cutover invokes the reusable Coolify migration executor that:

- receives the exact release SHA;
- creates an ephemeral Coolify application from that exact SHA;
- joins the private Docker network;
- injects `PRODUCTION_DATABASE_URL` as a secret environment variable;
- runs base migrations, Mkety content migrations, seed, and smoke in order;
- reports success only when all four operations succeed;
- deletes the ephemeral application on success or failure.

Cloudflare route mutation remains on GitHub-hosted runners and depends on successful private DB migration.

## Provisioning and idempotency

A diagnostic/provisioning workflow on `ops/precutover-diagnostics-20260913` may create or reconcile the Mkety-only Tunnel, DNS/public-hostname route, Access service token/application/policy, and Hyperdrive. It must:

- discover by exact Mkety resource names before creating anything;
- fail if multiple matching resources exist;
- never select an MKLMS resource by fallback;
- never print tunnel tokens, database credentials, Access client secrets, or raw secret-bearing API responses;
- validate each API response before moving to the next stage;
- stop before public Mkety application-route mutation if any runtime connectivity check fails.

Any one-time Access client secret must be used directly inside the provisioning run to create Hyperdrive and must not be echoed. Durable secret storage is unnecessary if Hyperdrive creation completes in the same run.

## Security constraints

- No public PostgreSQL port.
- No public Redis port.
- No database password, Coolify token, Cloudflare token, Tunnel token, Access client secret, runner token, or raw secret-bearing logs in repository output.
- Coolify and Cloudflare API calls use HTTPS.
- Existing unrelated MKLMS Tunnel, Access, DNS, or Hyperdrive resources are out of scope and must remain unchanged.
- Do not use Workers VPC with certificate verification disabled as the production workaround.
- The database transport hostname must be protected by Cloudflare Access Service Auth and must not be usable as an unauthenticated public TCP endpoint.

## Release validation

Before production route binding:

- the frozen release SHA remains the exact release-branch head and all ten certification gates remain green;
- a fresh production PostgreSQL backup exists off-host and PostgreSQL remains healthy/private/TLS-enabled;
- private Coolify migration/seed/smoke succeeds;
- Redis has independently verified off-host backup evidence acceptable for launch;
- exactly one Mkety-specific Hyperdrive named `mkety-production-db` exists and is wired through the dedicated Tunnel + Access path;
- an isolated Worker candidate at the frozen release SHA proves a real database-backed route through `MKETY_DB`;
- live Worker preview, payment, Public AI, and routing checks pass.

Only then may `mkety.com/*` and `www.mkety.com/*` be bound. Existing rollback behavior remains mandatory.
