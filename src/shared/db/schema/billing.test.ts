import { getTableConfig } from 'drizzle-orm/pg-core';

import { billingCheckouts } from './billing-checkouts';
import { billingLedgerEntries } from './billing-ledger-entries';
import { billingManualAdjustments } from './billing-manual-adjustments';
import { billingPeriods } from './billing-periods';
import { billingPlanVersions } from './billing-plan-versions';
import { billingPlans } from './billing-plans';
import { billingRenewalAttempts } from './billing-renewal-attempts';
import { billingSettlements } from './billing-settlements';
import { billingSubscriptions } from './billing-subscriptions';

const columns = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).columns.map((column) => column.name);

const indexes = (table: Parameters<typeof getTableConfig>[0]) =>
  getTableConfig(table).indexes.map((index) => index.config.name);

describe('Mkety billing persistence schema', () => {
  it('defines stable plans and immutable versioned commercial terms', () => {
    expect(columns(billingPlans)).toEqual(
      expect.arrayContaining(['id', 'key', 'name', 'status', 'created_at', 'updated_at']),
    );
    expect(indexes(billingPlans)).toContain('billing_plans_key_idx');

    expect(columns(billingPlanVersions)).toEqual(
      expect.arrayContaining([
        'id',
        'plan_id',
        'version',
        'amount_minor',
        'currency',
        'billing_interval',
        'effective_from',
        'effective_to',
      ]),
    );
    expect(indexes(billingPlanVersions)).toContain('billing_plan_versions_plan_version_idx');
    expect(columns(billingPlanVersions)).not.toContain('amount');
  });

  it('defines tenant-scoped subscription, period and renewal state', () => {
    expect(columns(billingSubscriptions)).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'plan_version_id',
        'status',
        'renewal_mode',
        'auto_renew',
        'current_period_start',
        'current_period_end',
        'grace_period_end',
      ]),
    );
    expect(indexes(billingSubscriptions)).toContain('billing_subscriptions_tenant_idx');

    expect(columns(billingPeriods)).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'subscription_id',
        'period_start',
        'period_end',
        'amount_due_minor',
        'currency',
        'collection_status',
      ]),
    );
    expect(columns(billingRenewalAttempts)).toEqual(
      expect.arrayContaining(['id', 'tenant_id', 'subscription_id', 'billing_period_id', 'mode', 'status']),
    );
  });

  it('defines provider-facing checkout and idempotent settlement identities', () => {
    expect(columns(billingCheckouts)).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'subscription_id',
        'billing_period_id',
        'provider',
        'provider_checkout_id',
        'amount_expected_minor',
        'currency',
        'status',
      ]),
    );

    expect(columns(billingSettlements)).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'subscription_id',
        'billing_period_id',
        'provider',
        'provider_payment_id',
        'provider_event_id',
        'settlement_type',
        'amount_expected_minor',
        'amount_paid_minor',
        'currency_expected',
        'currency_paid',
        'status',
      ]),
    );
    expect(indexes(billingSettlements)).toEqual(
      expect.arrayContaining([
        'billing_settlements_provider_event_idx',
        'billing_settlements_provider_payment_type_idx',
      ]),
    );
  });

  it('defines append-only ledger and audited manual adjustment records', () => {
    expect(columns(billingLedgerEntries)).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'subscription_id',
        'billing_period_id',
        'settlement_id',
        'entry_type',
        'amount_minor',
        'currency',
        'reversal_of_entry_id',
        'created_at',
      ]),
    );
    expect(columns(billingLedgerEntries)).not.toEqual(expect.arrayContaining(['updated_at', 'deleted_at']));

    expect(columns(billingManualAdjustments)).toEqual(
      expect.arrayContaining([
        'id',
        'tenant_id',
        'actor_user_id',
        'idempotency_key',
        'adjustment_type',
        'amount_minor',
        'currency',
        'reason',
      ]),
    );
    expect(indexes(billingManualAdjustments)).toContain('billing_manual_adjustments_idempotency_idx');
  });
});