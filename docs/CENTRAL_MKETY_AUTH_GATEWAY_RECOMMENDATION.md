# Central Mkety Auth Gateway Recommendation

## Status
Recommendation only. This document records the target identity/access architecture for future implementation in the current `mksaas` platform. It does not authorize or implement production identity changes by itself.

## Recommendation
Build one central **Mkety Auth Gateway** hosted on Cloudflare and owned by the Mkety platform architecture.

The gateway should become the reusable identity/access boundary for all Mkety products and standalone enterprise applications, including Trading.

```text
User
  ↓
ZITADEL
  ↓
Mkety Auth Gateway (Cloudflare)
  ↓
Mkety product entitlement / access decision
  ↓
Short-lived signed Mkety access assertion
  ↓
Mkety product / enterprise application
```

ZITADEL remains the initial identity provider and answers **who the person is**. Mkety owns the product-access abstraction and should not spread ZITADEL-specific claims, projects, organization structures or APIs throughout individual products.

## Core principles

1. **One central Mkety identity/access layer.** Do not create a separate authentication system for Trading, Academy, Platform, or future enterprise products.
2. **ZITADEL stays replaceable infrastructure behind Mkety.** Products consume a stable Mkety access contract rather than depending directly on ZITADEL-specific token shapes.
3. **Cloudflare-hosted gateway.** Prefer a dedicated Cloudflare Worker/service, for example behind a controlled Mkety hostname such as `auth.mkety.com` or another approved internal/public identity hostname.
4. **Short-lived signed assertions, not reusable access codes.** A code may be used for onboarding or redemption, but never as the final reusable authorization credential.
5. **RS256/asymmetric signing.** The private signing key remains server-side in the Mkety Auth Gateway. Products verify with public keys published through JWKS.
6. **Key rotation-ready from the beginning.** Use `kid`-addressable keys and publish active verification keys through a JWKS endpoint.
7. **Product-specific audience and claims.** Each receiving product verifies its intended audience and product entitlement.
8. **Fail closed.** Never sign a caller-supplied `sub`, organization, workspace, role, or entitlement without server-side verification.
9. **Identity is not application authorization.** Products still enforce their own server-owned authorization/state after validating the Mkety assertion.
10. **Independent product runtimes.** Loss of the Mkety Platform frontend/runtime should not automatically stop already-running standalone enterprise product workloads. Authentication/access issuance can be a shared dependency at login/access time without becoming a dependency for unrelated background/runtime processing.

## Recommended assertion contract

A product-specific access assertion should be short-lived and contain only the verified context required by that product.

Example for Mkety Trading:

```json
{
  "sub": "immutable-user-subject",
  "product": "trading",
  "workspace_id": "trading-workspace-id",
  "access": "owner",
  "iss": "https://<mkety-auth-gateway>",
  "aud": "mkety-trading",
  "iat": 0,
  "exp": 0,
  "jti": "unique-token-id"
}
```

The gateway must derive these claims from trusted identity and Mkety-owned entitlement data. It must not trust browser-supplied identity or workspace authority.

## Recommended endpoints

Keep the first version minimal:

```text
GET  /.well-known/jwks.json
POST /v1/access/trading
```

Future product-specific issuance endpoints may be added behind the same Mkety Auth Gateway when a real requirement exists. Avoid building a general-purpose identity platform before it is needed.

## Trading integration contract

Trading should depend only on the Mkety access contract:

```text
Mkety Auth Gateway
  ↓ signed assertion
Trading
  ↓ verifies signature / issuer / audience / time / product / workspace / access
Trading-owned database
  ↓ independently verifies exact enabled workspace + subject authorization
ALLOW / DENY
```

Trading must not make direct ZITADEL organization/project-role claims its final authorization authority.

## Security requirements

- Private signing keys stored only as Cloudflare secrets or equivalent secure server-side secret storage.
- Never commit private keys to GitHub.
- Public JWKS contains verification material only.
- Short assertion lifetime.
- Verify `iss`, `aud`, `iat`, `exp`, signature algorithm and `kid`.
- Reject unknown products, workspaces, subjects and disabled/revoked entitlements.
- Prevent open redirects and caller-selected audiences.
- Log request IDs and security outcomes without logging bearer tokens or private claims unnecessarily.
- Prepare for key rotation without forcing simultaneous redeployment of every consuming product.

## Future accommodation

The same gateway can later issue stable Mkety access contracts for:

- Mkety Platform
- Mkety Academy
- Trading
- mklms
- future standalone enterprise/customer applications
- selected internal Mkety services

Each product remains independently deployable and keeps its own application authorization/data isolation rules.

## Implementation boundary

Do not implement this recommendation inside the legacy `MketyDigital/Mkety` application. The current source of truth is `MketyDigital/mksaas` and the gateway should be designed to serve the complete modern Mkety ecosystem from Cloudflare.
