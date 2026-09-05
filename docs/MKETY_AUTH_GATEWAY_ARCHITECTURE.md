# Mkety Auth Gateway Architecture

## Status

Target architecture note for the modern Mkety system. This document adapts `docs/CENTRAL_MKETY_AUTH_GATEWAY_RECOMMENDATION.md` into the active `mksaas` architecture so future development does not forget how identity, authorization, entitlements, and standalone enterprise products fit together.

This document is not a production deployment by itself. Implementation must happen through reviewed code, migrations, Cloudflare configuration, key management, and verification.

## How it fits into AGENTS.md

AGENTS.md defines Mkety as:

```text
Mkety
├── Mkety Platform
├── Mkety Academy
└── Enterprise / Customer Solutions
    ├── Trading
    ├── mklms
    └── Future customer projects
```

AGENTS.md also separates identity, authorization, entitlements, and project membership. The Mkety Auth Gateway fits exactly at that boundary.

```text
ZITADEL
  ↓ identifies who the person is
Mkety Auth Gateway
  ↓ verifies product access from Mkety-owned records
Short-lived signed Mkety access assertion
  ↓
Mkety Platform / Academy / Trading / mklms / Enterprise Apps
  ↓
Each product enforces its own local authorization and tenant/product state
```

## Core decision

ZITADEL should remain the identity provider. Mkety should own the reusable product-access contract.

Products must not depend directly on ZITADEL-specific organization/project/role claims as their final access authority. Instead, products should verify a stable Mkety assertion and then enforce their own product-local authorization.

## Why this matters

Mkety will have one platform, one Academy product, and multiple enterprise/customer applications. Trading is visible in the Mkety frontend but architecturally standalone. A central auth gateway allows Trading, Academy, mklms, and future standalone applications to share Mkety identity/access without each one inventing its own auth system.

## Target flow

```text
User signs in
  ↓
ZITADEL authenticates identity
  ↓
Mkety checks organization, membership, product entitlement, workspace/project access
  ↓
Mkety Auth Gateway signs a short-lived assertion
  ↓
Receiving product verifies signature, issuer, audience, time, product, workspace/project, and access level
  ↓
Receiving product checks its own database/state
  ↓
ALLOW or DENY
```

## First gateway endpoints

Keep version one minimal:

```text
GET  /.well-known/jwks.json
POST /v1/access/trading
```

Add more product issuance endpoints only when needed:

```text
POST /v1/access/platform
POST /v1/access/academy
POST /v1/access/mklms
POST /v1/access/customer-apps
```

## Assertion requirements

Assertions must be:

- short-lived
- signed with asymmetric keys such as RS256
- key-rotation ready through `kid`
- product-specific through `aud` and `product`
- derived only from server-verified identity, entitlement, membership, and workspace/project state
- verified by each receiving product before access is granted

Example for Trading:

```json
{
  "sub": "immutable-user-subject",
  "product": "trading",
  "workspace_id": "trading-workspace-id",
  "access": "owner",
  "iss": "https://auth.mkety.com",
  "aud": "mkety-trading",
  "iat": 0,
  "exp": 0,
  "jti": "unique-token-id"
}
```

## Security requirements

- Store private signing keys only in Cloudflare secrets or equivalent server-side secret storage.
- Never commit private keys to GitHub.
- Publish only public verification keys through JWKS.
- Verify `iss`, `aud`, `iat`, `exp`, `kid`, algorithm, product, workspace/project, and access claims.
- Reject caller-supplied identities, products, workspaces, organizations, audiences, and entitlements unless verified server-side.
- Fail closed.
- Log request IDs and security outcomes without logging bearer tokens or unnecessary private claims.
- Support key rotation without simultaneous redeploy of every receiving product.

## Relationship to platform control center

The Platform Control Center may expose operational visibility for the Auth Gateway, but it must not expose private keys or allow unsafe rule editing.

Allowed admin controls:

- view gateway status
- view key rotation metadata, not private keys
- view product audiences
- view recent access issuance/audit outcomes
- enable or disable a product access surface through controlled feature flags
- rotate keys through a secure backend action
- revoke or disable product access through entitlements/membership records

Not allowed:

- editing private keys directly
- editing signed claims manually
- bypassing entitlement checks
- bypassing tenant isolation
- changing cryptographic algorithms from UI
- disabling authorization checks

## Implementation phases

### Phase 1 — Document and model

- Keep this document in the active `mksaas` repo.
- Add Auth Gateway as a Platform Control Center module under Security/Identity.
- Keep product code dependent on Mkety-owned access abstractions, not raw ZITADEL assumptions.

### Phase 2 — Contract and verification library

- Add shared types for Mkety access assertions.
- Add verification helpers for issuer, audience, expiration, algorithm, and JWKS key lookup.
- Add tests that fail closed.

### Phase 3 — Cloudflare gateway

- Implement Cloudflare Worker/service for `auth.mkety.com` or approved auth hostname.
- Add JWKS endpoint.
- Add first product access issuance endpoint for Trading only when Trading integration is ready.

### Phase 4 — Product integration

- Trading verifies Mkety assertions and still checks Trading-owned DB state.
- Academy, mklms, and future customer apps can adopt the same pattern later.

## Non-negotiables

- Identity is not authorization.
- Authorization is not entitlement.
- Entitlement is not project/workspace membership.
- No product should become hard-coupled to raw ZITADEL implementation details.
- No private key or secret belongs in source code.
- No frontend-only access decision is trusted.
- No gateway implementation is production-ready until tests, security review, key rotation, logging, and deployment verification are complete.
