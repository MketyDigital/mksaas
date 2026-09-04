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

## Mkety repository roles

- `MketyDigital/mksaas` is the authoritative development repository for the new Mkety platform/control plane.
- `MketyDigital/Mkety` is the current live/legacy Mkety product and a reference source for existing product concepts, pricing expectations, Solution Hub language, branding history, and payment behavior. Do not redesign or change the live legacy product unless explicitly instructed.
- `MketyDigital/mklms` contains the current production billing implementation for the first enterprise product, MkLMS. Treat its billing code and live contract as production infrastructure, not as throwaway template code.

## Mkety billing direction

Mkety Billing should become a uniform MKSaaS billing layer covering plans, subscriptions, invoices, wallet/credits, usage, ledger records, settlement records, and provider-specific adapters.

Payment gateways currently part of the Mkety concept are:

- Selar for local/card-style checkout paths where appropriate;
- NOWPayments for crypto checkout and settlement.

The correct interpretation of "reuse the MkLMS billing system" is:

- The MkLMS external managed-hosting billing Worker/provider contract is the current production source for Mkety's NOWPayments billing path.
- Do not freely edit or break the MkLMS billing implementation because it is already serving the first enterprise client product.
- MKSaaS should consume, wrap, or evolve around that production contract through compatibility-preserving adapters and tenant-backed configuration.
- Do not copy/rebuild legacy NOWPayments routes inside MKSaaS.
- Do not force deployed MkLMS customers to change settlement endpoints, installation IDs, shared-secret behavior, or provider credential names.
- Any future change to the billing Worker must be backward compatible, staged, and validated against MkLMS production requirements first.

Current reusable service contract:

- standalone Cloudflare Worker: `workers/billing/` in `MketyDigital/mklms`;
- provider credentials deliberately reuse the legacy Mkety names `NOWPAYMENTS_API_KEY` and `NOWPAYMENTS_IPN_SECRET`;
- central Worker can serve multiple enterprise/customer installations;
- each customer has a unique installation ID and per-installation HMAC shared secret;
- the Worker never needs customer database passwords;
- NOWPayments IPN verification fails closed and only `payment_status=finished` creates automatic settlement;
- customer applications expose a narrow signed settlement endpoint that marks only the identified monthly managed-hosting record `PAID`;
- manual `PENDING`, `PAID`, and `WAIVED` controls remain available independently;
- future MKSaaS tenant storage may replace or feed the Worker's secret JSON customer registry without changing existing MkLMS customer settlement endpoints.

Before integrating billing, read:

1. `MketyDigital/mksaas/agents.md` for the larger product/control-plane blueprint.
2. `MketyDigital/Mkety` for legacy/live payment and product behavior.
3. `MketyDigital/mklms/docs/deployment/external-managed-hosting-billing.md` for the production managed-hosting billing contract.
4. The corresponding MkLMS design/implementation plan before touching billing-related code.
