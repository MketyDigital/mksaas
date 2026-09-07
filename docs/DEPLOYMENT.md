# Mkety Platform Deployment

Mkety Platform targets **Cloudflare Workers** through the repository's vinext runtime baseline. The old generic Node/Vercel/Docker deployment guidance is no longer authoritative for this repository.

## Runtime baseline

- Application runtime: vinext on Cloudflare Workers.
- Database: PostgreSQL with the extensions required by the current schema (including pgvector where AI knowledge features use it).
- Package manager: pnpm.
- Node version: `.node-version`.
- Worker configuration: `wrangler.jsonc`.
- Base Worker name: `mkety-platform`.
- Isolated preview Worker: `mkety-platform-preview` through the `preview` Wrangler environment.

Do not reintroduce OpenNext, container deployment, or a second production runtime without an explicit architecture decision.

## Required application configuration

Use `.env.example` as the configuration contract. Core values include:

```env
DATABASE_URL=postgresql://user:password@host:5432/database
NEXT_PUBLIC_APP_URL=https://your-app-origin.example
NEXT_PUBLIC_APP_NAME=Mkety

MKETY_AUTH_PROVIDER=zitadel
MKETY_AUTH_ISSUER=https://<instance>.zitadel.cloud
MKETY_AUTH_CLIENT_ID=...
MKETY_AUTH_CLIENT_SECRET=...
MKETY_AUTH_REDIRECT_URI=https://your-app-origin.example/api/auth/callback
MKETY_AUTH_POST_LOGOUT_REDIRECT_URI=https://your-app-origin.example/login
MKETY_AUTH_SESSION_SECRET=<random-secret-at-least-32-characters>
```

`MKETY_AUTH_*` is the Mkety-owned authentication contract. Do not restore `AUTH0_*`, `NEXTAUTH_*`, Auth.js, or provider-specific application session configuration.

For Cloudflare automation, keep credentials in GitHub/Cloudflare secret storage rather than committed files:

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
```

## Database baseline

Application migrations live in `src/shared/db/migrations` and execute in SQL filename order. Before deployment, validate the baseline:

```bash
pnpm db:check:migrations
pnpm db:migrate
```

Mkety public-content/bootstrap SQL under the root `migrations/` directory is an independent namespace and uses its dedicated migration command:

```bash
pnpm db:migrate:mkety-content
```

Do not infer runtime migration order from incomplete legacy Drizzle snapshot/journal metadata. The durable migration baseline check protects active SQL prefix uniqueness and contiguity.

## Verify a deployment candidate

A candidate is not ready merely because it compiles. Run the same gates used by CI:

```bash
pnpm install --frozen-lockfile
pnpm db:check:migrations
pnpm test
pnpm type-check
pnpm lint
pnpx vinext check
pnpm build
pnpm run deploy --env preview --dry-run
```

`pnpm build` is the production vinext build. The preview dry-run validates isolated Cloudflare packaging without deploying anything.

## Preview deployment

The durable workflow `.github/workflows/mkety-cloudflare-preview.yml` verifies the candidate before attempting the isolated `mkety-platform-preview` workers.dev deployment.

The preview environment is intentionally separate from production. The workflow must:

1. pass the full verification gates;
2. require Cloudflare preview credentials;
3. create/update only the isolated preview Worker;
4. capture the exact workers.dev origin;
5. rebuild configuration for that exact origin;
6. bind the staging database and Mkety Auth secrets;
7. smoke public and unauthenticated session boundaries;
8. leave production untouched.

For Auth promotion, a successful Worker deployment is not enough. Register the exact preview callback and logout URIs with the configured ZITADEL project, then complete real browser smoke for login → callback → Mkety session → protected tenant authorization → logout.

## Production promotion

Production deployment is an explicit promotion action. Do not point preview workflows at the base `mkety-platform` Worker and do not deploy production merely because a PR is green.

Before production promotion:

- reconcile the migration sequence;
- confirm the intended commit SHA;
- pass all durable CI/runtime gates;
- confirm required Cloudflare/database/Auth configuration;
- complete the required external identity-provider smoke tests;
- obtain the explicit promotion decision for that release.
