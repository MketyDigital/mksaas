# 🗃️ State Management

Next.js SaaS AI Template uses a combination of React Server Components, React Context, and local state. There is no need for a single centralized store.

## Server State (Recommended)

With React Server Components, most data fetching happens on the server:

```typescript
// app/(tenant)/t/[tenant]/page.tsx
import { db } from '@/shared/db';

export default async function TenantDashboard({ params }: Props) {
  const { tenant } = await params;
  const skills = await db.query.skills.findMany({
    where: eq(skills.tenantId, tenant.id),
  });
  return <SkillsList skills={skills} />;
}
```

## Component State

Use local React state for state that belongs to one component or its immediate children. Lift it only when multiple nearby consumers genuinely need it.

- `useState` for simple independent state
- `useReducer` for coordinated state transitions

## Application State

Keep interactive application state close to the components that use it. Do not make every UI state global.

## Server Cache State

Server-derived data that needs client caching should use the project's established data-fetching patterns rather than duplicating the database as a global client store.

## Form State

For complex forms, use React Hook Form with Zod validation.

## Context State (Multi-tenancy)

Tenant information can be shared with React Context where multiple client components need the same current-tenant state.

## Auth State

Authentication is owned by **Mkety Auth**. ZITADEL is the current provider adapter and must not become the application's auth state contract.

Server-side consumers use:

```typescript
import { auth } from '@/shared/lib/auth';

const session = await auth();
```

Client components use the Mkety-owned facade:

```typescript
import { useAuth } from '@/features/auth/hooks/use-auth';

const { user, isAuthenticated, login, logout } = useAuth();
```

The browser session is represented by an opaque Mkety-owned cookie. Provider access tokens and ID tokens are not client application state.
