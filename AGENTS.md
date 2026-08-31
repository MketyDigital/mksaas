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

## Pending reusable managed-service billing integration

Mkety has a reusable external managed-hosting billing subsystem being implemented and verified in `MketyDigital/mklms` rather than inside this SaaS template. When MKSaaS upgrade work begins, **reuse that external billing Worker/provider contract instead of copying or rebuilding the legacy NOWPayments routes.**

Reference implementation paths in `MketyDigital/mklms`:

- `workers/billing/` — standalone Cloudflare billing Worker;
- `docs/deployment/external-managed-hosting-billing.md` — deployment and customer-registration contract;
- `src/app/api/managed-hosting/settlement/route.ts` — narrow signed customer settlement callback pattern.

The central Worker intentionally reuses the existing legacy Mkety payment-provider secret names:

- `NOWPAYMENTS_API_KEY`
- `NOWPAYMENTS_IPN_SECRET`

MKSaaS must not require existing managed MkLMS customers to change those provider credentials solely because the control plane is upgraded. Each customer/tenant should instead have its own installation/tenant ID and per-customer shared settlement secret.

Current contract principles to preserve during MKSaaS integration:

1. Payment-provider handling remains centralized outside customer deployments.
2. Customer databases/passwords are not stored in the billing Worker.
3. NOWPayments IPNs fail closed and are cryptographically verified.
4. Only final successful payment state (`finished`) triggers automatic settlement.
5. Settlement callbacks are signed per customer/tenant and idempotent.
6. Existing customer installations continue to work while MKSaaS later replaces the initial secret-JSON customer registry with tenant/database-backed configuration.
7. Manual/offline billing overrides remain possible for managed products even after payment automation is available.

Before implementing MKSaaS billing, audit the then-current `MketyDigital/mklms` billing docs and Worker instead of relying only on this note, because that repository is the current source of truth for the reusable integration contract.
