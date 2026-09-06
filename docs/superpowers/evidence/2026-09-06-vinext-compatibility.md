# Mkety vinext Compatibility Evidence

Date: 2026-09-06
Branch: `feat/cloudflare-vinext-migration`
Workflow run: `34038294621`
Job: `101500300429`
Command: `pnpm dlx vinext@latest check`
Result: command succeeded; migration blocked by authentication compatibility.

## Summary

vinext reported Mkety as **85% compatible**: 21 supported items, 2 partial items, and 3 issues.

### Supported application APIs and structure

The compatibility check reported these as supported:

- `next/navigation` — 44 files
- `next/link` — 58 files
- `next/image` — supported, with vinext's current image implementation caveat
- `next/server` — 30 files; `NextRequest` / `NextResponse` shimmed
- `next/cache` — 7 files
- `next/headers` — 3 files
- App Router under `src/app/`
- 43 pages
- 5 layouts
- 38 route handlers
- loading/error/not-found boundaries

This means the original OpenNext `proxy.ts` packaging failure is not reproduced as a generic Next.js API incompatibility in vinext; vinext's compatibility surface includes the request/response APIs Mkety's proxy uses.

## Blocking issue: Auth.js / next-auth

vinext reports:

```text
✗ next-auth — relies on Next.js API route internals; consider migrating to better-auth
```

Mkety currently uses `next-auth` / Auth.js 5 beta and `src/proxy.ts` is wrapped by `auth(...)`. Authentication is also used by route handlers and tenant/admin authorization. The approved migration design explicitly states that Auth.js must not be replaced or weakened as part of the Cloudflare deployment migration.

Therefore this is a **migration blocker** under the design gate. Running `vinext init` now would be premature because successful bundling would not prove authentication correctness.

## Non-blocking / straightforward issues

vinext also reports:

```text
✗ Missing "type": "module" in package.json
```

The initializer can add this automatically. Any CommonJS configuration files would need appropriate `.cjs` handling.

vinext reports one CommonJS-global usage:

```text
scripts/migrate-mkety-platform-content.ts
```

because it uses `__dirname` / `__filename`. This script can be converted to `import.meta.dirname` / `import.meta.filename` or `fileURLToPath(import.meta.url)` under Node 22. This is not an application-runtime blocker.

## Partial support notes

- `next/font/google` — fonts are loaded from CDN rather than self-hosted at build time.
- `reactStrictMode` — App Router strict-mode behavior is not yet identical to Next.js's default wrapping behavior.

Neither partial item is currently an authentication or tenant-isolation blocker.

## Decision

**Do not run `vinext init` yet.**

The deployment migration remains paused until one of these is explicitly approved:

1. keep Auth.js and remain on the native Next.js/OpenNext-compatible deployment path until vinext supports it;
2. separately design and migrate authentication away from `next-auth`, then resume vinext;
3. perform a narrowly scoped proof-of-compatibility against Mkety's exact Auth.js flows only if upstream vinext gains/claims compatible next-auth support.

No application source, authentication behavior, database schema, or tenant-routing behavior was changed by this compatibility probe.
