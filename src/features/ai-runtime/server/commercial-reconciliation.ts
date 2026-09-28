import { and, asc, eq, lt } from 'drizzle-orm';

import { releaseAiBudget } from '@/features/ai-runtime/server/budget-reservation-service';
import { releaseAiCredits } from '@/features/usage-credits/server/ai-reservation-service';
import { db } from '@/shared/db/cloudflare';
import { aiCreditReservations, aiRequests } from '@/shared/db/schema/ai-runtime';

export type AiCommercialReconciliationResult = {
  scanned: number;
  released: number;
  failed: number;
};

export async function releaseExpiredAiCommercialReservations(input?: {
  now?: Date;
  limit?: number;
}): Promise<AiCommercialReconciliationResult> {
  const now = input?.now ?? new Date();
  const limit = Math.max(1, Math.min(input?.limit ?? 100, 500));

  const rows = await db
    .select()
    .from(aiCreditReservations)
    .where(
      and(
        eq(aiCreditReservations.status, 'held'),
        lt(aiCreditReservations.expiresAt, now),
      ),
    )
    .orderBy(asc(aiCreditReservations.expiresAt))
    .limit(limit);

  let released = 0;
  let failed = 0;

  for (const reservation of rows) {
    try {
      await releaseAiBudget({
        tenantId: reservation.tenantId,
        idempotencyKey: reservation.idempotencyKey,
        reason: 'reservation_expired',
        releasedAt: now,
      });
      await releaseAiCredits({
        tenantId: reservation.tenantId,
        reservationId: reservation.id,
        reason: 'reservation_expired',
        releasedAt: now,
      });

      if (reservation.requestId) {
        await db
          .update(aiRequests)
          .set({
            status: 'reservation_expired',
            errorCode: 'reservation_expired',
            completedAt: now,
          })
          .where(
            and(
              eq(aiRequests.id, reservation.requestId),
              eq(aiRequests.tenantId, reservation.tenantId),
            ),
          );
      }
      released += 1;
    } catch {
      failed += 1;
    }
  }

  return { scanned: rows.length, released, failed };
}
