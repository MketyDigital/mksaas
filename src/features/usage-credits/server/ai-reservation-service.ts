import {
  AI_CREDIT_RESERVATION_DEFAULT_TTL_MS,
  AI_CREDIT_RESERVATION_ERROR_CODES,
  AiCreditReservationError,
  assertReservationCredits,
  assertReservationExpiry,
  assertReservationIdempotencyKey,
  createAiReservationFingerprint,
  planAiReservationRelease,
  planAiReservationSettlement,
  reservationOperationIdempotencyKey,
} from './ai-reservation-engine';
import type {
  AiCreditReservationSource,
  AiCreditReservationTransaction,
  StoredAiCreditReservation,
} from './ai-reservation-source';
import type { CreditBalance } from '../types';

export type ReserveAiCreditsInput = {
  tenantId: string;
  projectId?: string | null;
  apiKeyId?: string | null;
  requestId?: string | null;
  reservedCredits: bigint;
  idempotencyKey: string;
  expiresAt?: Date;
  now?: Date;
};

export type SettleAiCreditsInput = {
  tenantId: string;
  reservationId: string;
  actualCredits: bigint;
  occurredAt?: Date;
};

export type ReleaseAiCreditsInput = {
  tenantId: string;
  reservationId: string;
  reason: string;
  releasedAt?: Date;
};

export type AiCreditReservationMutationResult = {
  reservation: StoredAiCreditReservation;
  balance: CreditBalance;
};

function requireBalance(balance: CreditBalance | null): CreditBalance {
  if (!balance) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.insufficientCredits,
      'Credit account is not available.',
    );
  }
  return balance;
}

async function requireReservation(
  tx: AiCreditReservationTransaction,
  tenantId: string,
  reservationId: string,
) {
  const reservation = await tx.getReservation(tenantId, reservationId);
  if (!reservation) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.notFound,
      'AI credit reservation was not found.',
    );
  }
  return reservation;
}

function assertCommercialScopeMatches(
  reservation: StoredAiCreditReservation,
  tenantId: string,
) {
  if (reservation.tenantId !== tenantId) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.notFound,
      'AI credit reservation was not found.',
    );
  }
}

function assertReleaseReason(reason: string) {
  if (!reason || reason.length > 80) {
    throw new AiCreditReservationError(
      AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
      'Release reason must contain 1 to 80 characters.',
    );
  }
}

export function createAiCreditReservationService(source: AiCreditReservationSource) {
  return {
    async reserve(input: ReserveAiCreditsInput): Promise<AiCreditReservationMutationResult> {
      assertReservationCredits(input.reservedCredits);
      assertReservationIdempotencyKey(input.idempotencyKey);

      const now = input.now ?? new Date();
      const expiresAt =
        input.expiresAt ?? new Date(now.getTime() + AI_CREDIT_RESERVATION_DEFAULT_TTL_MS);
      assertReservationExpiry(expiresAt, now);

      const scope = {
        projectId: input.projectId ?? null,
        apiKeyId: input.apiKeyId ?? null,
        requestId: input.requestId ?? null,
      };
      const fingerprint = await createAiReservationFingerprint({
        tenantId: input.tenantId,
        ...scope,
        reservedCredits: input.reservedCredits,
      });

      return source.transaction(async (tx) => {
        const existing = await tx.findReservationByIdempotency(input.tenantId, input.idempotencyKey);
        if (existing) {
          if (existing.fingerprint !== fingerprint) {
            throw new AiCreditReservationError(
              AI_CREDIT_RESERVATION_ERROR_CODES.idempotencyConflict,
              'Reservation idempotency key was already used for a different commercial scope or amount.',
            );
          }
          return {
            reservation: existing,
            balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
          };
        }

        const ownsScope = await tx.validateOwnedScope(input.tenantId, scope);
        if (!ownsScope) {
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Reservation references must belong to the same tenant.',
          );
        }

        const balance = await tx.applyReservationHold(input.tenantId, input.reservedCredits);
        if (!balance) {
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.insufficientCredits,
            'Insufficient credits for AI reservation.',
          );
        }

        const holdLedger = await tx.insertLedger({
          tenantId: input.tenantId,
          delta: -input.reservedCredits,
          entryType: 'reservation_hold',
          source: 'ai-runtime',
          billingPeriodId: null,
          usageEventId: null,
          idempotencyKey: reservationOperationIdempotencyKey(fingerprint, 'hold'),
          reason: 'AI inference credit reservation',
          actorUserId: null,
        });

        const reservation = await tx.insertReservation({
          tenantId: input.tenantId,
          ...scope,
          idempotencyKey: input.idempotencyKey,
          fingerprint,
          status: 'held',
          reservedCredits: input.reservedCredits,
          holdLedgerEntryId: holdLedger.id,
          expiresAt,
        });

        return { reservation, balance };
      });
    },

    async settle(input: SettleAiCreditsInput): Promise<AiCreditReservationMutationResult> {
      assertReservationCredits(input.actualCredits);
      const occurredAt = input.occurredAt ?? new Date();

      return source.transaction(async (tx) => {
        let reservation = await requireReservation(tx, input.tenantId, input.reservationId);
        assertCommercialScopeMatches(reservation, input.tenantId);

        if (reservation.status === 'settled') {
          if (reservation.settledCredits !== input.actualCredits) {
            throw new AiCreditReservationError(
              AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
              'Reservation was already settled for a different amount.',
            );
          }
          return {
            reservation,
            balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
          };
        }
        if (reservation.status !== 'held') {
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Only held reservations can be settled.',
          );
        }

        const plan = planAiReservationSettlement(
          reservation.reservedCredits,
          input.actualCredits,
        );

        const claimed = await tx.claimSettlement(
          input.tenantId,
          reservation.id,
          input.actualCredits,
          occurredAt,
        );
        if (!claimed) {
          reservation = await requireReservation(tx, input.tenantId, input.reservationId);
          if (reservation.status === 'settled' && reservation.settledCredits === input.actualCredits) {
            return {
              reservation,
              balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
            };
          }
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Reservation changed state before settlement could be claimed.',
          );
        }
        reservation = claimed;

        const balance = await tx.applyReservationSettlement(
          input.tenantId,
          reservation.reservedCredits,
          input.actualCredits,
        );
        if (!balance) {
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Credit account could not apply the reservation settlement.',
          );
        }

        const releaseLedger = await tx.insertLedger({
          tenantId: input.tenantId,
          delta: plan.releaseLedgerDelta,
          entryType: 'reservation_release',
          source: 'ai-runtime',
          billingPeriodId: null,
          usageEventId: null,
          idempotencyKey: reservationOperationIdempotencyKey(reservation.fingerprint, 'release'),
          reason: 'AI inference reservation settled',
          actorUserId: null,
        });

        const usage = await tx.insertUsage({
          tenantId: input.tenantId,
          meterKey: 'ai.request',
          quantity: 1n,
          creditsCharged: input.actualCredits,
          idempotencyKey: reservationOperationIdempotencyKey(reservation.fingerprint, 'usage'),
          projectId: reservation.projectId,
          workspaceKey: null,
          source: 'ai-runtime',
          occurredAt,
        });

        await tx.insertLedger({
          tenantId: input.tenantId,
          delta: plan.usageLedgerDelta,
          entryType: 'usage',
          source: 'ai-runtime',
          billingPeriodId: null,
          usageEventId: usage.id,
          idempotencyKey: reservationOperationIdempotencyKey(reservation.fingerprint, 'usage'),
          reason: null,
          actorUserId: null,
        });

        reservation = await tx.finalizeSettlementLinks({
          tenantId: input.tenantId,
          reservationId: reservation.id,
          releaseLedgerEntryId: releaseLedger.id,
          usageEventId: usage.id,
        });

        return { reservation, balance };
      });
    },

    async release(input: ReleaseAiCreditsInput): Promise<AiCreditReservationMutationResult> {
      assertReleaseReason(input.reason);
      const releasedAt = input.releasedAt ?? new Date();

      return source.transaction(async (tx) => {
        let reservation = await requireReservation(tx, input.tenantId, input.reservationId);
        assertCommercialScopeMatches(reservation, input.tenantId);

        if (reservation.status === 'released') {
          return {
            reservation,
            balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
          };
        }
        if (reservation.status !== 'held') {
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Only held reservations can be released.',
          );
        }

        const plan = planAiReservationRelease(reservation.reservedCredits);
        const claimed = await tx.claimRelease(
          input.tenantId,
          reservation.id,
          input.reason,
          releasedAt,
        );
        if (!claimed) {
          reservation = await requireReservation(tx, input.tenantId, input.reservationId);
          if (reservation.status === 'released') {
            return {
              reservation,
              balance: requireBalance(await tx.getCreditBalance(input.tenantId)),
            };
          }
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Reservation changed state before release could be claimed.',
          );
        }
        reservation = claimed;

        const balance = await tx.applyReservationRelease(
          input.tenantId,
          plan.availableBalanceDeltaAfterHold,
        );
        if (!balance) {
          throw new AiCreditReservationError(
            AI_CREDIT_RESERVATION_ERROR_CODES.stateConflict,
            'Credit account could not apply the reservation release.',
          );
        }

        const releaseLedger = await tx.insertLedger({
          tenantId: input.tenantId,
          delta: plan.releaseLedgerDelta,
          entryType: 'reservation_release',
          source: 'ai-runtime',
          billingPeriodId: null,
          usageEventId: null,
          idempotencyKey: reservationOperationIdempotencyKey(reservation.fingerprint, 'release'),
          reason: input.reason,
          actorUserId: null,
        });

        reservation = await tx.finalizeReleaseLink({
          tenantId: input.tenantId,
          reservationId: reservation.id,
          releaseLedgerEntryId: releaseLedger.id,
        });

        return { reservation, balance };
      });
    },
  };
}

type AiCreditReservationService = ReturnType<typeof createAiCreditReservationService>;
let defaultServicePromise: Promise<AiCreditReservationService> | null = null;

function getDefaultService(): Promise<AiCreditReservationService> {
  defaultServicePromise ??= import('./ai-reservation-drizzle-source').then(
    ({ drizzleAiCreditReservationSource }) =>
      createAiCreditReservationService(drizzleAiCreditReservationSource),
  );
  return defaultServicePromise;
}

export async function reserveAiCredits(input: ReserveAiCreditsInput) {
  return (await getDefaultService()).reserve(input);
}

export async function settleAiCredits(input: SettleAiCreditsInput) {
  return (await getDefaultService()).settle(input);
}

export async function releaseAiCredits(input: ReleaseAiCreditsInput) {
  return (await getDefaultService()).release(input);
}
