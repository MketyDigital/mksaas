# Mkety Public Content Seeding

## Purpose

The public Mkety website and global docs render from the platform-content layer.

The system has two sources of content:

1. **Code-owned Mkety defaults** in `src/features/platform-content/defaults.ts`.
2. **Admin-managed published database content** in the platform content tables.

The defaults keep `mkety.com` and `/docs` usable before database content exists. The seed flow intentionally copies those defaults into published database records when Mkety is ready to manage content through admin UI.

## Seed module

The seed module is:

```text
src/features/platform-content/server/seed.ts
```

It exports:

```ts
seedDefaultPlatformContent()
```

## Rules

- Seeding must be idempotent.
- Seeding must not overwrite existing admin-managed content.
- Seeding creates published starter records only when a matching key or slug is missing.
- Seeding is not a billing, security, deployment, or auth operation.
- Public content seeding must not create backend entitlements or advertise capabilities that the product cannot enforce.

## What gets seeded

- Production site settings for `mkety.com`.
- Homepage record with hero, workspaces, FAQ, and footer sections.
- Header navigation.
- Pricing presentation records and feature bullets.
- Docs categories.
- Docs articles.

## What does not get seeded

- Billing ledger balances.
- Payment provider state.
- Product entitlements.
- Deployment jobs.
- Domain verification state.
- Private keys or Auth Gateway signing keys.
- Security rules.
- Tenant/customer data.

## Safe rollout

Before running seeding in any non-local environment:

```bash
pnpm type-check
pnpm test
pnpm build
```

Then verify migrations against a non-production database.

Only after the platform content tables exist should the seed function be invoked from an approved admin/internal script or migration-safe operations runner.

## Current branch status

At this stage, the seed module is added as implementation foundation. The branch still needs local verification and migration reconciliation before production use.
