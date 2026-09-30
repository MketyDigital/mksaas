import {
  releaseAiCredits,
  reserveAiCredits,
  settleAiCredits,
} from '@/features/usage-credits/server/ai-reservation-service';
import type {
  AiCreditReservationMutationResult,
  ReleaseAiCreditsInput,
  ReserveAiCreditsInput,
  SettleAiCreditsInput,
} from '@/features/usage-credits/server/ai-reservation-service';
import {
  releaseAiBudget,
  reserveAiBudget,
  settleAiBudget,
} from './budget-reservation-service';
import type {
  AiBudgetReservationGroupResult,
  ReleaseAiBudgetInput,
  ReserveAiBudgetInput,
  SettleAiBudgetInput,
} from './budget-reservation-service';

export const AI_COMMERCIAL_ADMISSION_ERROR_CODES = {
  budgetDenied: 'AI_COMMERCIAL_ADMISSION_BUDGET_DENIED',
  compensationFailed: 'AI_COMMERCIAL_ADMISSION_COMPENSATION_FAILED',
  releaseFailed: 'AI_COMMERCIAL_ADMISSION_RELEASE_FAILED',
  settlementFailed: 'AI_COMMERCIAL_ADMISSION_SETTLEMENT_FAILED',
} as const;

export type AiCommercialAdmissionErrorCode =
  (typeof AI_COMMERCIAL_ADMISSION_ERROR_CODES)[keyof typeof AI_COMMERCIAL_ADMISSION_ERROR_CODES];

export class AiCommercialAdmissionError extends Error {
  constructor(
    readonly code: AiCommercialAdmissionErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AiCommercialAdmissionError';
  }
}

export type AiCommercialAdmission = {
  tenantId: string;
  idempotencyKey: string;
  reservedCredits: bigint;
  creditReservation: AiCreditReservationMutationResult['reservation'];
  budgetReservations: AiBudgetReservationGroupResult['reservations'];
};

export type AdmitAiCommercialRequestInput = {
  tenantId: string;
  projectId?: string | null;
  apiKeyId?: string | null;
  requestId: string;
  idempotencyKey: string;
  reservedCredits: bigint;
  expiresAt?: Date;
  now?: Date;
};

export type ReleaseAiCommercialRequestInput = {
  admission: AiCommercialAdmission;
  reason: string;
  releasedAt?: Date;
};

export type SettleAiCommercialRequestInput = {
  admission: AiCommercialAdmission;
  actualCredits: bigint;
  settledAt?: Date;
};

export type AiCommercialAdmissionDependencies = {
  reserveCredits(input: ReserveAiCreditsInput): Promise<AiCreditReservationMutationResult>;
  releaseCredits(input: ReleaseAiCreditsInput): Promise<AiCreditReservationMutationResult>;
  reserveBudget(input: ReserveAiBudgetInput): Promise<AiBudgetReservationGroupResult>;
  releaseBudget(input: ReleaseAiBudgetInput): Promise<AiBudgetReservationGroupResult>;
  settleCredits(input: SettleAiCreditsInput): Promise<AiCreditReservationMutationResult>;
  settleBudget(input: SettleAiBudgetInput): Promise<AiBudgetReservationGroupResult>;
};

const defaultDependencies: AiCommercialAdmissionDependencies = {
  reserveCredits: reserveAiCredits,
  releaseCredits: releaseAiCredits,
  reserveBudget: reserveAiBudget,
  releaseBudget: releaseAiBudget,
  settleCredits: settleAiCredits,
  settleBudget: settleAiBudget,
};

export function createAiCommercialAdmissionService(
  dependencies: AiCommercialAdmissionDependencies = defaultDependencies,
) {
  return {
    async admit(input: AdmitAiCommercialRequestInput): Promise<AiCommercialAdmission> {
      const credit = await dependencies.reserveCredits({
        tenantId: input.tenantId,
        projectId: input.projectId ?? null,
        apiKeyId: input.apiKeyId ?? null,
        requestId: input.requestId,
        reservedCredits: input.reservedCredits,
        idempotencyKey: input.idempotencyKey,
        expiresAt: input.expiresAt,
        now: input.now,
      });

      try {
        const budgets = await dependencies.reserveBudget({
          tenantId: input.tenantId,
          projectId: input.projectId ?? null,
          apiKeyId: input.apiKeyId ?? null,
          requestId: input.requestId,
          creditReservationId: credit.reservation.id,
          reservedCredits: input.reservedCredits,
          reservedRequests: 1n,
          idempotencyKey: input.idempotencyKey,
          expiresAt: input.expiresAt,
          now: input.now,
        });

        return {
          tenantId: input.tenantId,
          idempotencyKey: input.idempotencyKey,
          reservedCredits: input.reservedCredits,
          creditReservation: credit.reservation,
          budgetReservations: budgets.reservations,
        };
      } catch (budgetError) {
        try {
          await dependencies.releaseCredits({
            tenantId: input.tenantId,
            reservationId: credit.reservation.id,
            reason: 'budget_admission_failed',
          });
        } catch (compensationError) {
          throw new AiCommercialAdmissionError(
            AI_COMMERCIAL_ADMISSION_ERROR_CODES.compensationFailed,
            'AI admission failed and its credit hold requires repair before retry.',
            { budgetError, compensationError },
          );
        }

        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.budgetDenied,
          'AI request was not admitted by the applicable budgets.',
          budgetError,
        );
      }
    },

    async settle(input: SettleAiCommercialRequestInput): Promise<void> {
      let budgetError: unknown = null;
      let creditError: unknown = null;

      // Settle budgets first. Credits are the customer-value ledger and remain held
      // until every applicable budget can accept the same actual charge.
      try {
        await dependencies.settleBudget({
          tenantId: input.admission.tenantId,
          idempotencyKey: input.admission.idempotencyKey,
          actualCredits: input.actualCredits,
          actualRequests: 1n,
          settledAt: input.settledAt,
        });
      } catch (error) {
        budgetError = error;
      }

      if (!budgetError) {
        try {
          await dependencies.settleCredits({
            tenantId: input.admission.tenantId,
            reservationId: input.admission.creditReservation.id,
            actualCredits: input.actualCredits,
            occurredAt: input.settledAt,
          });
        } catch (error) {
          creditError = error;
        }
      }

      if (budgetError || creditError) {
        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.settlementFailed,
          'AI commercial settlement requires reconciliation.',
          { budgetError, creditError },
        );
      }
    },

    async release(input: ReleaseAiCommercialRequestInput): Promise<void> {
      let budgetError: unknown = null;
      let creditError: unknown = null;

      try {
        await dependencies.releaseBudget({
          tenantId: input.admission.tenantId,
          idempotencyKey: input.admission.idempotencyKey,
          reason: input.reason,
          releasedAt: input.releasedAt,
        });
      } catch (error) {
        budgetError = error;
      }

      try {
        await dependencies.releaseCredits({
          tenantId: input.admission.tenantId,
          reservationId: input.admission.creditReservation.id,
          reason: input.reason,
          releasedAt: input.releasedAt,
        });
      } catch (error) {
        creditError = error;
      }

      if (budgetError || creditError) {
        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.releaseFailed,
          'AI commercial admission release requires reconciliation.',
          { budgetError, creditError },
        );
      }
    },
  };
}

let defaultService: ReturnType<typeof createAiCommercialAdmissionService> | null = null;

function getDefaultService() {
  defaultService ??= createAiCommercialAdmissionService();
  return defaultService;
}

export async function admitAiCommercialRequest(input: AdmitAiCommercialRequestInput) {
  return getDefaultService().admit(input);
}

export async function releaseAiCommercialRequest(input: ReleaseAiCommercialRequestInput) {
  return getDefaultService().release(input);
}

export async function settleAiCommercialRequest(input: SettleAiCommercialRequestInput) {
  return getDefaultService().settle(input);
}
