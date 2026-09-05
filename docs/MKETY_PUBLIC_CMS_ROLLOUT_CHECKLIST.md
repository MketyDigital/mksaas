# Mkety Public CMS Rollout Checklist

This checklist is for moving the Mkety public website/docs CMS and global app-experience foundation from code-verified PR state into a real PostgreSQL environment.

It follows the Mkety blueprint boundaries from `AGENTS.md`:

- `mkety.com` owns the public website/docs entry surface.
- `app.mkety.com` owns the authenticated Platform app experience.
- `api.mkety.com`, `origin.mkety.com`, and `*.mkety.app` remain separate routing/product surfaces.
- Mkety is not AI-only; Platform and Academy remain the primary products.
- Trading remains visible but is treated as Enterprise/Custom.
- Backend logic, billing ledger calculations, security rules, tenant isolation, deployment engines, private keys, and Auth Gateway signing are not CMS-editable.

## 1. Code verification

Required before database rollout:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
```

The GitHub `CI` workflow runs these as independent jobs so failures do not hide each other.

## 2. Migration reconciliation

Before applying migrations to a shared or production-like database:

```bash
pnpm db:generate
```

Compare Drizzle-generated output against:

```text
migrations/0000_platform_content.sql
migrations/0001_platform_app_experience.sql
```

Confirm:

- schema name remains aligned with the current app schema;
- the Auth.js user table is `users`, not `user`;
- `persons.id` and auth user IDs are not treated as interchangeable;
- enums are created before dependent tables;
- foreign keys reference existing tables;
- index and constraint names do not collide;
- migrations are idempotent enough for controlled rollout/retry.

## 3. Apply migrations

On a real database with the correct `DATABASE_URL`:

```bash
pnpm db:migrate
```

Do not use `db:push:unsafe` for production or shared environments.

## 4. Seed Mkety CMS defaults

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

## 5. Smoke test seeded content

Run:

```bash
pnpm db:smoke:mkety-content
```

This verifies the same read loaders used by the public homepage, docs, pricing, navigation, app dashboard, workspace cards, and control-center modules.

Expected result:

```text
✅ Mkety platform content smoke checks passed.
```

## 6. Manual admin smoke test

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

## 7. Protected-boundary verification

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

## 8. Ready-for-main-app handoff

Only after the checks above pass should this branch be treated as ready to move from public-site/CMS foundation work into heavier `app.mkety.com` Platform development.

Recommended next major branch after merge:

```text
Mkety Platform core app workspaces: AI, Automate, Deploy, Billing/Entitlements, and SolutionHub.
```
