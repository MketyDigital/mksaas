# Mkety Identity and Authentication

## Authority

`AGENTS.md` is the source of truth for Mkety identity architecture. It defines **ZITADEL as the intended identity foundation**. The product-facing authorization boundary is the Mkety Auth Gateway described in `docs/MKETY_AUTH_GATEWAY_ARCHITECTURE.md`.

The inherited mksaas Auth.js/Auth0 implementation is retired and must not be restored as Mkety's authentication architecture.

## Current implementation state

The production ZITADEL adapter is not wired yet. Until it is, identity is intentionally **fail closed**:

- `src/shared/lib/auth.ts` is the server-side Mkety identity contract.
- `src/shared/lib/auth-client.ts` is the client-side Mkety identity contract.
- neither contract fabricates a user or local development session;
- protected Platform routes redirect unauthenticated visitors to the appropriate sign-in surface;
- protected APIs and server actions must continue to reject missing identity;
- tenant membership, roles, permissions, and entitlements remain Mkety-owned authorization data and are not identity-provider claims.

## Target flow

```text
ZITADEL
  ↓ verified identity
Mkety identity adapter / Auth Gateway
  ↓ Mkety-owned access decision
Mkety Platform / Academy / Enterprise products
  ↓ product-local authorization and tenant state
ALLOW or DENY
```

Identity, authorization, entitlement, and workspace/project membership are separate concerns. Do not collapse them into a provider session object.

## Server usage

Server code should depend on the Mkety boundary rather than a provider SDK:

```ts
import { auth } from '@/shared/lib/auth';

const session = await auth();
if (!session?.user) {
  // redirect, return 401/403, or otherwise fail closed
}
```

When ZITADEL is implemented, `auth()` may resolve a verified Mkety session through the approved identity adapter. Callers should not need to import ZITADEL-specific APIs directly.

## Client usage

Client components should use either:

```ts
import { useAuth } from '@/features/auth';
```

or the lower-level Mkety client boundary:

```ts
import { useSession, signIn, signOut } from '@/shared/lib/auth-client';
```

Until the real provider is connected, these APIs report unauthenticated state and refuse sign-in rather than creating a fake session.

## Data model

`src/shared/db/schema/auth.ts` still contains historical identity-account/session tables for migration compatibility. Their presence does **not** make Auth.js the Mkety identity system. Do not drop or repurpose those tables without a reviewed database migration.

Active Mkety authorization data includes tenant memberships, roles, permissions, and related product-access state.

## Security requirements

- Fail closed when identity cannot be verified.
- Never trust caller-supplied user, tenant, role, entitlement, audience, or workspace claims.
- Enforce tenant/project scope on protected operations.
- Keep identity-provider details behind Mkety-owned abstractions.
- Never commit provider secrets or signing keys.
- Do not add a development bypass that creates production-like sessions.
- Do not implement the Auth Gateway or ZITADEL integration implicitly as part of unrelated deployment work.

## Related architecture

- `AGENTS.md`
- `docs/MKETY_AUTH_GATEWAY_ARCHITECTURE.md`
- `docs/CENTRAL_MKETY_AUTH_GATEWAY_RECOMMENDATION.md`
- `docs/MKETY_DOMAIN_ARCHITECTURE.md`
