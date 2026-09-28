import {
  AI_BUDGET_RESERVATION_DEFAULT_TTL_MS,
  AI_BUDGET_RESERVATION_ERROR_CODES,
  AiBudgetReservationError,
  assertBudgetReservationAmount,
  assertBudgetReservationExpiry,
  assertBudgetReservationIdempotencyKey,
  assertBudgetSettlementWithinReservation,
  createAiBudgetReservationFingerprint,
} from './budget-reservation-engine';
import type {
  AiBudgetReservationSource,
  StoredAiBudgetReservation,
} from './budget-reservation-source';

export type ReserveAiBudgetInput = {
  tenantId: string;
  projectId?: string | null;
  apiKeyId?: string | null;
  requestId?: string | null;
  creditReservationId?: string | null;
  reservedCredits: bigint;
  reservedRequests?: bigint;
  idempotencyKey: string;
  expiresAt?: Date;
  now?: Date;
};

export type SettleAiBudgetInput = {
  tenantId: string;
  idempotencyKey: string;
  actualCredits: bigint;
  actualRequests?: bigint;
  settledAt?: Date;
};

export type ReleaseAiBudgetInput = {
  tenantId: string;
  idempotencyKey: string;
  reason: string;
  releasedAt?: Date;
};

export type AiBudgetReservationGroupResult = {
  reservations: StoredAiBudgetReservation[];
};

function assertReleaseReason(reason: string) {
  if (!reason || reason.length > 80) {
    throw new AiBudgetReservationError(
      AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
      'Budget reservation release reason must contain 1 to 80 characters.',
    );
  }
}

function assertReplayFingerprint(
  reservations: StoredAiBudgetReservation[],
  fingerprint: string,
) {
  if (reservations.some((reservation) => reservation.fingerprint !== fingerprint)) {
    throw new AiBudgetReservationError(
      AI_BUDGET_RESERVATION_ERROR_CODES.idempotencyConflict,
      'Budget reservation idempotency key was already used for different scope or amounts.',
    );
  }
}

export function createAiBudgetReservationService(source: AiBudgetReservationSource) {
  return {
    async reserve(input: ReserveAiBudgetInput): Promise<AiBudgetReservationGroupResult> {
      const reservedRequests = input.reservedRequests ?? 1n;
      assertBudgetReservationAmount(input.reservedCredits, reservedRequests);
      assertBudgetReservationIdempotencyKey(input.idempotencyKey);

      const now = input.now ?? new Date();
      const expiresAt =
        input.expiresAt ?? new Date(now.getTime() + AI_BUDGET_RESERVATION_DEFAULT_TTL_MS);
      assertBudgetReservationExpiry(expiresAt, now);

      const scope = {
        projectId: input.projectId ?? null,
        apiKeyId: input.apiKeyId ?? null,
        requestId: input.requestId ?? null,
        creditReservationId: input.creditReservationId ?? null,
      };
      const fingerprint = await createAiBudgetReservationFingerprint({
        tenantId: input.tenantId,
        ...scope,
        reservedCredits: input.reservedCredits,
        reservedRequests,
        idempotencyKey: input.idempotencyKey,
      });

      return source.transaction(async (tx) => {
        const existing = await tx.findReservationsByIdempotency(
          input.tenantId,
          input.idempotencyKey,
        );
        if (existing.length > 0) {
          assertReplayFingerprint(existing, fingerprint);
          return { reservations: existing };
        }

        const budgets = await tx.listApplicableBudgets({
          tenantId: input.tenantId,
          projectId: scope.projectId,
          apiKeyId: scope.apiKeyId,
          now,
        });
        if (budgets.length === 0) {
          throw new AiBudgetReservationError(
            AI_BUDGET_RESERVATION_ERROR_CODES.budgetMissing,
            'No active AI budget applies to this request.',
          );
        }

        const reservations: StoredAiBudgetReservation[] = [];
        for (const budget of budgets) {
          const updated = await tx.applyBudgetHold(
            budget.id,
            input.reservedCredits,
            reservedRequests,
          );
          if (!updated) {
            throw new AiBudgetReservationError(
              AI_BUDGET_RESERVATION_ERROR_CODES.budgetExhausted,
              'One or more applicable AI budgets cannot authorize this reservation.',
            );
          }

          reservations.push(
            await tx.insertReservation({
              tenantId: input.tenantId,
              budgetId: budget.id,
              ...scope,
              idempotencyKey: input.idempotencyKey,
              fingerprint,
              status: 'held',
              reservedCredits: input.reservedCredits,
              reservedRequests,
              expiresAt,
            }),
          );
        }

        return { reservations };
      });
    },

    async settle(input: SettleAiBudgetInput): Promise<AiBudgetReservationGroupResult> {
      const actualRequests = input.actualRequests ?? 1n;
      assertBudgetReservationAmount(input.actualCredits, actualRequests);
      assertBudgetReservationIdempotencyKey(input.idempotencyKey);
      const settledAt = input.settledAt ?? new Date();

      return source.transaction(async (tx) => {
        const reservations = await tx.findReservationsByIdempotency(
          input.tenantId,
          input.idempotencyKey,
        );
        if (reservations.length === 0) {
          throw new AiBudgetReservationError(
            AI_BUDGET_RESERVATION_ERROR_CODES.budgetMissing,
            'Budget reservation group was not found.',
          );
        }

        const alreadySettled = reservations.every(
          (reservation) =>
            reservation.status === 'settled' &&
            reservation.settledCredits === input.actualCredits &&
            reservation.settledRequests === actualRequests,
        );
        if (alreadySettled) return { reservations };

        if (reservations.some((reservation) => reservation.status !== 'held')) {
          throw new AiBudgetReservationError(
            AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
            'Budget reservation group is no longer fully held.',
          );
        }

        for (const reservation of reservations) {
          assertBudgetSettlementWithinReservation({
            reservedCredits: reservation.reservedCredits,
            reservedRequests: reservation.reservedRequests,
            actualCredits: input.actualCredits,
            actualRequests,
          });
        }

        const settled: StoredAiBudgetReservation[] = [];
        for (const reservation of reservations) {
          const claimed = await tx.claimSettlement({
            tenantId: input.tenantId,
            reservationId: reservation.id,
            actualCredits: input.actualCredits,
            actualRequests,
            settledAt,
          });
          if (!claimed) {
            throw new AiBudgetReservationError(
              AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
              'Budget reservation changed state before settlement could complete.',
            );
          }

          const updated = await tx.applyBudgetSettlement(
            reservation.budgetId,
            reservation.reservedCredits,
            reservation.reservedRequests,
            input.actualCredits,
            actualRequests,
          );
          if (!updated) {
            throw new AiBudgetReservationError(
              AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
              'Budget counters could not apply reservation settlement.',
            );
          }
          settled.push(claimed);
        }

        return { reservations: settled };
      });
    },

    async release(input: ReleaseAiBudgetInput): Promise<AiBudgetReservationGroupResult> {
      assertBudgetReservationIdempotencyKey(input.idempotencyKey);
      assertReleaseReason(input.reason);
      const releasedAt = input.releasedAt ?? new Date();

      return source.transaction(async (tx) => {
        const reservations = await tx.findReservationsByIdempotency(
          input.tenantId,
          input.idempotencyKey,
        );
        if (reservations.length === 0) {
          throw new AiBudgetReservationError(
            AI_BUDGET_RESERVATION_ERROR_CODES.budgetMissing,
            'Budget reservation group was not found.',
          );
        }

        if (reservations.every((reservation) => reservation.status === 'released')) {
          return { reservations };
        }
        if (reservations.some((reservation) => reservation.status !== 'held')) {
          throw new AiBudgetReservationError(
            AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
            'Budget reservation group is no longer fully held.',
          );
        }

        const released: StoredAiBudgetReservation[] = [];
        for (const reservation of reservations) {
          const claimed = await tx.claimRelease({
            tenantId: input.tenantId,
            reservationId: reservation.id,
            reason: input.reason,
            releasedAt,
          });
          if (!claimed) {
            throw new AiBudgetReservationError(
              AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
              'Budget reservation changed state before release could complete.',
            );
          }

          const updated = await tx.applyBudgetRelease(
            reservation.budgetId,
            reservation.reservedCredits,
            reservation.reservedRequests,
          );
          if (!updated) {
            throw new AiBudgetReservationError(
              AI_BUDGET_RESERVATION_ERROR_CODES.stateConflict,
              'Budget counters could not release the reservation.',
            );
          }
          released.push(claimed);
        }

        return { reservations: released };
      });
    },
  };
}

type AiBudgetReservationService = ReturnType<typeof createAiBudgetReservationService>;
let defaultServicePromise: Promise<AiBudgetReservationService> | null = null;

function getDefaultService(): Promise<AiBudgetReservationService> {
  defaultServicePromise ??= import('./budget-reservation-drizzle-source').then(
    ({ drizzleAiBudgetReservationSource }) =>
      createAiBudgetReservationService(drizzleAiBudgetReservationSource),
  );
  return defaultServicePromise;
}

export async function reserveAiBudget(input: ReserveAiBudgetInput) {
  return (await getDefaultService()).reserve(input);
}

export async function settleAiBudget(input: SettleAiBudgetInput) {
  return (await getDefaultService()).settle(input);
}

export async function releaseAiBudget(input: ReleaseAiBudgetInput) {
  return (await getDefaultService()).release(input);
}
