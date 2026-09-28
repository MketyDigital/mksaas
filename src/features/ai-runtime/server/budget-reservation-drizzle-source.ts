import { and, eq, gt, inArray, isNull, lte, or, sql } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import {
  type AiBudget,
  type AiBudgetReservation,
  aiBudgetReservations,
  aiBudgets,
} from '@/shared/db/schema/ai-runtime';

import type {
  AiBudgetReservationSource,
  AiBudgetReservationTransaction,
  StoredAiBudget,
  StoredAiBudgetReservation,
} from './budget-reservation-source';

function mapBudget(row: AiBudget): StoredAiBudget {
  return {
    id: row.id,
    tenantId: row.tenantId,
    projectId: row.projectId,
    apiKeyId: row.apiKeyId,
    maxCredits: row.maxCredits,
    maxRequests: row.maxRequests,
    usedCredits: row.usedCredits,
    usedRequests: row.usedRequests,
    reservedCredits: row.reservedCredits,
    reservedRequests: row.reservedRequests,
    hardStop: row.hardStop,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
  };
}

function mapReservation(row: AiBudgetReservation): StoredAiBudgetReservation {
  if (row.status !== 'held' && row.status !== 'settled' && row.status !== 'released') {
    throw new Error(`Unsupported AI budget reservation status: ${row.status}`);
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    budgetId: row.budgetId,
    requestId: row.requestId,
    creditReservationId: row.creditReservationId,
    idempotencyKey: row.idempotencyKey,
    fingerprint: row.fingerprint,
    status: row.status,
    reservedCredits: row.reservedCredits,
    reservedRequests: row.reservedRequests,
    settledCredits: row.settledCredits,
    settledRequests: row.settledRequests,
    expiresAt: row.expiresAt,
    settledAt: row.settledAt,
    releasedAt: row.releasedAt,
    releaseReason: row.releaseReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const drizzleAiBudgetReservationSource: AiBudgetReservationSource = {
  transaction<T>(work: (tx: AiBudgetReservationTransaction) => Promise<T>): Promise<T> {
    return db.transaction(async (databaseTx) => {
      const tx: AiBudgetReservationTransaction = {
        async listApplicableBudgets(input) {
          const projectPredicate = input.projectId
            ? or(isNull(aiBudgets.projectId), eq(aiBudgets.projectId, input.projectId))
            : isNull(aiBudgets.projectId);
          const apiKeyPredicate = input.apiKeyId
            ? or(isNull(aiBudgets.apiKeyId), eq(aiBudgets.apiKeyId, input.apiKeyId))
            : isNull(aiBudgets.apiKeyId);

          const rows = await databaseTx
            .select()
            .from(aiBudgets)
            .where(
              and(
                eq(aiBudgets.tenantId, input.tenantId),
                lte(aiBudgets.startsAt, input.now),
                gt(aiBudgets.endsAt, input.now),
                projectPredicate,
                apiKeyPredicate,
              ),
            );

          return rows.map(mapBudget);
        },

        async findReservationsByIdempotency(tenantId, idempotencyKey) {
          const rows = await databaseTx
            .select()
            .from(aiBudgetReservations)
            .where(
              and(
                eq(aiBudgetReservations.tenantId, tenantId),
                eq(aiBudgetReservations.idempotencyKey, idempotencyKey),
              ),
            );
          return rows.map(mapReservation);
        },

        async getReservations(tenantId, reservationIds) {
          if (reservationIds.length === 0) return [];
          const rows = await databaseTx
            .select()
            .from(aiBudgetReservations)
            .where(
              and(
                eq(aiBudgetReservations.tenantId, tenantId),
                inArray(aiBudgetReservations.id, reservationIds),
              ),
            );
          return rows.map(mapReservation);
        },

        async applyBudgetHold(budgetId, credits, requests) {
          const [row] = await databaseTx
            .update(aiBudgets)
            .set({
              reservedCredits: sql`${aiBudgets.reservedCredits} + ${credits}`,
              reservedRequests: sql`${aiBudgets.reservedRequests} + ${requests}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiBudgets.id, budgetId),
                sql`(
                  ${aiBudgets.hardStop} = false OR (
                    (${aiBudgets.maxCredits} IS NULL OR ${aiBudgets.usedCredits} + ${aiBudgets.reservedCredits} + ${credits} <= ${aiBudgets.maxCredits})
                    AND
                    (${aiBudgets.maxRequests} IS NULL OR ${aiBudgets.usedRequests} + ${aiBudgets.reservedRequests} + ${requests} <= ${aiBudgets.maxRequests})
                  )
                )`,
              ),
            )
            .returning();
          return row ? mapBudget(row) : null;
        },

        async applyBudgetSettlement(
          budgetId,
          reservedCredits,
          reservedRequests,
          actualCredits,
          actualRequests,
        ) {
          const [row] = await databaseTx
            .update(aiBudgets)
            .set({
              reservedCredits: sql`${aiBudgets.reservedCredits} - ${reservedCredits}`,
              reservedRequests: sql`${aiBudgets.reservedRequests} - ${reservedRequests}`,
              usedCredits: sql`${aiBudgets.usedCredits} + ${actualCredits}`,
              usedRequests: sql`${aiBudgets.usedRequests} + ${actualRequests}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiBudgets.id, budgetId),
                sql`${aiBudgets.reservedCredits} >= ${reservedCredits}`,
                sql`${aiBudgets.reservedRequests} >= ${reservedRequests}`,
              ),
            )
            .returning();
          return row ? mapBudget(row) : null;
        },

        async applyBudgetRelease(budgetId, reservedCredits, reservedRequests) {
          const [row] = await databaseTx
            .update(aiBudgets)
            .set({
              reservedCredits: sql`${aiBudgets.reservedCredits} - ${reservedCredits}`,
              reservedRequests: sql`${aiBudgets.reservedRequests} - ${reservedRequests}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(aiBudgets.id, budgetId),
                sql`${aiBudgets.reservedCredits} >= ${reservedCredits}`,
                sql`${aiBudgets.reservedRequests} >= ${reservedRequests}`,
              ),
            )
            .returning();
          return row ? mapBudget(row) : null;
        },

        async insertReservation(input) {
          const [row] = await databaseTx.insert(aiBudgetReservations).values(input).returning();
          if (!row) throw new Error('AI budget reservation insert did not return a row.');
          return mapReservation(row);
        },

        async claimSettlement(input) {
          const [row] = await databaseTx
            .update(aiBudgetReservations)
            .set({
              status: 'settled',
              settledCredits: input.actualCredits,
              settledRequests: input.actualRequests,
              settledAt: input.settledAt,
              updatedAt: input.settledAt,
            })
            .where(
              and(
                eq(aiBudgetReservations.tenantId, input.tenantId),
                eq(aiBudgetReservations.id, input.reservationId),
                eq(aiBudgetReservations.status, 'held'),
              ),
            )
            .returning();
          return row ? mapReservation(row) : null;
        },

        async claimRelease(input) {
          const [row] = await databaseTx
            .update(aiBudgetReservations)
            .set({
              status: 'released',
              releasedAt: input.releasedAt,
              releaseReason: input.reason,
              updatedAt: input.releasedAt,
            })
            .where(
              and(
                eq(aiBudgetReservations.tenantId, input.tenantId),
                eq(aiBudgetReservations.id, input.reservationId),
                eq(aiBudgetReservations.status, 'held'),
              ),
            )
            .returning();
          return row ? mapReservation(row) : null;
        },
      };

      return work(tx);
    });
  },
};
