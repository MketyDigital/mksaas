# Mkety Entitlements — Development Handoff / Progress

**Date:** 2026-09-07  
**Branch:** `feat/mkety-entitlements-core`  
**Base:** `feat/mkety-billing-core-foundation` (`4525104661208d669719e00766b15bc7b187f1d7`)  
**PR:** #22 — draft, stacked directly on Billing #21

## Approved architecture

The approved design is documented at:

- `docs/superpowers/specs/2026-09-07-mkety-entitlements-core-design.md`
- `docs/superpowers/plans/2026-09-07-mkety-entitlements-core.md`

Entitlements resolve through:

```text
Billing Plan Version
  -> Plan-Version Entitlements
  -> Tenant Overrides
  -> Effective Tenant Entitlements
  -> Backend Authorization
  -> Workspace / Project / Feature access
```

Resolution precedence is:

1. active tenant deny
2. active tenant grant
3. enabled current plan-version entitlement
4. deny by default

Unknown entitlement keys fail closed. Usage/Credits remains explicitly out of scope and is the next architecture phase only after Entitlements verification.

## Implementation completed so far

### Stable entitlement vocabulary

Added:

- `src/features/entitlements/entitlement-keys.ts`
- `src/features/entitlements/types.ts`
- `src/features/entitlements/entitlement-keys.test.ts`

Current canonical keys include the existing `workspace.trading.enterprise` seam plus initial workspace and AI-provider capabilities. Runtime unknown keys are rejected.

### Persistence schema

Added:

- `src/shared/db/schema/billing-plan-version-entitlements.ts`
- `src/shared/db/schema/tenant-entitlement-overrides.ts`
- `src/shared/db/schema/entitlements.test.ts`
- schema exports in `src/shared/db/schema/index.ts`

Plan entitlements attach to immutable Billing plan-version IDs. Tenant overrides are isolated from Billing commercial/provider state and carry effect, reason, source, optional expiry and optional actor user.

### Effective resolver

Added:

- `src/features/entitlements/server/resolver.ts`
- `src/features/entitlements/server/drizzle-source.ts`
- `src/features/entitlements/server/resolver.test.ts`

The resolver:

- uses the tenant's latest qualifying Billing subscription
- reads only that subscription's `planVersionId`
- loads tenant overrides by explicit tenant ID
- applies `deny > grant > plan > default deny`
- ignores expired overrides
- permits an explicit active tenant grant even when there is no qualifying subscription
- fails closed for unknown entitlement keys before storage access
- keeps tenant reads tenant-scoped

Qualifying subscription statuses intentionally match Billing's existing current-state query semantics: `trialing`, `active`, `past_due`, `paused`, `cancel_at_period_end`.

### Backend enforcement helper

Added:

- `src/features/entitlements/server/authorization.ts`
- `src/features/entitlements/server/authorization.test.ts`

`requireEntitlement` delegates to the authoritative resolver and throws the stable `EntitlementDeniedError` when access is denied.

### Existing workspace seam

Added:

- `src/features/entitlements/server/workspace-access.ts`
- `src/features/entitlements/server/workspace-access.test.ts`
- `getPublishedWorkspaceCardsForTenant(tenantId)` in `src/features/platform-app-experience/server/queries.ts`

This integrates the existing `requiresEntitlement` field with backend resolution. The global published workspace query remains unchanged. Navigation filtering is UX only and does not replace operation-level `requireEntitlement` enforcement.

## TDD / verification state

Tests were authored before their corresponding implementation files for the entitlement vocabulary, persistence contract, resolver, authorization helper and workspace filtering.

A normal checkout is not available in the current tool runtime, so local Jest/TypeScript execution is unavailable. Standard repository PR workflows also do not execute for this stacked draft PR because they target `main` and/or non-draft PRs. Therefore no test or build result is being claimed without GitHub Actions evidence.

## Migration generation

The repository's migration baseline requires all three Drizzle outputs to stay aligned:

- SQL migration
- `meta/_journal.json`
- latest generated snapshot

The snapshot is large and MUST NOT be hand-authored. A temporary branch-only workflow has been added:

- `.github/workflows/_entitlements-generate-migration.yml`

It runs real `pnpm db:generate` from the Entitlements schema and uploads the generated `0012` SQL, snapshot and journal as an artifact. Once captured into the branch, the temporary generator workflow should be removed before immutable final verification.

Generation run started as GitHub Actions run `34155312274` from commit `a8b3c9d60eb2d11f944a5aa8d5772d4d9fe59aca`.

## Do-not-do constraints still active

- Do not modify verified Billing provider behavior.
- Do not alter Auth -> Webhooks -> Billing promotion order.
- Do not couple Entitlements to Selar or NOWPayments.
- Do not branch application behavior on Billing plan names/slugs.
- Do not make frontend visibility the security boundary.
- Do not add Usage/Credits, Wallet or quota accounting in PR #22.
- Do not hand-author Drizzle snapshot state.
- Keep PR #22 draft until generated migration and full immutable verification are clean.

## Exact next steps

1. Collect the generated Drizzle migration artifact from run `34155312274` and commit exact generated SQL/snapshot/journal.
2. Remove the temporary migration-generation workflow.
3. Run targeted Entitlements tests and fix only evidence-backed failures.
4. Run full tests, type-check, lint, migration baseline, `drizzle-kit check`, forward-generation no-op, vinext check, production build and Cloudflare dry-run.
5. Record the immutable verified Entitlements SHA and verification run in this document.
6. Keep PR #22 draft/stacked until Auth -> Webhooks -> Billing promotion gates are satisfied.
7. After Entitlements is verified, begin Usage/Credits architecture — not implementation before design approval.
