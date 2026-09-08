# Mkety Usage/Credits Core Handoff

Date: 2026-09-08
Branch: `feat/mkety-usage-credits-core`
Base: `feat/mkety-entitlements-core`

## Status

Tasks 1-8 of the approved Usage/Credits implementation plan are complete. The feature is implemented, migrated, immutably verified, cleaned of temporary verification workflows, documented, and ready as a stacked draft PR.

## Completed Architecture

Entitlements remains the capability gate. Usage/Credits is a separate tenant-scoped product-metering subsystem:

`Entitlement -> Usage meter -> Credit mutation -> Expensive operation`

Recurring credits derive from Mkety Billing plan-version/current-period state. Product credits do not reuse the financial Billing ledger and do not depend on payment-provider webhooks.

## Implemented Scope

- Stable meter vocabulary:
  - `ai.tokens`
  - `ai.input_tokens`
  - `ai.output_tokens`
  - `agent.run`
  - `workflow.execution`
  - `automation.run`
  - `knowledge.query`
- Bigint-oriented domain quantities and safe typed errors.
- `billing_plan_version_credit_allowances` persistence.
- `tenant_credit_accounts` concurrency-safe balance projection.
- Immutable `usage_events`.
- Append-only `credit_ledger_entries`.
- Pure amount/meter/idempotency validation engine.
- Transactional `grantCredits`, `consumeCredits`, `recordUsage`, balance, usage, and ledger reads.
- Tenant-scoped idempotency and conflicting-key rejection.
- Conditional debit protection so concurrent operations cannot spend the same remaining credits twice.
- Billing-period recurring grants with deterministic period idempotency.
- One production enforcement seam: automation workflow execution.

## Workflow Metering Seam

`executeAutomationWorkflowRun` now composes:

1. create durable workflow run;
2. `requireEntitlement({ entitlement: 'workspace.workflows' })`;
3. consume exactly `1n` credit using meter `workflow.execution`;
4. use idempotency key `workflow-run:<run-id>:execution`;
5. only then execute the workflow definition.

Entitlement or credit failure prevents expensive execution and marks the durable run failed through the existing lifecycle.

## Generated Migration

Drizzle generated:

- `src/shared/db/migrations/0013_lively_magma.sql`
- `src/shared/db/migrations/meta/0013_snapshot.json`
- matching migration journal update

The snapshot was never hand-authored.

The generated migration was inspected and contains only the approved Usage/Credits enum/tables, foreign keys, tenant/idempotency constraints, and indexes.

### Migration-generation debugging

The first generator run `34171991880` failed because Drizzle Kit attempted to JSON-serialize raw bigint schema defaults (`0n`). The schema was corrected to use SQL defaults (`sql\`0\``), preserving bigint database semantics while making Drizzle metadata serializable. Generation then succeeded on run `34172101035`, producing migration commit `73529dc976a876a13bb608e242a683073038d280`.

## TDD Evidence

- Task 1 RED proved the meter module was missing; GREEN passed targeted tests.
- Task 2 RED proved persistence modules were missing; GREEN passed schema tests.
- Task 3 RED proved the mutation engine was missing; GREEN passed mutation-rule tests.
- Task 4 RED proved the service was missing; GREEN passed transactional service, concurrency, and type-check coverage.
- Standalone `recordUsage` RED proved the API was missing; GREEN passed on run `34170570120`.
- Task 5 RED proved the period-grant module was missing; GREEN run `34170788272` passed tests and type-check.
- Task 6 RED run `34170908857`: 27 existing tests passed and exactly 3 new enforcement tests failed because Entitlements/Credits were not wired.
- Task 6 GREEN run `34171942090`: targeted Usage/Credits + workflow enforcement tests and full type-check passed.

## Immutable Verification

Final immutable application SHA:

`7c3b074dfead6d3eb5af6caaccf612782c8c3431`

Final verifier run:

`34172534130`

All verification gates passed:

- targeted Usage/Credits + workflow seam tests — PASS
- full Jest suite — PASS: 113 suites / 618 tests
- type-check — PASS
- lint — PASS
- `pnpm db:check:migrations` — PASS
- `pnpm exec drizzle-kit check` — PASS
- forward `pnpm db:generate` no-op — PASS
- `pnpm vinext check` — PASS
- production build — PASS
- Cloudflare preview dry-run — PASS
- immutable SHA proof and clean diff — PASS

### Verification debugging

The first immutable verifier run `34172196552` passed targeted tests, full Jest, and type-check, then found five new `sort-imports` errors. Only import ordering was changed. A second run exposed one remaining member-order detail in `credit-ledger-entries`; the final import-only fix produced immutable application SHA `7c3b074dfead6d3eb5af6caaccf612782c8c3431`. No runtime behavior or migration changed during these lint fixes.

## Cleanup

Temporary workflows used for TDD, migration generation, and immutable verification were removed after evidence was captured. Cleanup does not alter application behavior. The final branch head will therefore be later than the immutable application SHA; the immutable SHA above remains the application-verification authority.

## Stack / Promotion Order

1. Auth PR #16
2. Webhooks PR #15
3. Billing PR #21
4. Entitlements PR #22
5. Usage/Credits PR from `feat/mkety-usage-credits-core`

Keep Usage/Credits stacked on `feat/mkety-entitlements-core` until the upstream chain is promoted/rebased in order.

## Remaining Boundaries / Do Not Do

- No purchased credit packs.
- No real-money wallet or financial-ledger reuse.
- No overage billing or provider-cost accounting.
- No reservation/refund subsystem in this core slice.
- No expiry buckets or tiered metering.
- No broad UI/dashboard work.
- No Selar/NOWPayments coupling.
- Do not scatter plan-name checks; Entitlements remains the capability authority.
