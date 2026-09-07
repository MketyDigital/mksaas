# Mkety Entitlements Core Design

**Status:** Approved 2026-09-07

## Goal

Introduce a backend-authoritative entitlement layer between Billing and feature access without changing verified Billing behavior or mixing Usage/Credits into this phase.

## Architecture

```text
Billing Plan
  -> Billing Plan Version
  -> Plan-Version Entitlements
  -> Effective Tenant Entitlements
  -> Server Authorization
  -> Workspace / Project / Feature Access
```

Application code MUST use stable entitlement keys and MUST NOT branch on mutable commercial plan names such as `if plan === "pro"`.

## Core model

### Stable entitlement keys

Entitlement keys are product capability identifiers, for example:

- `workspace.agents`
- `workspace.workflows`
- `workspace.knowledge`
- `workspace.integrations`
- `workspace.trading.enterprise`
- `ai.provider.gemini`
- `ai.provider.anthropic`

Unknown keys fail closed.

### Plan-version assignments

Entitlements attach to `billing_plan_versions`, not directly to a plan slug. This preserves the commercial contract of an existing subscription when later plan versions change.

Required relation:

```text
billing_plan_version_entitlements
- id
- plan_version_id
- entitlement_key
- enabled
- created_at
```

The pair `(plan_version_id, entitlement_key)` is unique.

### Tenant overrides

Exceptional grants and revocations are represented separately from Billing:

```text
tenant_entitlement_overrides
- id
- tenant_id
- entitlement_key
- effect: grant | deny
- reason
- source
- expires_at
- created_by
- created_at
```

The effective resolver ignores expired overrides.

### Resolution precedence

Fail closed with this precedence:

1. active tenant `deny`
2. active tenant `grant`
3. enabled entitlement attached to the tenant's qualifying plan version
4. deny

An override for one tenant MUST never affect another tenant.

## Server interfaces

The entitlement subsystem exposes backend-only helpers conceptually equivalent to:

```ts
getTenantEntitlements(tenantId)
hasEntitlement({ tenantId, entitlement })
requireEntitlement({ tenantId, entitlement })
```

`requireEntitlement` is the authorization boundary for protected operations. Frontend visibility may consume entitlement decisions for UX, but hidden UI or client-side plan checks are never security controls.

## Subscription qualification

The resolver reads the tenant's effective Billing subscription and its `planVersionId`. A tenant with no qualifying subscription is denied unless an active tenant grant applies. Existing Billing provider behavior remains untouched.

## Scope boundary

This phase does NOT implement Credits, Usage, Wallet, quota counters, payment-provider logic, frontend-only enforcement, or a general event-sourced entitlement ledger.

Entitlements answer **whether a tenant can use a capability**. Usage/Credits will separately answer **how much has been consumed/remains and whether a metered operation can be charged**.

## Existing integration seam

Platform workspace definitions already support `requiresEntitlement`, including `workspace.trading.enterprise`. The first integration should use that stable key path while preserving backend authority.

## Verification requirements

At minimum verify:

- plan grant -> allow
- missing plan grant -> deny
- tenant grant over missing plan -> allow
- tenant deny over plan grant -> deny
- expired override ignored
- cross-tenant isolation
- unknown entitlement -> deny
- no qualifying subscription -> deny unless explicit active grant
- plan-version change resolves only the subscribed version
- migrations are deterministic and forward-clean
- targeted tests, full tests, type-check, lint, migration check, production build and Cloudflare dry-run remain green

## Do-not-do constraints

- Do not modify Billing provider behavior on the verified Billing branch.
- Do not couple entitlements to Selar/NOWPayments.
- Do not infer access from plan slug/name.
- Do not make navigation filtering the enforcement mechanism.
- Do not add Usage/Credits in this PR.
- Do not promote stacked PRs out of Auth -> Webhooks -> Billing order.