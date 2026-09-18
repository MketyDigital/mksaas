# Mkety Entitlements — Verified Development Handoff

**Date:** 2026-09-07  
**Branch:** `feat/mkety-entitlements-core`  
**Base:** `feat/mkety-billing-core-foundation` (`4525104661208d669719e00766b15bc7b187f1d7`)  
**PR:** #22 — draft, stacked directly on Billing #21

## Status

Entitlements Core implementation is complete and immutably verified.

**Immutable verified Entitlements SHA:** `6b98e65016c6bf66d60c6210e9852bdee712b579`  
**Final verification run:** `34155879992`

The branch moved after the verified SHA only for verification-workflow cleanup and this handoff documentation. No Entitlements application behavior changed after the verified SHA.

## Approved architecture

Design: `docs/superpowers/specs/2026-09-07-mkety-entitlements-core-design.md`  
Implementation plan: `docs/superpowers/plans/2026-09-07-mkety-entitlements-core.md`

```text
Billing Plan Version
  -> Plan-Version Entitlements
  -> Tenant Overrides
  -> Effective Tenant Entitlements
  -> Backend Authorization
  -> Workspace / Project / Feature access
```

Resolution precedence:

1. active tenant deny
2. active tenant grant
3. enabled current plan-version entitlement
4. deny by default

Unknown entitlement keys fail closed.

## Implemented

### Stable entitlement vocabulary

- `src/features/entitlements/entitlement-keys.ts`
- `src/features/entitlements/types.ts`
- `src/features/entitlements/entitlement-keys.test.ts`

Initial canonical capabilities include workspace keys, `workspace.trading.enterprise`, and initial AI provider capabilities. Runtime unknown keys are rejected.

### Persistence

- `src/shared/db/schema/billing-plan-version-entitlements.ts`
- `src/shared/db/schema/tenant-entitlement-overrides.ts`
- `src/shared/db/schema/entitlements.test.ts`
- exports in `src/shared/db/schema/index.ts`
- generated migration `src/shared/db/migrations/0012_nebulous_expediter.sql`
- generated `0012_snapshot.json` and aligned Drizzle journal

Plan grants attach to immutable Billing plan-version IDs. Tenant overrides are independent of provider/commercial Billing state and support grant/deny, reason, source, optional expiry and actor attribution.

The migration was produced by real `drizzle-kit generate`; the large snapshot was not hand-authored. Temporary migration-generation workflow was removed after generation.

### Effective resolver

- `src/features/entitlements/server/resolver.ts`
- `src/features/entitlements/server/drizzle-source.ts`
- `src/features/entitlements/server/resolver.test.ts`

The resolver:

- uses the tenant's latest qualifying Billing subscription
- resolves only its `planVersionId`
- keeps all override reads tenant-scoped
- applies `deny > grant > plan > default deny`
- ignores expired overrides
- allows an explicit active grant without a qualifying subscription
- rejects unknown entitlement keys before storage access

Qualifying subscription statuses intentionally match Billing's established current-state semantics: `trialing`, `active`, `past_due`, `paused`, `cancel_at_period_end`.

### Backend enforcement

- `src/features/entitlements/server/authorization.ts`
- `src/features/entitlements/server/authorization.test.ts`

`requireEntitlement` uses the authoritative resolver and throws stable `EntitlementDeniedError` on denial.

### Existing workspace seam

- `src/features/entitlements/server/workspace-access.ts`
- `src/features/entitlements/server/workspace-access.test.ts`
- `getPublishedWorkspaceCardsForTenant(tenantId)` in `src/features/platform-app-experience/server/queries.ts`

The existing `requiresEntitlement` metadata can now be resolved for a server-derived tenant. Global workspace content behavior remains intact. UI filtering remains UX only and does not replace operation-level backend enforcement.

## Verification evidence

Final immutable run `34155879992` at SHA `6b98e65016c6bf66d60c6210e9852bdee712b579` completed successfully:

- targeted Entitlements suites — PASS
- Platform workspace entitlement seam suites — PASS
- full Jest suite — PASS (`108` suites, `591` tests)
- TypeScript type-check — PASS
- lint — PASS with no errors
- migration baseline — PASS
- `drizzle-kit check` — PASS
- forward `drizzle-kit generate` no-op proof — PASS
- vinext compatibility check — PASS
- production build — PASS
- Cloudflare preview dry-run — PASS
- final immutable SHA/worktree check — PASS

An earlier verifier run `34155582613` correctly stopped at five new `sort-imports` errors after targeted tests, full tests and type-check had passed. The five failures were limited to Entitlements import-member ordering; only those import orders were changed. The complete verifier was then rerun from a new immutable SHA and passed.

## Stack / promotion rules

Do not bypass the existing promotion sequence:

1. finish real Auth preview and promote Auth #16
2. refresh/reverify and promote Webhooks #15
3. refresh/reverify and promote Billing #21
4. refresh/reverify Entitlements #22 against the promoted Billing base before promotion

PR #22 should remain draft until its upstream stack gates are satisfied.

## Do-not-do constraints

- Do not modify verified Billing provider behavior as part of Entitlements.
- Do not couple Entitlements to Selar or NOWPayments.
- Do not branch feature access on commercial plan names/slugs.
- Do not trust frontend visibility as authorization.
- Do not add Usage/Credits, Wallet or quota accounting into PR #22.
- Do not hand-author Drizzle snapshots.

## Next Platform development boundary

The next architecture phase is **Usage/Credits**.

Do not begin Usage/Credits implementation before its architecture is designed and approved. It must remain separate from Entitlements:

- Entitlements answer whether a tenant may use a capability.
- Usage/Credits answer how much is consumed/remaining and whether a metered operation may proceed or be charged.

Keep the isolated frontend preview available while Platform development continues.