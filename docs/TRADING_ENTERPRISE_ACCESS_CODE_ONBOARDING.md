# Trading Enterprise Access-Code Onboarding

## Status

Approved architecture decision for Trading Enterprise launch. This document complements `AGENTS.md`, `docs/CENTRAL_MKETY_AUTH_GATEWAY_RECOMMENDATION.md`, and `docs/MKETY_AUTH_GATEWAY_ARCHITECTURE.md`.

## Decision

Mkety Trading Enterprise may launch with a simple access-code onboarding path while the wider Mkety Platform continues toward the central Zitadel-backed Mkety Auth Gateway architecture.

The access code is an onboarding/redemption credential only. It is not a permanent password, not a reusable authorization bypass, and not a replacement for Mkety's future central identity gateway.

## Why this exists

Trading is an enterprise/customer solution that is visible in the Mkety Platform but architecturally standalone. Requiring full Zitadel project/role setup before the first Trading launch creates unnecessary launch friction. A controlled access-code flow lets Mkety issue Trading workspaces safely while keeping Trading's runtime authorization inside Trading-owned database tables.

## Product boundary

- Mkety Platform: long-term central Zitadel/Auth Gateway identity and product-access model.
- Mkety Academy: may adopt the central identity model when implementation reaches that product.
- Mkety Trading: may use access-code onboarding first, then consume Mkety Auth Gateway assertions later without changing its core workspace/broker/source safety model.
- Future enterprise/customer apps: may use either direct central Auth Gateway access or an approved onboarding code flow depending on product maturity.

## Approved Trading flow

```text
Mkety admin creates a Trading Enterprise access code
  ↓
Customer opens the Trading portal
  ↓
Customer enters code plus owner details
  ↓
Trading validates the code server-side
  ↓
Trading creates or activates one workspace
  ↓
Trading creates the owner membership
  ↓
Trading issues a short-lived local Trading bearer/session for dashboard setup
  ↓
Owner can configure allowed sources, demo broker accounts, users, and domains
```

## Non-negotiables

- Access codes are server-side only and stored as hashes, not plaintext.
- Access codes are one-time or bounded-use and expire.
- Redemption is audited.
- Redemption creates server-owned workspace and membership records.
- Customer-supplied workspace, entitlement, subdomain, broker, or source hints are never final authority.
- Local Trading bearers are short-lived and scoped to one workspace/product.
- Broker execution remains disabled unless the separate broker execution fuse and account-level controls pass.
- The access-code flow must not grant live broker execution by itself.
- The future Mkety Auth Gateway remains the preferred long-term identity abstraction.

## Trading entitlement fields

A Trading access code may define:

- product: `trading`
- role: `owner`
- workspace display name
- owner email
- allowed source types
- allowed broker modes, usually `demo` first
- max team members
- custom subdomain allowed: true/false
- custom hostname allowed: true/false
- live execution allowed: false by default
- expiration
- max redemptions

## Relationship to Zitadel

Zitadel remains the long-term identity provider for Mkety. This access-code launch path does not remove Zitadel from the full Mkety architecture. It only avoids forcing Trading Enterprise customers through manual Zitadel setup during the first launch.

Later, Trading can replace local access-code bearers with Mkety Auth Gateway assertions while preserving the same Trading-owned workspace, membership, source, account, hostname, and execution safety tables.

## Launch rule

Trading may be preflight-tested and demo-tested through this access-code path. Public launch still requires green tests, safe staging deployment, real frontend validation by the owner, and explicit approval before merge/promotion.
