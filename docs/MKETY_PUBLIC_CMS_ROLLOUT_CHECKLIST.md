# Mkety Public CMS Rollout Checklist

This checklist is for moving the Mkety public website/docs CMS and global app-experience foundation from code-verified PR state into a real PostgreSQL environment.

It follows the Mkety blueprint boundaries from `AGENTS.md`:

- `mkety.com` owns the public website/docs entry surface.
- `app.mkety.com` owns the authenticated Platform app experience.
- `api.mkety.com`, `origin.mkety.com`, and `*.mkety.app` remain separate routing/product surfaces.
- Mkety is not AI-only; Platform and Academy remain the primary products.
- Trading remains visible but is treated as Enterprise/Custom.
- Backend logic, billing ledger calculations, security rules, tenant isolation, deployment engines, private keys, and Auth Gateway signing are not CMS-editable.

The authoritative migration-order contract is `docs/MKETY_MIGRATION_BASELINE.md`.

## 1. Code verification

Required before database rollout:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
pnpm db:check:migrations
```

The GitHub CI workflows run these checks so migration-order failures do not get hidden behind application tests.

## 2. Migration-path reality check

The active Drizzle config is:

```text
schema: ./src/shared/db/schema/index.ts
out: ./src/shared/db/migrations
```

Application migrations in `src/shared/db/migrations/` are applied by:

```bash
pnpm db:migrate
```

The Mkety CMS bootstrap SQL lives in a separate namespace:

```text
migrations/0000_platform_content.sql
migrations/0001_platform_app_experience.sql
```

Because those files are outside Drizzle's configured `out` folder, `pnpm db:migrate` does not apply the Mkety CMS bootstrap SQL. Apply that namespace with:

```bash
pnpm db:migrate:mkety-content
```

Do not combine or renumber the two namespaces as though they form one numeric sequence.

## 3. Migration reconciliation

Before applying migrations to a shared or production-like database:

```bash
pnpm db:check:migrations
```

Confirm:

- the application migration namespace is unique and contiguous;
- the Mkety content bootstrap namespace is unique and contiguous;
- `0009_mkety_auth.sql` remains the settled Auth migration;
- any branch adding an application migration uses the next free application prefix after rebasing;
- schema name remains aligned with the current app schema;
- `persons.id` and auth user IDs are not treated as interchangeable;
- enums are created before dependent tables;
- foreign keys reference existing tables;
- index and constraint names do not collide;
- migrations are safe for controlled rollout/retry.

The repository's legacy Drizzle journal/snapshot metadata does not fully represent the current SQL history. Do **not** accept `pnpm db:generate` output as authoritative without explicit review against `docs/MKETY_MIGRATION_BASELINE.md`, the complete active SQL history, and the current schema. Do not fabricate historical snapshots to silence metadata warnings.

## 4. Apply migrations

On a real database with the correct `DATABASE_URL`:

```bash
pnpm db:check:migrations
pnpm db:migrate
pnpm db:migrate:mkety-content
```

Do not use `db:push:unsafe` for production or shared environments.

## 5. Seed Mkety CMS defaults

After migrations:

```bash
pnpm db:seed:mkety-content
```

This seeds:

- public website settings;
- homepage sections;
- public navigation;
- pricing display records;
- docs categories and articles;
- global app dashboard presentation;
- global workspace cards;
- Platform Control Center modules.

Seed rules:

- do not overwrite existing admin-managed content;
- create published defaults only where keys/slugs are absent;
- keep billing/security/deployment/Auth Gateway implementation logic out of CMS records.

## 6. Smoke test seeded content

Run:

```bash
pnpm db:smoke:mkety-content
```

This verifies the same read loaders used by the public homepage, docs, pricing, navigation, app dashboard, workspace cards, and control-center modules.

Expected result:

```text
✅ Mkety platform content smoke checks passed.
```

## 7. Manual admin smoke test

In a tenant admin session with the correct platform permissions:

1. Open `/t/[tenant]/admin/platform-control`.
2. Confirm the Platform Control Center modules render.
3. Open `Public Website & Docs`.
4. Save a draft for a homepage section.
5. Publish that draft.
6. Confirm the public homepage reflects the published change.
7. Confirm revision records exist.
8. Confirm high-level audit event attempt status is visible in the admin UI.
9. Repeat with Docs and App Experience payloads.

## 8. Protected-boundary verification

Confirm CMS cannot directly mutate:

- billing ledger balances;
- entitlements enforcement;
- security policies;
- tenant isolation rules;
- deployment engine behavior;
- Auth Gateway private keys;
- JWKS signing configuration;
- raw domain routing infrastructure.

The Platform Control Center may present protected modules and safe metadata, but those systems require separate implementation and security review.

## 9. Ready-for-main-app handoff

Only after the checks above pass should this branch be treated as ready to move from public-site/CMS foundation work into heavier `app.mkety.com` Platform development.

Recommended next major shared Platform milestone after the baseline sequence completes:

```text
Billing → Entitlements → Usage/Credits
```
