# Mkety Domain Architecture

## Status

Active architecture note for the `mksaas` build. This document turns the AGENTS.md domain rules into implementation guidance for public site, platform app, API, deployments, and admin/control-center work.

## Approved domain map

```text
mkety.com
```

Public Mkety company/product website. This is the primary marketing, product education, pricing, Academy, Enterprise, docs entry, and public Mkety AI surface.

```text
app.mkety.com
```

Main authenticated Mkety Platform. This is where customers manage organizations, projects, workspaces, AI, Automate, Deploy, SolutionHub, usage, billing, teams, and the Platform Control Center where permitted.

```text
api.mkety.com
```

Public/platform API surface. API routes, external integrations, product APIs, webhooks where appropriate, and service-to-service entry points should be intentionally routed here when they are not purely Next.js app-local handlers.

```text
origin.mkety.com
```

Infrastructure-only origin/routing hostname. It must not be used as a product URL, customer-facing placeholder, marketing URL, or general redirect target. It should exist only when it points to the real Mkety origin/routing layer behind Cloudflare/OCI.

```text
*.mkety.app
```

Customer-facing deployed applications, preview environments, generated sites, portals, APIs, and production app hostnames created through the Deploy workspace.

## Implementation boundaries

### Public site

The public website CMS and docs experience belong to `mkety.com`. Public content should not assume it is running on `app.mkety.com`.

### Platform application

Dashboard, workspaces, customer administration, Platform Control Center, and authenticated product operations belong to `app.mkety.com`.

### API

External and platform-level APIs should use `api.mkety.com` as the conceptual boundary. Internal app route handlers may still exist in the Next.js application, but the architecture should not blur public website routes with API product routes.

### Deployments

Customer deployments should use `*.mkety.app` and custom domains managed by the Deploy workspace. Do not place customer apps under `mkety.com` or `app.mkety.com`.

### Origin

`origin.mkety.com` is reserved for Cloudflare/OCI routing. It should never be marketed, linked in UI, or used as a generic fallback unless it is part of the actual routing layer.

### Auth Gateway

The Central Mkety Auth Gateway may later use a dedicated identity hostname such as `auth.mkety.com`, but that hostname must be approved intentionally before implementation. The current approved AGENTS.md map does not make `auth.mkety.com` a public product surface by default.

## Admin/control-center implications

The Platform Control Center should expose a Domains & Routing module that helps platform admins monitor and manage:

- public website domain status for `mkety.com`
- platform application status for `app.mkety.com`
- API routing status for `api.mkety.com`
- origin/routing readiness for `origin.mkety.com`
- customer app hostnames under `*.mkety.app`
- custom domain approval and verification flows

The UI may show status, verification state, and operational controls. The underlying DNS, Cloudflare, SSL, routing, and deployment logic must remain code-controlled and audit-protected.

## Non-negotiables

- Do not use Vercel production assumptions.
- Do not introduce extra domains casually.
- Do not put customer deployments under `mkety.com` or `app.mkety.com`.
- Do not treat `origin.mkety.com` as a customer-facing route.
- Do not make Trading, Academy, mklms, or enterprise products depend directly on raw ZITADEL claims when the Auth Gateway contract is implemented.
- Keep Cloudflare + OCI as the target production architecture.
