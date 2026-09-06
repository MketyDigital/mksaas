# Mkety Platform Documentation

> [!IMPORTANT]
> `AGENTS.md` is the master architecture authority. Mkety-specific documents in this folder provide the detailed implementation source of truth for each subsystem.

This repository is the authoritative development repository for the Mkety Platform and public website.

## Core Documentation

| Document                                                                              | Description                                                                                   |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| [Project Structure](./PROJECT_STRUCTURE.md)                                           | Architecture, folder organization, and feature modules                                        |
| [Mkety Auth Source of Truth](./MKETY_AUTH_SOURCE_OF_TRUTH.md)                         | Approved Mkety Auth boundary, ZITADEL adapter model, session contract, and Cloudflare handoff |
| [Authentication](./AUTHENTICATION.md)                                                 | Current Mkety Auth implementation and ZITADEL OIDC configuration                              |
| [Mkety Auth Gateway](./MKETY_AUTH_GATEWAY_ARCHITECTURE.md)                            | Shared cross-product identity/access gateway architecture                                     |
| [Central Auth Gateway Recommendation](./CENTRAL_MKETY_AUTH_GATEWAY_RECOMMENDATION.md) | Original central gateway recommendation and security constraints                              |
| [Database](./DATABASE.md)                                                             | Drizzle ORM schema and pgvector setup                                                         |
| [Roles and Permissions](./ROLES_AND_PERMISSIONS.md)                                   | PBAC model, roles, permissions, and API                                                       |
| [State Management](./STATE_MANAGEMENT.md)                                             | State handling approaches                                                                     |
| [Performance](./PERFORMANCE.md)                                                       | Optimization guidelines                                                                       |
| [Project Configuration](./PROJECT_CONFIGURATION.md)                                   | Build tools and configuration                                                                 |
| [Testing Guide](./TESTING_GUIDE.md)                                                   | Jest and React Testing Library patterns                                                       |
| [API Reference](./API.md)                                                             | REST API routes and contracts                                                                 |
| [Integrations](./INTEGRATIONS.md)                                                     | Third-party OAuth2/API integrations such as GitHub                                            |
| [Deployment](./DEPLOYMENT.md)                                                         | Deployment and infrastructure                                                                 |
| [GitHub Setup Guide](./GITHUB_SETUP_GUIDE.md)                                         | CI/CD and GitHub workflows                                                                    |
| [Glossary](./GLOSSARY.md)                                                             | Terms, concepts, and domain vocabulary                                                        |

## Superpowers Design and Implementation Records

Approved subsystem specifications and implementation plans live under `docs/superpowers/specs/` and `docs/superpowers/plans/`.

For the Mkety Auth migration, start with:

- `docs/superpowers/specs/2026-09-06-mkety-auth-zitadel-cloudflare-design.md`
- `docs/superpowers/plans/2026-09-06-mkety-auth-zitadel-vinext.md`
