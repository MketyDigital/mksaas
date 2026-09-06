# Mkety Cloudflare vinext Migration Design

Date: 2026-09-06
Status: Proposed for implementation after review

## Context

Mkety is a Next.js 16.2.4 application deployed from GitHub to Cloudflare Workers. The current application build succeeds under Next.js, but the OpenNext Cloudflare adapter fails while packaging the Next.js 16 `proxy.ts` entrypoint because it looks for the legacy `.next/server/middleware.js.nft.json` artifact.

The application uses `src/proxy.ts` for authentication-aware tenant routing, custom-domain routing, and admin authorization. This logic is part of the product architecture and must not be weakened or rewritten merely to satisfy a deployment adapter.

Cloudflare's current Next.js Workers guidance recommends vinext as the default path for existing Next.js 16 applications. vinext supports App Router, route handlers, server actions, middleware/proxy routes, and Cloudflare Workers deployment while allowing the existing Next.js project structure to remain intact.

## Goal

Replace the OpenNext-specific Cloudflare deployment layer with vinext while preserving Mkety's Next.js application architecture, runtime behavior, tenant isolation, Auth.js integration, database access, routes, and existing local Next.js development workflow.

## Non-goals

This migration will not:

- downgrade Next.js;
- rewrite Mkety as a Vite-native application;
- change tenant, authentication, project, Automation, Agent, Deploy, Domain, or Trading architecture;
- replace the database layer;
- change application routes or public URLs;
- migrate to Cloudflare Pages;
- add unrelated refactors;
- enable new product features.

## Architecture Decision

Use vinext as the Cloudflare Workers build/deployment adapter while retaining Next.js as the application's source framework.

The repository will continue to keep the existing `app/`, `src/`, `public/`, and Next.js configuration. The current `next dev` workflow remains available for normal development. vinext adds a parallel Cloudflare-compatible build path used for compatibility validation, Workers production builds, preview, and deployment.

## Migration Strategy

### 1. Compatibility first

Before replacing the OpenNext deployment configuration, run the vinext compatibility check against the existing project and record any unsupported or partially supported APIs that affect Mkety.

Any compatibility finding that touches authentication, tenant isolation, database behavior, dynamic routing, route handlers, server actions, or `src/proxy.ts` must be treated as a migration blocker until understood and tested.

### 2. Remove OpenNext-only deployment wiring

Remove configuration that exists solely for the OpenNext adapter, including:

- `@opennextjs/cloudflare` dependency;
- `open-next.config.ts`;
- OpenNext-specific build, preview, and deploy scripts;
- any Wrangler fields that are only valid for `.open-next` output.

Do not remove general Cloudflare Workers settings that remain applicable under vinext unless vinext generates a replacement.

### 3. Add vinext alongside Next.js

Use the current vinext initializer behavior as the reference for the repository changes. The resulting setup should add the vinext/Vite Cloudflare dependencies and configuration required for Workers without deleting the existing Next.js workflow.

Expected repository-level concerns include:

- vinext dependency;
- Vite dependency/configuration;
- Cloudflare Vite integration;
- vinext Cloudflare adapter/deploy support;
- Wrangler configuration aligned with vinext output;
- package scripts for vinext development, build, preview, and deployment.

Exact package versions and generated config shapes must be taken from the current vinext/Cloudflare toolchain at implementation time rather than copied from stale examples.

### 4. Preserve the existing Next.js workflow

The regular Next.js commands must remain available so Mkety is not locked to Cloudflare for development or future hosting decisions.

At minimum:

- normal Next.js development remains usable;
- the existing Next.js application build can still be executed independently;
- vinext-specific commands are clearly separated where practical.

If Cloudflare requires the repository's primary `build` script to invoke vinext for automatic deployment, preserve an explicit `build:next` script for the native Next.js build and use a dedicated `build:vinext` script for the Workers artifact.

### 5. Preserve runtime environment behavior

The deployment must continue to receive the existing Cloudflare build/runtime variables and secrets, including at minimum:

- `NEXT_PUBLIC_APP_NAME`;
- `NEXT_PUBLIC_APP_URL`;
- `DATABASE_URL`;
- `AUTH_SECRET`;
- `AUTH_URL`;
- `ENABLE_AI_FEATURES`.

No secret value is committed to Git. Existing Worker variables/secrets remain managed through Cloudflare.

The database connection remains the externally managed PostgreSQL/Supabase pooler session URL already configured by the operator.

### 6. Proxy and tenant-routing preservation

`src/proxy.ts` remains authoritative for current request-level behavior unless vinext compatibility requires a narrowly scoped adaptation.

The migration must preserve these behaviors:

- known application host detection;
- custom-domain tenant lookup;
- verified-domain-only tenant rewrites;
- unauthenticated custom-domain routing to tenant login;
- tenant slug propagation;
- admin-route authorization;
- normal application-host fallback when custom-domain lookup fails.

Any required adaptation must be behaviorally equivalent and covered by focused tests before deployment.

### 7. Build and deployment flow

The intended Cloudflare production flow is:

1. GitHub `main` changes trigger Cloudflare build;
2. dependencies install with the committed lockfile;
3. vinext performs the Workers-compatible production build;
4. Cloudflare deploys the generated Worker;
5. runtime variables/secrets remain attached to the Worker;
6. preview/Workers domain is verified before attaching or updating `mkety.com`.

The repository must not depend on an interactive migration step during every Cloudflare deployment.

## Failure Handling

If vinext compatibility identifies a real unsupported Mkety feature, stop and isolate that feature before changing application behavior. Do not introduce broad application rewrites to force deployment.

If the native Next.js build passes but the vinext build fails, treat it as an adapter compatibility issue and debug from the first failing boundary.

If both native Next.js and vinext builds fail after a migration change, revert or repair the migration change before continuing.

## Testing and Verification

Before the migration is considered complete, the feature branch must demonstrate:

1. dependency installation with the committed lockfile;
2. existing automated tests pass;
3. lint passes;
4. TypeScript type-check passes;
5. native Next.js production build passes;
6. vinext compatibility check has no unresolved blockers affecting Mkety's used APIs;
7. vinext production build succeeds;
8. proxy/auth/tenant-routing focused tests pass;
9. generated Cloudflare Worker configuration points to vinext output rather than `.open-next` artifacts.

Final verification commands should include the repository equivalents of:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm type-check
pnpm run build:next
pnpm run build:vinext
```

and the current vinext compatibility check.

## Rollout

Implementation occurs on `feat/cloudflare-vinext-migration` first. Do not merge the migration into `main` until the vinext build and existing CI checks pass.

After verification, merge the deployment migration into `main`. Cloudflare may then rebuild automatically from `main`. Verify the Workers preview/production URL before changing DNS or treating `mkety.com` as complete.

## Rollback

Because the migration is deployment-layer focused, rollback is the previous known application commit/configuration. No database migration or application data change is required for the vinext deployment migration itself.

## Success Criteria

The migration is successful when:

- Mkety remains a Next.js 16 application;
- existing application tests, lint, and type-check remain green;
- native Next.js build succeeds;
- vinext can build Mkety for Cloudflare Workers;
- `src/proxy.ts` behavior is preserved;
- Cloudflare can deploy the repository from GitHub without OpenNext;
- no OpenNext runtime artifact such as `.open-next/worker.js` is required;
- the deployed Worker can use the configured database/auth/runtime variables;
- the migration does not alter unrelated Mkety product architecture.

## References

- Cloudflare Workers Next.js guide, current as of 2026-09-06: vinext is the recommended/default Next.js Workers path for existing Next.js 16 applications and supports `proxy.ts`.
- Cloudflare automatic configuration guide, current as of 2026-09-06: Next.js automatic configuration uses vinext by default.
- vinext project documentation, current as of 2026-09-06: `vinext init` is designed as a non-destructive migration that keeps the existing Next.js project structure and workflow available.
