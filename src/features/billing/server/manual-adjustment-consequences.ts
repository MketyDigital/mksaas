import { and, eq } from 'drizzle-orm';

import type { Database } from '@/shared/db';
import { billingPeriods, billingSubscriptions } from '@/shared/db/schema';

import type { ManualAdjustmentCommand } from './manual-adjustment-service';

type BillingTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function applyManualAdjustmentConsequences(
  tx: BillingTransaction,
  command: ManualAdjustmentCommand,
): Promise<void> {
  if (
    (command.adjustmentType !== 'payment' && command.adjustmentType !== 'waiver') ||
    !command.billingPeriodId ||
    !command.subscriptionId
  ) {
    return;
  }

  const period = await tx.query.billingPeriods.findFirst({
    columns: {
      id: true,
      tenantId: true,
      subscriptionId: true,
      amountDueMinor: true,
      currency: true,
    },
    where: and(
      eq(billingPeriods.id, command.billingPeriodId),
      eq(billingPeriods.tenantId, command.tenantId),
      eq(billingPeriods.subscriptionId, command.subscriptionId),
    ),
  });

  if (!period) {
    throw new Error('Manual adjustment billing period does not match current tenant/subscription state.');
  }
  if (period.currency !== command.currency) {
    throw new Error('Manual adjustment currency does not match authoritative billing period currency.');
  }
  if (command.amountMinor < period.amountDueMinor) return;

  const now = new Date();
  await tx
    .update(billingPeriods)
    .set({
      collectionStatus: command.adjustmentType === 'waiver' ? 'waived' : 'paid',
      updatedAt: now,
    })
    .where(and(eq(billingPeriods.id, period.id), eq(billingPeriods.tenantId, command.tenantId)));

  const subscription = await tx.query.billingSubscriptions.findFirst({
    columns: { id: true, tenantId: true, status: true },
    where: and(
      eq(billingSubscriptions.id, command.subscriptionId),
      eq(billingSubscriptions.tenantId, command.tenantId),
    ),
  });

  if (subscription?.status === 'past_due') {
    await tx
      .update(billingSubscriptions)
      .set({ status: 'active', gracePeriodEnd: null, updatedAt: now })
      .where(
        and(
          eq(billingSubscriptions.id, subscription.id),
          eq(billingSubscriptions.tenantId, command.tenantId),
          eq(billingSubscriptions.status, 'past_due'),
        ),
      );
  }
}
