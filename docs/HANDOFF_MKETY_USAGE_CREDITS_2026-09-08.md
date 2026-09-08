# Mkety Usage/Credits Core Handoff

Date: 2026-09-08
Branch: `feat/mkety-usage-credits-core`
Base: `feat/mkety-entitlements-core`

## Status

Tasks 1-6 of the approved Usage/Credits implementation plan are complete. Task 7 migration generation is in progress. Task 8 immutable verification, draft PR finalization, and cleanup remain.

## Completed Architecture

Entitlements remains the capability gate. Usage/Credits is a separate tenant-scoped product-metering subsystem:

`Entitlement -> Usage meter -> Credit mutation -> Expensive operation`

Recurring credits derive from Mkety Billing plan-version/current-period state. Product credits do not reuse the financial Billing ledger and do not depend on payment-provider webhooks.

## Implemented Scope

- Stable meter vocabulary with bigint-oriented domain types and safe errors.
- `billing_plan_version_credit_allowances` persistence.
- `tenant_credit_accounts` concurrency-safe balance projection.
- Immutable `usage_events`.
- Append-only `credit_ledger_entries`.
- Pure amount/meter/idempotency validation engine.
- Transactional `grantCredits`, `consumeCredits`, `recordUsage`, balance, usage, and ledger reads.
- Tenant-scoped idempotency and conflicting-key rejection.
- Concurrent debit protection so balances cannot be spent twice.
- Billing-period recurring grants with deterministic period idempotency.
- One production enforcement seam: automation workflow execution.

## Workflow Metering Seam

`executeAutomationWorkflowRun` now composes:

1. create durable workflow run;
2. `requireEntitlement({ entitlement: 'workspace.workflows' })`;
3. consume exactly `1n` credit using meter `workflow.execution`;
4. idempotency key `workflow-run:<run-id>:execution`;
5. only then execute the workflow definition.

Entitlement or credit failure prevents expensive execution and marks the durable run failed through the existing lifecycle.

## TDD Evidence

- Task 1 RED proved missing meter module; GREEN passed targeted tests.
- Task 2 RED proved missing persistence module; GREEN passed schema tests.
- Task 3 RED proved missing engine; GREEN passed mutation-rule tests.
- Task 4 RED proved missing service; GREEN passed transactional service, concurrency, and type-check coverage.
- Standalone `recordUsage` RED proved missing API; GREEN passed on run `34170570120`.
- Task 5 RED proved missing period-grant module; GREEN run `34170788272` passed tests and type-check.
- Task 6 RED run `34170908857`: 27 existing tests passed and exactly 3 new enforcement tests failed because Entitlements/Credits were not wired.
- Task 6 GREEN run `34171942090`: targeted Usage/Credits + workflow enforcement tests and full type-check passed.

## Current Task 7

Temporary workflow `.github/workflows/_usage-credits-generate-migration.yml` is generating the real Drizzle migration and committing generated SQL/snapshot/journal back to this branch. The migration snapshot must never be hand-authored.

After generation:

- inspect SQL for only the four approved Usage/Credits tables/indexes/FKs;
- run `pnpm db:check:migrations`;
- run `pnpm exec drizzle-kit check`;
- run forward `pnpm db:generate` and require a no-op;
- proceed to full immutable verifier.

## Remaining Boundaries / Do Not Do

- No purchased credit packs.
- No real-money wallet or financial-ledger reuse.
- No overage billing or provider-cost accounting.
- No reservation/refund subsystem in this core slice.
- No expiry buckets or tiered metering.
- No broad UI/dashboard work.
- No Selar/NOWPayments coupling.
- Do not scatter plan-name checks; Entitlements remains the capability authority.
