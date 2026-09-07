import { and, eq } from 'drizzle-orm';

import type { Database } from '@/shared/db';
import { billingRenewalAttempts, billingSubscriptions } from '@/shared/db/schema';

import type { RenewalRepository } from './renewal-service';

type RenewalDatabase = Pick<Database, 'transaction'>;

export function createDrizzleRenewalRepository(database: RenewalDatabase): RenewalRepository {
  return {
    recordPreparedAttempt(input) {
      return database.transaction(async (tx) => {
        const [attempt] = await tx
          .insert(billingRenewalAttempts)
          .values({
            tenantId: input.tenantId,
            subscriptionId: input.subscriptionId,
            billingPeriodId: input.billingPeriodId,
            mode: input.mode,
            provider: input.provider,
            status: input.status,
            attemptedAt: input.attemptedAt,
          })
          .returning({ id: billingRenewalAttempts.id });

        if (!attempt) throw new Error('Failed to persist billing renewal attempt.');
        return { attemptId: attempt.id };
      });
    },

    markPastDue(input) {
      return database.transaction(async (tx) => {
        const current = await tx.query.billingSubscriptions.findFirst({
          columns: { id: true, tenantId: true, status: true },
          where: and(
            eq(billingSubscriptions.id, input.subscriptionId),
            eq(billingSubscriptions.tenantId, input.tenantId),
          ),
        });

        if (!current) throw new Error('Billing subscription not found for renewal grace transition.');
        if (current.status === 'cancelled') {
          throw new Error('Current persisted subscription is cancelled and cannot enter renewal grace.');
        }

        await tx
          .update(billingSubscriptions)
          .set({
            status: input.status,
            gracePeriodEnd: input.gracePeriodEnd,
            updatedAt: input.updatedAt,
          })
          .where(
            and(
              eq(billingSubscriptions.id, current.id),
              eq(billingSubscriptions.tenantId, input.tenantId),
            ),
          );
      });
    },
  };
}
