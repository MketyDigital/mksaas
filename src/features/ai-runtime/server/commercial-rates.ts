import { and, desc, eq, gt, isNull, lte, or } from 'drizzle-orm';

import { db } from '@/shared/db/cloudflare';
import { aiRateCards } from '@/shared/db/schema/ai-runtime';

const ONE_MILLION = 1_000_000n;

function ceilDiv(numerator: bigint, denominator: bigint) {
  return (numerator + denominator - 1n) / denominator;
}

export type AiRateCardSnapshot = {
  id: string;
  modelId: string;
  version: number;
  inputCreditsPerMillion: bigint;
  cachedInputCreditsPerMillion: bigint | null;
  outputCreditsPerMillion: bigint;
  minimumCreditsPerRequest: bigint;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export function calculateAiCredits(input: {
  inputTokens: bigint;
  cachedInputTokens?: bigint;
  outputTokens: bigint;
  rate: Pick<
    AiRateCardSnapshot,
    | 'inputCreditsPerMillion'
    | 'cachedInputCreditsPerMillion'
    | 'outputCreditsPerMillion'
    | 'minimumCreditsPerRequest'
  >;
}) {
  const cached = input.cachedInputTokens ?? 0n;
  if (input.inputTokens < 0n || cached < 0n || input.outputTokens < 0n || cached > input.inputTokens) {
    throw new Error('Invalid AI usage token counts.');
  }

  const uncached = input.inputTokens - cached;
  const cachedRate = input.rate.cachedInputCreditsPerMillion ?? input.rate.inputCreditsPerMillion;
  const inputCredits = ceilDiv(uncached * input.rate.inputCreditsPerMillion, ONE_MILLION);
  const cachedCredits = ceilDiv(cached * cachedRate, ONE_MILLION);
  const outputCredits = ceilDiv(input.outputTokens * input.rate.outputCreditsPerMillion, ONE_MILLION);
  const calculated = inputCredits + cachedCredits + outputCredits;

  return calculated > input.rate.minimumCreditsPerRequest
    ? calculated
    : input.rate.minimumCreditsPerRequest;
}

export function estimateAiReservationCredits(input: {
  inputTokenUpperBound: bigint;
  maxOutputTokens: bigint;
  rate: Pick<
    AiRateCardSnapshot,
    | 'inputCreditsPerMillion'
    | 'cachedInputCreditsPerMillion'
    | 'outputCreditsPerMillion'
    | 'minimumCreditsPerRequest'
  >;
}) {
  if (input.inputTokenUpperBound <= 0n || input.maxOutputTokens <= 0n) {
    throw new Error('AI reservation token bounds must be positive.');
  }

  return calculateAiCredits({
    inputTokens: input.inputTokenUpperBound,
    cachedInputTokens: 0n,
    outputTokens: input.maxOutputTokens,
    rate: input.rate,
  });
}

export async function resolveActiveAiRateCard(
  modelId: string,
  now = new Date(),
): Promise<AiRateCardSnapshot | null> {
  const [row] = await db
    .select()
    .from(aiRateCards)
    .where(
      and(
        eq(aiRateCards.modelId, modelId),
        eq(aiRateCards.status, 'active'),
        lte(aiRateCards.effectiveFrom, now),
        or(isNull(aiRateCards.effectiveTo), gt(aiRateCards.effectiveTo, now)),
      ),
    )
    .orderBy(desc(aiRateCards.version))
    .limit(1);

  if (!row) return null;
  return {
    id: row.id,
    modelId: row.modelId,
    version: row.version,
    inputCreditsPerMillion: row.inputCreditsPerMillion,
    cachedInputCreditsPerMillion: row.cachedInputCreditsPerMillion,
    outputCreditsPerMillion: row.outputCreditsPerMillion,
    minimumCreditsPerRequest: row.minimumCreditsPerRequest,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
  };
}
