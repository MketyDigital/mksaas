# Agent Instructions for nextjs-saas-ai-template

## Overview

Production-ready Next.js 16 SaaS starter with AI, Auth.js, Drizzle ORM, PostgreSQL.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript
- PostgreSQL + Drizzle ORM
- Auth.js v5 (next-auth)
- Tailwind CSS v4
- pnpm 10+

## Key Commands

```bash
# Development
pnpm dev

# Build
pnpm build

# Database
pnpm db:generate  # Generate Drizzle migrations
pnpm db:migrate   # Run migrations
pnpm db:push     # Push schema
pnpm db:seed     # Seed demo data

# Tests
pnpm test
pnpm test:coverage
```

## Code Style

- ESLint flat config
- Prettier for formatting
- Conventional commits

## Pending reusable managed-hosting billing integration

When the Mkety SaaS upgrade begins, **reuse the external managed-hosting billing service built in `MketyDigital/mklms` rather than reimplementing NOWPayments inside MKSaaS**.

Current reusable service contract:

- standalone Cloudflare Worker: `workers/billing/` in `MketyDigital/mklms`;
- provider credentials deliberately reuse the legacy Mkety names `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`;
- central Worker can serve multiple enterprise/customer installations;
- each customer has a unique installation ID and per-installation HMAC shared secret;
- the Worker never needs customer database passwords;
- NOWPayments IPN verification fails closed and only `payment_status=finished` creates automatic settlement;
- customer applications expose a narrow signed settlement endpoint that marks only the identified monthly managed-hosting record `PAID`;
- manual `PENDING`, `PAID`, and `WAIVED` controls remain available independently;
- future MKSaaS tenant storage may replace the Worker's secret JSON customer registry without changing existing MkLMS customer settlement endpoints.

Before integrating, read `MketyDigital/mklms/docs/deployment/external-managed-hosting-billing.md` and the corresponding design/implementation plan in that repository. Preserve compatibility with already-deployed MkLMS customers when moving customer registry/configuration into MKSaaS.
