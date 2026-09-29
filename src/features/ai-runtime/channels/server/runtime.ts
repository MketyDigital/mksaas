import { and, eq } from 'drizzle-orm';

import { getManagedWorkersAiProvider } from '@/features/ai-runtime/providers/runtime.cloudflare';
import {
  admitAiCommercialRequest,
  releaseAiCommercialRequest,
  settleAiCommercialRequest,
} from '@/features/ai-runtime/server/commercial-admission';
import { conservativeInputTokenUpperBound } from '@/features/ai-runtime/server/commercial-estimation';
import { getEnterpriseAiRuntimePolicy } from '@/features/ai-runtime/server/commercial-policy';
import {
  calculateAiCredits,
  estimateAiReservationCredits,
  resolveActiveAiRateCard,
} from '@/features/ai-runtime/server/commercial-rates';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import { parseEnterpriseAiSolutionConfiguration } from '@/features/ai-runtime/server/business-solutions';
import {
  calculateProviderCostUsdMicros,
  getManagedAiCostRate,
  minimumCustomerRevenueUsdMicros,
} from '@/features/ai-runtime/server/provider-cost';
import { db } from '@/shared/db/cloudflare';
import { aiRequests } from '@/shared/db/schema';
import { aiSolutionInstances } from '@/shared/db/schema/ai-runtime';

export type EnterpriseAiManagedChannelTurnResult =
  | { kind: 'completed'; requestId: string; text: string }
  | { kind: 'duplicate'; requestId: string }
  | { kind: 'disabled'; requestId?: string };

export async function runEnterpriseAiManagedChannelTurn(input: {
  tenantId: string;
  projectId?: string | null;
  connectionId: string;
  providerMessageId: string;
  senderId: string;
  text: string;
  solutionInstanceId?: string | null;
  requestedModel?: string;
}): Promise<EnterpriseAiManagedChannelTurnResult> {
  const policy = await getEnterpriseAiRuntimePolicy();
  if (!policy.customerInferenceEnabled) return { kind: 'disabled' };

  const solution = input.solutionInstanceId
    ? await db.query.aiSolutionInstances.findFirst({
        where: and(
          eq(aiSolutionInstances.id, input.solutionInstanceId),
          eq(aiSolutionInstances.tenantId, input.tenantId),
        ),
      })
    : null;
  if (input.solutionInstanceId && !solution) {
    throw new Error('Managed channel solution is unavailable.');
  }

  const configuration = parseEnterpriseAiSolutionConfiguration(solution?.configuration);
  if (solution?.status === 'disabled' || configuration.paused) {
    return { kind: 'disabled' };
  }

  const requestedModel =
    input.requestedModel ??
    configuration.defaultModelAlias ??
    'mkety-economy';
  const resolved = await resolveAiModelRoute({
    tenantId: input.tenantId,
    projectId: input.projectId ?? null,
    requestedModel,
  });
  if (!resolved) throw new Error('Managed channel model route is unavailable.');
  if (resolved.model.providerKey !== 'workers-ai') throw new Error('Managed channel provider is unavailable.');

  const rate = await resolveActiveAiRateCard(resolved.model.id);
  if (!rate) throw new Error('Managed channel commercial rate is unavailable.');
  const providerRate = getManagedAiCostRate(resolved.model.nativeModel);
  if (!providerRate) throw new Error('Managed channel provider cost is not verified.');

  const contextText = [configuration.systemPrompt, configuration.knowledgeText, input.text]
    .filter(Boolean)
    .join('\n\n');
  const messageBytes = new TextEncoder().encode(contextText).byteLength;
  const inputTokenUpperBound = conservativeInputTokenUpperBound(Math.max(1, messageBytes));
  const modelMaxOutput = typeof resolved.model.limits.maxOutputTokens === 'number'
    ? resolved.model.limits.maxOutputTokens
    : policy.maxOutputTokens;
  const effectiveMaxOutput = Math.min(2_048, policy.maxOutputTokens, modelMaxOutput);
  const reservedCredits = estimateAiReservationCredits({
    inputTokenUpperBound,
    maxOutputTokens: BigInt(effectiveMaxOutput),
    rate,
  });

  const idempotencyKey = `channel:${input.connectionId}:${input.providerMessageId}`.slice(0, 160);
  const fingerprintInput = JSON.stringify({
    connectionId: input.connectionId,
    providerMessageId: input.providerMessageId,
    senderId: input.senderId,
    text: input.text,
    requestedModel,
  });
  const requestFingerprintBytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(fingerprintInput),
  );
  const requestFingerprint = Array.from(new Uint8Array(requestFingerprintBytes), (byte) =>
    byte.toString(16).padStart(2, '0')).join('');

  const existing = await db.query.aiRequests.findFirst({
    where: and(
      eq(aiRequests.tenantId, input.tenantId),
      eq(aiRequests.idempotencyKey, idempotencyKey),
    ),
  });
  if (existing) return { kind: 'duplicate', requestId: existing.id };

  const requestId = crypto.randomUUID();
  const startedAt = new Date();
  await db.insert(aiRequests).values({
    id: requestId,
    tenantId: input.tenantId,
    projectId: input.projectId ?? null,
    apiKeyId: null,
    idempotencyKey,
    modelAlias: resolved.alias.alias,
    providerKey: resolved.model.providerKey,
    nativeModel: resolved.model.nativeModel,
    rateCardId: rate.id,
    rateCardVersion: rate.version,
    reservedCredits,
    status: 'admitting',
    providerCostMetadata: {
      requestFingerprint,
      channelConnectionId: input.connectionId,
      solutionInstanceId: solution?.id ?? null,
      inputTokenUpperBound: inputTokenUpperBound.toString(),
      effectiveMaxOutput,
    },
    startedAt,
  });

  let admission;
  try {
    admission = await admitAiCommercialRequest({
      tenantId: input.tenantId,
      projectId: input.projectId ?? null,
      apiKeyId: null,
      requestId,
      idempotencyKey,
      reservedCredits,
      expiresAt: new Date(startedAt.getTime() + policy.reservationTtlSeconds * 1_000),
      now: startedAt,
    });
  } catch {
    await db.update(aiRequests).set({
      status: 'admission_denied',
      errorCode: 'commercial_admission_denied',
      completedAt: new Date(),
    }).where(eq(aiRequests.id, requestId));
    throw new Error('Managed channel request was not commercially admitted.');
  }

  let result;
  try {
    const provider = getManagedWorkersAiProvider();
    result = await provider.complete({
      tenantId: input.tenantId,
      projectId: input.projectId ?? null,
      apiKeyId: null,
      actorUserId: null,
      requestedModel: resolved.alias.alias,
      messages: [
        ...(configuration.systemPrompt
          ? [{ role: 'system' as const, content: configuration.systemPrompt }]
          : []),
        ...(configuration.knowledgeText
          ? [{
              role: 'system' as const,
              content: `Approved business knowledge:\n${configuration.knowledgeText}`,
            }]
          : []),
        { role: 'user' as const, content: input.text },
      ],
      maxOutputTokens: effectiveMaxOutput,
      metadata: {
        requestId,
        channelConnectionId: input.connectionId,
        externalSenderId: input.senderId,
      },
      idempotencyKey,
    }, resolved.model.nativeModel);
  } catch {
    await db.update(aiRequests).set({
      status: 'reconciliation_required',
      errorCode: 'provider_outcome_unknown',
      providerCostMetadata: {
        requestFingerprint,
        channelConnectionId: input.connectionId,
        creditReservationId: admission.creditReservation.id,
        budgetReservationIds: admission.budgetReservations.map((item) => item.id),
        providerOutcome: 'unknown_after_dispatch',
      },
      completedAt: new Date(),
    }).where(eq(aiRequests.id, requestId));
    throw new Error('Managed channel provider outcome requires reconciliation.');
  }

  const actualCredits = calculateAiCredits({
    inputTokens: result.usage.inputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    outputTokens: result.usage.outputTokens,
    rate,
  });
  const providerCostUsdMicros = calculateProviderCostUsdMicros({
    rate: providerRate,
    inputTokens: result.usage.inputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    outputTokens: result.usage.outputTokens,
  });

  try {
    await settleAiCommercialRequest({ admission, actualCredits, settledAt: new Date() });
  } catch {
    await db.update(aiRequests).set({
      status: 'reconciliation_required',
      errorCode: 'commercial_reconciliation_required',
      inputTokens: result.usage.inputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
      outputTokens: result.usage.outputTokens,
      providerCostMetadata: {
        requestFingerprint,
        channelConnectionId: input.connectionId,
        providerRequestId: result.providerRequestId ?? null,
        providerCostUsdMicros: providerCostUsdMicros.toString(),
        providerCostVerifiedAt: providerRate.verifiedAt,
        minimumRevenueUsdMicros: minimumCustomerRevenueUsdMicros(providerCostUsdMicros).toString(),
        actualCredits: actualCredits.toString(),
        creditReservationId: admission.creditReservation.id,
        budgetReservationIds: admission.budgetReservations.map((item) => item.id),
      },
      completedAt: new Date(),
    }).where(eq(aiRequests.id, requestId));
    throw new Error('Managed channel settlement requires reconciliation.');
  }

  await db.update(aiRequests).set({
    status: 'completed',
    errorCode: null,
    settledCredits: actualCredits,
    inputTokens: result.usage.inputTokens,
    cachedInputTokens: result.usage.cachedInputTokens,
    outputTokens: result.usage.outputTokens,
    providerCostMetadata: {
      requestFingerprint,
      channelConnectionId: input.connectionId,
      providerRequestId: result.providerRequestId ?? null,
      providerCostUsdMicros: providerCostUsdMicros.toString(),
      providerCostVerifiedAt: providerRate.verifiedAt,
      minimumRevenueUsdMicros: minimumCustomerRevenueUsdMicros(providerCostUsdMicros).toString(),
      actualCredits: actualCredits.toString(),
      creditReservationId: admission.creditReservation.id,
      budgetReservationIds: admission.budgetReservations.map((item) => item.id),
    },
    completedAt: new Date(),
  }).where(eq(aiRequests.id, requestId));

  return { kind: 'completed', requestId, text: result.text ?? '' };
}

export async function releaseEnterpriseAiChannelAdmissionSafely(input: Parameters<typeof releaseAiCommercialRequest>[0]) {
  return releaseAiCommercialRequest(input);
}
