# ⚙️ Project Configuration

Mkety Platform uses a single Cloudflare/vinext runtime baseline with type-safe configuration, strict database migrations, and a Mkety-owned authentication boundary.

## Tech Stack

| Category   | Technology |
| ---------- | ---------- |
| Framework  | Next.js 16 App Router + vinext on Cloudflare Workers |
| Language   | TypeScript 5+ (strict) |
| Styling    | Tailwind CSS v4 + shadcn/ui |
| Database   | Drizzle ORM + PostgreSQL + pgvector |
| Auth       | Mkety Auth with a replaceable ZITADEL OIDC adapter |
| Testing    | Jest + React Testing Library |
| Linting    | ESLint 9 (flat config) |
| Formatting | Prettier |
| Git Hooks  | Husky + lint-staged |

## Runtime Authority

`pnpm dev`, `pnpm build`, `pnpm start`, and `pnpm deploy` use the vinext/Cloudflare path. `dev:next` and `build:next` exist only as explicit framework diagnostics; they are not a second deployment runtime.

Do not reintroduce OpenNext, container production deployment, or another production runtime without an explicit architecture decision.

## ESLint

ESLint configuration lives in `eslint.config.mjs` and enforces TypeScript, import-order, React Hooks, Next.js, and accessibility rules.

## Prettier

Formatting is configured through `.prettierrc.cjs`. Use `pnpm format` for repository-wide formatting.

## TypeScript

The project uses strict TypeScript and `pnpm type-check` as a required verification gate. Runtime validation is still required at external boundaries; compile-time types do not replace request, environment, database, or provider validation.

## Environment Variables

### direnv Setup

The project uses `direnv` for automatic local environment loading.

| File | Purpose | Git |
| ---- | ------- | --- |
| `.envrc.example` | Development template with safe defaults/placeholders | Committed |
| `.envrc` | Local developer environment | Ignored |
| `.env.local` | Additional local secrets/overrides | Ignored |

Typical local setup:

```bash
cp .envrc.example .envrc
direnv allow
```

The DevContainer handles this automatically on first setup. It generates a local `MKETY_AUTH_SESSION_SECRET`; provider credentials are never generated or faked.

### Type-Safe Access

Environment variables are validated through `src/shared/lib/env.ts` using `@t3-oss/env-nextjs` and Zod.

```typescript
import { env } from '@/shared/lib/env';

const dbUrl = env.DATABASE_URL;
const appName = env.NEXT_PUBLIC_APP_NAME;
```

### Core Variables

| Variable | Description | Requirement |
| -------- | ----------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string | Required for database-backed runtime/migrations |
| `MKETY_AUTH_PROVIDER` | Mkety Auth provider adapter selector | `zitadel` for the current adapter |
| `MKETY_AUTH_ISSUER` | OIDC issuer | Required for provider-backed sign-in |
| `MKETY_AUTH_CLIENT_ID` | OIDC client ID | Required for provider-backed sign-in |
| `MKETY_AUTH_CLIENT_SECRET` | OIDC client secret | Required for the current confidential-client flow |
| `MKETY_AUTH_REDIRECT_URI` | Mkety callback URI | Required for provider-backed sign-in |
| `MKETY_AUTH_POST_LOGOUT_REDIRECT_URI` | Post-logout return URI | Required for provider-backed logout |
| `MKETY_AUTH_SESSION_SECRET` | Mkety-owned application session secret | Required; at least 32 characters |
| `WEBHOOK_SECRET_ENCRYPTION_KEY` | Encryption key for Automation webhook signing secrets | Required when webhook endpoints are enabled |

See `.env.example` for the complete list. Do not restore `AUTH_SECRET`, `NEXTAUTH_*`, or provider-specific application-session ownership.

## Database Migration Namespaces

Mkety currently has two explicit migration namespaces:

- `pnpm db:migrate` applies Drizzle application migrations from `src/shared/db/migrations`.
- `pnpm db:migrate:mkety-content` applies the independent Mkety public-content/app-experience SQL under root `migrations/`.

Before shared or production rollout, run the migration baseline guard and the relevant smoke/seed commands documented in `docs/MKETY_MIGRATION_BASELINE.md` and `docs/MKETY_PUBLIC_CMS_ROLLOUT_CHECKLIST.md`.

## Tailwind CSS v4

Tailwind v4 uses the CSS-first configuration in `src/app/globals.css`. `tailwind.config.ts` remains minimal for tooling compatibility.

## Absolute Imports

Absolute imports are configured in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Prefer:

```typescript
import { Button } from '@/shared/components/ui';
```

over deep relative imports.
