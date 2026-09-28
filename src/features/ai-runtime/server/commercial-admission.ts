import {
  releaseAiBudget,
  reserveAiBudget,
} from './budget-reservation-service';
import type {
  AiBudgetReservationGroupResult,
  ReleaseAiBudgetInput,
  ReserveAiBudgetInput,
} from './budget-reservation-service';
import {
  releaseAiCredits,
  reserveAiCredits,
} from '@/features/usage-credits/server/ai-reservation-service';
import type {
  AiCreditReservationMutationResult,
  ReleaseAiCreditsInput,
  ReserveAiCreditsInput,
} from '@/features/usage-credits/server/ai-reservation-service';

export const AI_COMMERCIAL_ADMISSION_ERROR_CODES = {
  budgetDenied: 'AI_COMMERCIAL_ADMISSION_BUDGET_DENIED',
  compensationFailed: 'AI_COMMERCIAL_ADMISSION_COMPENSATION_FAILED',
  releaseFailed: 'AI_COMMERCIAL_ADMISSION_RELEASE_FAILED',
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

export type AiCommercialAdmissionDependencies = {
  reserveCredits(input: ReserveAiCreditsInput): Promise<AiCreditReservationMutationResult>;
  releaseCredits(input: ReleaseAiCreditsInput): Promise<AiCreditReservationMutationResult>;
  reserveBudget(input: ReserveAiBudgetInput): Promise<AiBudgetReservationGroupResult>;
  releaseBudget(input: ReleaseAiBudgetInput): Promise<AiBudgetReservationGroupResult>;
};

const defaultDependencies: AiCommercialAdmissionDependencies = {
  reserveCredits: reserveAiCredits,
  releaseCredits: releaseAiCredits,
  reserveBudget: reserveAiBudget,
  releaseBudget: releaseAiBudget,
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
