# Enterprise Production Hardening Implementation Plan

> Use superpowers:executing-plans for native implementation and requesting-code-review before release.

**Goal:** Close reproduced Enterprise AI authorization, prepaid-cost and durable retry defects; verify current access/admin/customer contracts without claiming unexecuted production acceptance.

**Architecture:** Reuse the Platform Control guard and immutable billing records. Serialize managed cost admission per tenant in PostgreSQL, track conservative in-flight estimates on the existing request record, and fail closed around chargeable provider dispatch.

**Tech Stack:** TypeScript, Drizzle/Postgres, Cloudflare Workers, Jest, GitHub Actions.

**Spec:** `docs/handoffs/2026-09-30-final-platform-completion.md`.

## Constraints and review focus

- Customer admin wildcard permissions never authorize global plan writes.
- Explicit capacity rejection may retry; ambiguous outcomes and settlement/reply-persistence failures require reconciliation.
- Parallel requests cannot spend the same managed provider-cost envelope.
- Other product subscriptions cannot hide Enterprise commercial policy.
- Runtime gates remain closed until exact-SHA live/customer evidence passes.

## Tasks

- [x] Reproduce direct contract-action invocation by ordinary customer admin; call `requirePlatformControlAccess` before target lookup and retain `platform:plans` PBAC. Test unapproved operator, wrong tenant, and missing permission.
- [x] Reproduce scheduled retry after ambiguous outcome and reply persistence failure. Persist reconciliation state before provider dispatch, reopen retry only on the explicit capacity code, test timeout/lease recovery and safe retry.
- [x] Reproduce managed-cost policy bypass and period boundaries. Join the applicable Enterprise policy, use inclusive start/exclusive end, deny missing period, reserve conservative cost under a tenant transaction lock, preserve unknown-outcome estimates. Test overlapping admissions and exhausted capacity.
- [x] Inspect historical secret-scanner findings without exposing values; ignore only proved synthetic exact fingerprints. Add meaningful container health checks; document any required root bootstrap exception precisely.
- [ ] Run full tests/typecheck/lint/build/migration consistency, independent review, exact-head CI and connected candidate acceptance. Reconcile the current handoff with evidence and unresolved live gates.

## Dependency security continuation

The production-only lockfile audit found 96 advisory entries (3 critical, 42 high, 41 moderate, 10 low). Green existing release gates are insufficient while those findings remain. Update affected direct dependencies to their patched compatible release lines; apply version-range-scoped transitive overrides, preserving each major except the necessary patched Sharp 0.35 line. Keep the stable Vinext/Cloudflare/React route architecture. Verify the resolved production audit, complete source/script tests, editor and sanitizer behavior, real commercial queries, TypeScript and Cloudflare build. Add a blocking production dependency audit to CI so future lockfiles cannot silently reintroduce this debt.

- [x] Apply and review affected direct/transitive patches; prove the complete production/build/test advisory audit is clean.
- [ ] Rerun local and exact-head remote checks and reconcile any package compatibility failures.
