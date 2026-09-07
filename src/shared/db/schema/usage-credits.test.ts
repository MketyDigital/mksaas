import { getTableConfig } from 'drizzle-orm/pg-core';

import { billingPlanVersionCreditAllowances } from './billing-plan-version-credit-allowances';
import { creditLedgerEntries, creditLedgerEntryTypeEnum } from './credit-ledger-entries';
import { tenantCreditAccounts } from './tenant-credit-accounts';
import { usageEvents } from './usage-events';

function indexNames(table: Parameters<typeof getTableConfig>[0]) {
  return getTableConfig(table).indexes.map((index) => index.config.name);
}

describe('usage credits persistence schema', () => {
  it('stores immutable plan-version credit allowances', () => {
    expect(billingPlanVersionCreditAllowances.planVersionId).toBeDefined();
    expect(billingPlanVersionCreditAllowances.creditAmount).toBeDefined();
    expect(billingPlanVersionCreditAllowances.grantInterval).toBeDefined();
    expect(indexNames(billingPlanVersionCreditAllowances)).toContain(
      'billing_plan_version_credit_allowances_plan_version_interval_idx',
    );
  });

  it('stores one tenant credit balance projection with bigint counters', () => {
    expect(tenantCreditAccounts.tenantId).toBeDefined();
    expect(tenantCreditAccounts.availableCredits.dataType).toBe('bigint');
    expect(tenantCreditAccounts.lifetimeGranted.dataType).toBe('bigint');
    expect(tenantCreditAccounts.lifetimeConsumed.dataType).toBe('bigint');
  });

  it('stores immutable tenant-scoped usage with unique idempotency', () => {
    expect(usageEvents.tenantId).toBeDefined();
    expect(usageEvents.meterKey).toBeDefined();
    expect(usageEvents.quantity.dataType).toBe('bigint');
    expect(usageEvents.creditsCharged.dataType).toBe('bigint');
    expect(usageEvents.projectId).toBeDefined();
    expect(usageEvents.workspaceKey).toBeDefined();
    expect(indexNames(usageEvents)).toEqual(
      expect.arrayContaining([
        'usage_events_tenant_idempotency_idx',
        'usage_events_tenant_meter_occurred_idx',
      ]),
    );
  });

  it('stores append-only credit ledger movements with audit context', () => {
    expect(creditLedgerEntries.tenantId).toBeDefined();
    expect(creditLedgerEntries.delta.dataType).toBe('bigint');
    expect(creditLedgerEntries.billingPeriodId).toBeDefined();
    expect(creditLedgerEntries.usageEventId).toBeDefined();
    expect(creditLedgerEntries.actorUserId).toBeDefined();
    expect(indexNames(creditLedgerEntries)).toContain('credit_ledger_entries_tenant_idempotency_idx');
    expect(creditLedgerEntryTypeEnum.enumValues).toEqual([
      'period_grant',
      'usage',
      'manual_grant',
      'manual_debit',
      'adjustment',
    ]);
  });
});
