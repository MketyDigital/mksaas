import { and, eq } from 'drizzle-orm';

import {
  releaseAiBudget,
  reserveAiBudget,
  settleAiBudget,
} from '@/features/ai-runtime/server/budget-reservation-service';
import {
  calculateAiCredits,
  estimateAiReservationCredits,
  resolveActiveAiRateCard,
  type AiRateCardSnapshot,
} from '@/features/ai-runtime/server/commercial-rates';
import { getEnterpriseAiRuntimePolicy } from '@/features/ai-runtime/server/runtime-policy';
import {
  releaseAiCredits,
  reserveAiCredits,
  settleAiCredits,
} from '@/features/usage-credits/server/ai-reservation-service';
import { db } from '@/shared/db/cloudflare';
import { aiRequests } from '@/shared/db/schema/ai-runtime';

export const AI_COMMERCIAL_ADMISSION_ERROR_CODES = {
  rateMissing: 'AI_COMMERCIAL_RATE_MISSING',
  policyDisabled: 'AI_COMMERCIAL_INFERENCE_DISABLED',
  requestConflict: 'AI_COMMERCIAL_REQUEST_CONFLICT',
  admissionFailed: 'AI_COMMERCIAL_ADMISSION_FAILED',
} as const;

export class AiCommercialAdmissionError extends Error {
  constructor(
    readonly code:
      (typeof AI_COMMERCIAL_ADMISSION_ERROR_CODES)[keyof typeof AI_COMMERCIAL_ADMISSION_ERROR_CODES],
    message: string,
  ) {
    super(message);
    this.name = 'AiCommercialAdmissionError';
  }
}

export type AiCommercialAdmission = {
  tenantId: string;
  projectId: string | null;
  apiKeyId: string | null;
  requestId: string;
  requestIdempotencyKey: string;
  commercialIdempotencyKey: string;
  creditReservationId: string;
  budgetReservationIds: string[];
  reservedCredits: bigint;
  rateCard: AiRateCardSnapshot;
  expiresAt: Date;
};

type AdmissionDependencies = {
  getPolicy: typeof getEnterpriseAiRuntimePolicy;
  markRequest: typeof markRequest;
  resolveRate: typeof resolveActiveAiRateCard;
  reserveCredits: typeof reserveAiCredits;
  reserveBudget: typeof reserveAiBudget;
  releaseCredits: typeof releaseAiCredits;
  releaseBudget: typeof releaseAiBudget;
  settleCredits: typeof settleAiCredits;
  settleBudget: typeof settleAiBudget;
};

const defaultDependencies: AdmissionDependencies = {
  getPolicy: getEnterpriseAiRuntimePolicy,
  markRequest,
  resolveRate: resolveActiveAiRateCard,
  reserveCredits: reserveAiCredits,
  reserveBudget: reserveAiBudget,
  releaseCredits: releaseAiCredits,
  releaseBudget: releaseAiBudget,
  settleCredits: settleAiCredits,
  settleBudget: settleAiBudget,
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function commercialIdempotencyKey(input: {
  tenantId: string;
  requestIdempotencyKey: string;
  requestFingerprint: string;
}) {
  return `aiadm:${await sha256(JSON.stringify(input))}`;
}

async function markRequest(input: {
  requestId: string;
  tenantId: string;
  status: string;
  errorCode?: string | null;
  metadata?: Record<string, unknown>;
  completedAt?: Date | null;
}) {
  const existing = await db.query.aiRequests.findFirst({
    where: and(
      eq(aiRequests.id, input.requestId),
      eq(aiRequests.tenantId, input.tenantId),
    ),
  });
  if (!existing) throw new Error('AI request does not belong to tenant.');

  await db
    .update(aiRequests)
    .set({
      status: input.status,
      errorCode: input.errorCode ?? null,
      providerCostMetadata: {
        ...existing.providerCostMetadata,
        ...(input.metadata ?? {}),
      },
      completedAt: input.completedAt ?? null,
    })
    .where(and(eq(aiRequests.id, input.requestId), eq(aiRequests.tenantId, input.tenantId)));
}

export function createAiCommercialAdmissionService(
  dependencies: AdmissionDependencies = defaultDependencies,
) {
  return {
    async admit(input: {
      tenantId: string;
      projectId: string | null;
      apiKeyId: string | null;
      requestId: string;
      requestIdempotencyKey: string;
      requestFingerprint: string;
      modelId: string;
      inputTokenUpperBound: bigint;
      maxOutputTokens: bigint;
      now?: Date;
      requireInferenceEnabled?: boolean;
    }): Promise<AiCommercialAdmission> {
      const now = input.now ?? new Date();
      const policy = await dependencies.getPolicy();
      if (!policy.prepaidOnly) {
        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.admissionFailed,
          'Enterprise AI commercial policy is not prepaid-only.',
        );
      }
      if (input.requireInferenceEnabled !== false && !policy.customerInferenceEnabled) {
        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.policyDisabled,
          'Enterprise AI customer inference is disabled.',
        );
      }

      const rateCard = await dependencies.resolveRate(input.modelId, now);
      if (!rateCard) {
        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.rateMissing,
          'No active commercial rate is available for the selected model.',
        );
      }

      const reservedCredits = estimateAiReservationCredits({
        inputTokenUpperBound: input.inputTokenUpperBound,
        maxOutputTokens: input.maxOutputTokens,
        rate: rateCard,
      });
      const expiresAt = new Date(now.getTime() + policy.reservationTtlSeconds * 1000);
      const idempotencyKey = await commercialIdempotencyKey({
        tenantId: input.tenantId,
        requestIdempotencyKey: input.requestIdempotencyKey,
        requestFingerprint: input.requestFingerprint,
      });

      const credit = await dependencies.reserveCredits({
        tenantId: input.tenantId,
        projectId: input.projectId,
        apiKeyId: input.apiKeyId,
        requestId: input.requestId,
        reservedCredits,
        idempotencyKey,
        expiresAt,
        now,
      });

      try {
        const budget = await dependencies.reserveBudget({
          tenantId: input.tenantId,
          projectId: input.projectId,
          apiKeyId: input.apiKeyId,
          requestId: input.requestId,
          creditReservationId: credit.reservation.id,
          reservedCredits,
          reservedRequests: 1n,
          idempotencyKey,
          expiresAt,
          now,
        });

        await dependencies.markRequest({
          requestId: input.requestId,
          tenantId: input.tenantId,
          status: 'authorized',
          metadata: {
            rateCardId: rateCard.id,
            rateCardVersion: rateCard.version,
            reservedCredits: reservedCredits.toString(),
            commercialIdempotencyKey: idempotencyKey,
            creditReservationId: credit.reservation.id,
            budgetReservationIds: budget.reservations.map((item) => item.id),
          },
        });

        return {
          tenantId: input.tenantId,
          projectId: input.projectId,
          apiKeyId: input.apiKeyId,
          requestId: input.requestId,
          requestIdempotencyKey: input.requestIdempotencyKey,
          commercialIdempotencyKey: idempotencyKey,
          creditReservationId: credit.reservation.id,
          budgetReservationIds: budget.reservations.map((item) => item.id),
          reservedCredits,
          rateCard,
          expiresAt,
        };
      } catch (error) {
        await dependencies.releaseCredits({
          tenantId: input.tenantId,
          reservationId: credit.reservation.id,
          reason: 'budget_admission_failed',
        }).catch(() => undefined);
        await dependencies.markRequest({
          requestId: input.requestId,
          tenantId: input.tenantId,
          status: 'admission_failed',
          errorCode: 'admission_failed',
          completedAt: new Date(),
        }).catch(() => undefined);
        throw error;
      }
    },

    async release(
      admission: AiCommercialAdmission,
      reason: string,
    ) {
      const budgetResult = await dependencies.releaseBudget({
        tenantId: admission.tenantId,
        idempotencyKey: admission.commercialIdempotencyKey,
        reason,
      });
      const creditResult = await dependencies.releaseCredits({
        tenantId: admission.tenantId,
        reservationId: admission.creditReservationId,
        reason,
      });
      await dependencies.markRequest({
        requestId: admission.requestId,
        tenantId: admission.tenantId,
        status: reason,
        errorCode: reason,
        completedAt: new Date(),
      });
      return { budgetResult, creditResult };
    },

    async settle(
      admission: AiCommercialAdmission,
      usage: {
        inputTokens: bigint;
        cachedInputTokens?: bigint;
        outputTokens: bigint;
        occurredAt?: Date;
      },
    ) {
      const actualCredits = calculateAiCredits({
        ...usage,
        rate: admission.rateCard,
      });
      if (actualCredits > admission.reservedCredits) {
        throw new AiCommercialAdmissionError(
          AI_COMMERCIAL_ADMISSION_ERROR_CODES.admissionFailed,
          'Actual AI usage exceeds the admitted commercial reservation.',
        );
      }

      const budgetResult = await dependencies.settleBudget({
        tenantId: admission.tenantId,
        idempotencyKey: admission.commercialIdempotencyKey,
        actualCredits,
        actualRequests: 1n,
        settledAt: usage.occurredAt,
      });
      const creditResult = await dependencies.settleCredits({
        tenantId: admission.tenantId,
        reservationId: admission.creditReservationId,
        actualCredits,
        occurredAt: usage.occurredAt,
      });
      await dependencies.markRequest({
        requestId: admission.requestId,
        tenantId: admission.tenantId,
        status: 'completed',
        metadata: { actualCredits: actualCredits.toString() },
        completedAt: usage.occurredAt ?? new Date(),
      });
      return { actualCredits, budgetResult, creditResult };
    },
  };
}

export const aiCommercialAdmissionService = createAiCommercialAdmissionService();
