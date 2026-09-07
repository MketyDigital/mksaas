import { and, eq } from 'drizzle-orm';

import type { Database } from '@/shared/db';
import { billingLedgerEntries, billingManualAdjustments } from '@/shared/db/schema';

import type {
  ManualAdjustmentCommand,
  ManualAdjustmentDependencies,
} from './manual-adjustment-service';

type ManualAdjustmentDatabase = Pick<Database, 'transaction'>;

export type BillingPermissionResolver = (
  tenantSlug: string,
  permissionKey: string,
  userId: string,
) => Promise<boolean>;

export function createManualAdjustmentDependencies(
  database: ManualAdjustmentDatabase,
  resolvePermission: BillingPermissionResolver,
): ManualAdjustmentDependencies {
  return {
    canManageBilling(tenantSlug, userId) {
      return resolvePermission(tenantSlug, 'billing.manage', userId);
    },

    applyAtomically(command: ManualAdjustmentCommand) {
      return database.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(billingManualAdjustments)
          .values({
            tenantId: command.tenantId,
            subscriptionId: command.subscriptionId,
            billingPeriodId: command.billingPeriodId,
            actorUserId: command.actorUserId,
            idempotencyKey: command.idempotencyKey,
            adjustmentType: command.adjustmentType,
            amountMinor: command.amountMinor,
            currency: command.currency,
            reason: command.reason,
            reference: command.reference ?? null,
          })
          .onConflictDoNothing()
          .returning({ id: billingManualAdjustments.id });

        if (!inserted) {
          const existing = await tx.query.billingManualAdjustments.findFirst({
            columns: { id: true },
            where: and(
              eq(billingManualAdjustments.tenantId, command.tenantId),
              eq(billingManualAdjustments.idempotencyKey, command.idempotencyKey),
            ),
          });

          if (!existing) {
            throw new Error('Manual adjustment conflicted without a matching idempotency record.');
          }

          return { adjustmentId: existing.id, applied: false };
        }

        await tx.insert(billingLedgerEntries).values({
          tenantId: command.tenantId,
          subscriptionId: command.subscriptionId,
          billingPeriodId: command.billingPeriodId,
          settlementId: null,
          entryType: command.adjustmentType,
          amountMinor: command.amountMinor,
          currency: command.currency,
          reversalOfEntryId: null,
          reference: command.reference ?? `manual-adjustment:${inserted.id}`,
        });

        return { adjustmentId: inserted.id, applied: true };
      });
    },
  };
}
