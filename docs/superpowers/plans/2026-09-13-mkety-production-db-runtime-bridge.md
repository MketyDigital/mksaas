# Mkety Production DB Runtime Bridge Implementation Plan

Spec: `docs/superpowers/specs/2026-09-13-mkety-production-db-runtime-bridge-design.md`

## Global constraints

- Keep production PostgreSQL private.
- Preserve exact-SHA/manual cutover governance and rollback.
- Do not reuse or alter unrelated MKLMS Cloudflare resources.
- Do not print or commit secrets.
- Use supported Coolify and Cloudflare APIs only.
- Production route mutation must remain blocked until private DB migration and runtime DB connectivity both pass.

## Task 1 — Add connection-string resolver (TDD)

1. Add focused tests proving Hyperdrive is preferred when supplied, `DATABASE_URL` is the fallback, and missing both fails clearly.
2. Run the focused test and confirm RED because the resolver does not exist.
3. Implement the minimal resolver.
4. Re-run focused tests and full DB request tests.

## Task 2 — Use Hyperdrive in Worker request DB paths

1. Add a Worker-runtime adapter that reads the `MKETY_DB` Hyperdrive binding without affecting Node/Coolify execution.
2. Route request-scoped database helpers through the resolver.
3. Add/extend tests for local fallback and injected Hyperdrive connection strings.
4. Keep migration scripts on `DATABASE_URL` only.

## Task 3 — Add Worker binding configuration

1. Add `MKETY_DB` Hyperdrive binding only after a Mkety-specific Hyperdrive ID exists.
2. Ensure candidate and production deployment validation assert the binding exists for production-capable Workers.
3. Add a DB-backed preview smoke (`/api/health` or equivalent) before route mutation.

## Task 4 — Durable private migration executor

1. Move only the durable Coolify executor and minimal migration image/entrypoint from the diagnostic branch onto this clean branch.
2. Ensure workflow dispatch requires an exact SHA on the frozen release branch.
3. Ensure ephemeral app joins the private Docker network, runs migrate/content-migrate/seed/smoke, and is always deleted.
4. Add fail-closed diagnostics that expose only stage/classification, not raw logs or secrets.

## Task 5 — Production infrastructure prerequisite

1. Verify a fresh R2 backup immediately before any PostgreSQL restart/change.
2. Enable PostgreSQL TLS via supported Coolify controls.
3. Verify private DB health and migrations after TLS enablement.
4. Create a dedicated Cloudflare Tunnel in the private network if none exists.
5. Create a Workers VPC TCP service for the private PostgreSQL host/port.
6. Create a Mkety-only Hyperdrive configuration using that VPC service.
7. Add the resulting Hyperdrive ID to Worker configuration.

Blocker rule: stop if the Cloudflare identity lacks `Connectivity Directory Admin` rather than exposing the database publicly or enabling a weaker workaround.

## Task 6 — Wire production cutover

1. Replace the GitHub-hosted direct production migration step with the private executor gate.
2. Keep all external preflight, Cloudflare deployment, routing snapshot, rollback, and live acceptance on GitHub-hosted runners.
3. Require a DB-backed isolated Worker preview through Hyperdrive before route mutation.
4. Preserve all existing exact-SHA prerequisite workflow-history checks.

## Task 7 — Verification and cleanup

1. Run focused tests, full tests, type-check, lint, build, vinext check, and MegaLinter as applicable.
2. Remove temporary diagnostic/audit workflows that are not durable controls.
3. Compare clean branch to `main`; ensure only intended files remain.
4. Open PR with exact scope and evidence.
5. After merge, fast-forward the release branch to the new exact SHA and rerun all 10 certification gates.
6. Run production cutover with exact confirmation.
7. Independently verify `https://mkety.com` and `https://www.mkety.com` only after the cutover succeeds.