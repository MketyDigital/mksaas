# Mkety Platform

Mkety is a multi-tenant technology platform for building, automating, deploying, and operating digital products and workflows.

This repository contains the current Mkety product codebase, including the public website, authenticated platform, Mkety Auth integration, public AI, billing/entitlement foundations, deployment tooling, and production Cloudflare Worker configuration.

## Current architecture

- **Web/runtime:** Next.js 16 + vinext on Cloudflare Workers
- **Database:** PostgreSQL 17 + pgvector + Drizzle ORM
- **Production DB access:** Cloudflare Hyperdrive over Workers VPC
- **Authentication:** Mkety Auth with a provider-neutral OIDC layer; production provider is ZITADEL
- **UI:** React 19 + Tailwind CSS 4
- **AI:** AI SDK 6 with Mkety-owned public and tenant-scoped boundaries
- **CI/CD:** GitHub Actions + Wrangler
- **Production public domain:** `https://mkety.com`

## Repository authority

Read these before making material changes:

1. [AGENTS.md](./AGENTS.md) — active Mkety architecture, product, safety, infrastructure, and sequencing rules.
2. [docs/CURRENT_WORKSTREAM_STATUS.md](./docs/CURRENT_WORKSTREAM_STATUS.md) — current verified workstream state and exact next actions.
3. [docs/MKETY_DEVELOPMENT_CONTINUATION.md](./docs/MKETY_DEVELOPMENT_CONTINUATION.md) — operational continuation and milestone requirements.
4. [docs/README.md](./docs/README.md) — engineering documentation index and source-of-truth guidance.

Historical starter-era documents may remain for implementation history, but they are not architecture authority where they conflict with the sources above.

## Local development

Prerequisites: Node.js 22+, pnpm 10+, Docker for the full local stack.

```bash
pnpm install
pnpm dev
```

For the repository's DevContainer setup, open the project in an editor with Dev Containers support and use the included `.devcontainer` configuration.

## Verification

Every meaningful implementation batch should run the relevant full gate. The standard baseline is:

```bash
pnpm test
pnpm type-check
pnpm lint
pnpm build
pnpx vinext check
```

For public content/database changes:

```bash
pnpm db:smoke:mkety-content
```

For migration changes, also run the repository's migration integrity checks and current Drizzle checks.

Do not report a change as verified or production-ready unless the required commands and environment smokes actually ran for the reported SHA.

## Production safety

- Production secrets live in approved secret stores and GitHub environment secrets, never in source.
- The production Worker uses the `MKETY_DB` Hyperdrive binding rather than a direct database credential.
- Database migrations use the guarded private database executor.
- Public hostname mutations and production cutovers use guarded workflows with rollback evidence.
- Authentication changes require live login/callback/session/logout verification against the configured identity provider.
- Public Mkety AI must remain isolated from tenant-private data and arbitrary tool access.

## Project structure

```text
src/
├── app/                         # Next.js App Router
├── features/                    # Product and domain feature modules
├── shared/                      # Shared DB, auth, UI and infrastructure code
└── i18n/                       # Localized messages

docs/                            # Architecture, handoffs, plans and runbooks
scripts/                         # Build, deploy, migration, seed and smoke tooling
.github/workflows/               # CI, diagnostics, candidate and production workflows
```

## Documentation

- [Engineering docs index](./docs/README.md)
- [Current workstream status](./docs/CURRENT_WORKSTREAM_STATUS.md)
- [Development continuation](./docs/MKETY_DEVELOPMENT_CONTINUATION.md)
- [Mkety Platform blueprint](./docs/MKETY_PLATFORM_BLUEPRINT.md)
- [Authentication](./docs/AUTHENTICATION.md)
- [Database](./docs/DATABASE.md)
- [Deployment](./docs/DEPLOYMENT.md)
- [Roles and permissions](./docs/ROLES_AND_PERMISSIONS.md)
- [Contributing](./CONTRIBUTING.md)

## License

MIT — see [LICENSE](./LICENSE).
