import { and, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '@/shared/db';
import { billingPeriods } from '@/shared/db/schema/billing-periods';
import { billingPlanVersionCreditAllowances } from '@/shared/db/schema/billing-plan-version-credit-allowances';
import { billingSubscriptions } from '@/shared/db/schema/billing-subscriptions';
import {
  creditLedgerEntries,
  type CreditLedgerEntry,
} from '@/shared/db/schema/credit-ledger-entries';
import {
  tenantCreditAccounts,
  type TenantCreditAccount,
} from '@/shared/db/schema/tenant-credit-accounts';
import { usageEvents, type UsageEvent } from '@/shared/db/schema/usage-events';

import { isUsageMeterKey } from '../meter-keys';
import {
  USAGE_CREDIT_ERROR_CODES,
  UsageCreditError,
  type CreditBalance,
} from '../types';
import type { BillingCreditAllowanceSource } from './period-grants';
import type {
  CreditLedgerRecord,
  StoredUsageRecord,
  UsageCreditSource,
  UsageCreditTransaction,
} from './source';

const QUALIFYING_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'paused',
  'cancel_at_period_end',
] as const;

function mapBalance(row: TenantCreditAccount): CreditBalance {
  return {
    tenantId: row.tenantId,
    availableCredits: row.availableCredits,
    lifetimeGranted: row.lifetimeGranted,
    lifetimeConsumed: row.lifetimeConsumed,
  };
}

function mapLedger(row: CreditLedgerEntry): CreditLedgerRecord {
  return {
    id: row.id,
    tenantId: row.tenantId,
    delta: row.delta,
    entryType: row.entryType,
    source: row.source,
    billingPeriodId: row.billingPeriodId,
    usageEventId: row.usageEventId,
    idempotencyKey: row.idempotencyKey,
    reason: row.reason,
    actorUserId: row.actorUserId,
  };
}

function mapUsage(row: UsageEvent): StoredUsageRecord {
  if (!isUsageMeterKey(row.meterKey)) {
    throw new UsageCreditError(
      USAGE_CREDIT_ERROR_CODES.unknownMeter,
      'Stored usage contains an unknown meter.',
    );
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    meterKey: row.meterKey,
    quantity: row.quantity,
    creditsCharged: row.creditsCharged,
    idempotencyKey: row.idempotencyKey,
    projectId: row.projectId,
    workspaceKey: row.workspaceKey,
    source: row.source,
    occurredAt: row.occurredAt,
  };
}

export const drizzleBillingCreditAllowanceSource: BillingCreditAllowanceSource = {
  async getCurrentBillingCreditAllowance(tenantId) {
    const [subscription] = await db
      .select({
        id: billingSubscriptions.id,
        planVersionId: billingSubscriptions.planVersionId,
      })
      .from(billingSubscriptions)
      .where(
        and(
          eq(billingSubscriptions.tenantId, tenantId),
          inArray(billingSubscriptions.status, [...QUALIFYING_SUBSCRIPTION_STATUSES]),
        ),
      )
      .orderBy(desc(billingSubscriptions.updatedAt))
      .limit(1);

    if (!subscription) return null;

    const [period] = await db
      .select({ id: billingPeriods.id })
      .from(billingPeriods)
      .where(
        and(
          eq(billingPeriods.tenantId, tenantId),
          eq(billingPeriods.subscriptionId, subscription.id),
        ),
      )
      .orderBy(desc(billingPeriods.periodStart))
      .limit(1);

    if (!period) return null;

    const [allowance] = await db
      .select({
        id: billingPlanVersionCreditAllowances.id,
        creditAmount: billingPlanVersionCreditAllowances.creditAmount,
      })
      .from(billingPlanVersionCreditAllowances)
      .where(
        and(
          eq(billingPlanVersionCreditAllowances.planVersionId, subscription.planVersionId),
          eq(billingPlanVersionCreditAllowances.grantInterval, 'billing_period'),
        ),
      )
      .limit(1);

    if (!allowance) return null;

    return {
      billingPeriodId: period.id,
      planVersionId: subscription.planVersionId,
      allowanceId: allowance.id,
      credits: allowance.creditAmount,
    };
  },
};

export const drizzleUsageCreditSource: UsageCreditSource = {
  transaction<T>(work: (tx: UsageCreditTransaction) => Promise<T>): Promise<T> {
    return db.transaction(async (databaseTx) => {
      const tx: UsageCreditTransaction = {
        async findLedgerByIdempotency(tenantId, idempotencyKey) {
          const [row] = await databaseTx
            .select()
            .from(creditLedgerEntries)
            .where(
              and(
                eq(creditLedgerEntries.tenantId, tenantId),
                eq(creditLedgerEntries.idempotencyKey, idempotencyKey),
              ),
            )
            .limit(1);
          return row ? mapLedger(row) : null;
        },

        async findUsageByIdempotency(tenantId, idempotencyKey) {
          const [row] = await databaseTx
            .select()
            .from(usageEvents)
            .where(
              and(
                eq(usageEvents.tenantId, tenantId),
                eq(usageEvents.idempotencyKey, idempotencyKey),
              ),
            )
            .limit(1);
          return row ? mapUsage(row) : null;
        },

        async getCreditBalance(tenantId) {
          const [row] = await databaseTx
            .select()
            .from(tenantCreditAccounts)
            .where(eq(tenantCreditAccounts.tenantId, tenantId))
            .limit(1);
          return row ? mapBalance(row) : null;
        },

        async applyGrant(tenantId, credits) {
          const now = new Date();
          const [row] = await databaseTx
            .insert(tenantCreditAccounts)
            .values({
              tenantId,
              availableCredits: credits,
              lifetimeGranted: credits,
              lifetimeConsumed: 0n,
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: tenantCreditAccounts.tenantId,
              set: {
                availableCredits: sql`${tenantCreditAccounts.availableCredits} + ${credits}`,
                lifetimeGranted: sql`${tenantCreditAccounts.lifetimeGranted} + ${credits}`,
                updatedAt: now,
              },
            })
            .returning();
          if (!row) throw new Error('Credit account grant did not return a row.');
          return mapBalance(row);
        },

        async applyDebit(tenantId, credits) {
          const [row] = await databaseTx
            .update(tenantCreditAccounts)
            .set({
              availableCredits: sql`${tenantCreditAccounts.availableCredits} - ${credits}`,
              lifetimeConsumed: sql`${tenantCreditAccounts.lifetimeConsumed} + ${credits}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(tenantCreditAccounts.tenantId, tenantId),
                sql`${tenantCreditAccounts.availableCredits} >= ${credits}`,
              ),
            )
            .returning();
          return row ? mapBalance(row) : null;
        },

        async insertUsage(input) {
          const [row] = await databaseTx.insert(usageEvents).values(input).returning();
          if (!row) throw new Error('Usage insert did not return a row.');
          return mapUsage(row);
        },

        async insertLedger(input) {
          const [row] = await databaseTx.insert(creditLedgerEntries).values(input).returning();
          if (!row) throw new Error('Credit ledger insert did not return a row.');
          return mapLedger(row);
        },
      };

      return work(tx);
    });
  },

  async getCreditBalance(tenantId) {
    const [row] = await db
      .select()
      .from(tenantCreditAccounts)
      .where(eq(tenantCreditAccounts.tenantId, tenantId))
      .limit(1);
    return row ? mapBalance(row) : null;
  },

  async getTenantUsage(tenantId) {
    const rows = await db
      .select()
      .from(usageEvents)
      .where(eq(usageEvents.tenantId, tenantId))
      .orderBy(desc(usageEvents.occurredAt), desc(usageEvents.createdAt));
    return rows.map(mapUsage);
  },

  async getCreditLedger(tenantId) {
    const rows = await db
      .select()
      .from(creditLedgerEntries)
      .where(eq(creditLedgerEntries.tenantId, tenantId))
      .orderBy(desc(creditLedgerEntries.createdAt));
    return rows.map(mapLedger);
  },
};
