import { and, eq } from 'drizzle-orm';

import { type EnterpriseAiChannelKey, getEnterpriseAiChannel } from '@/features/ai-runtime/channels/registry';
import { getManagedWorkersAiProvider } from '@/features/ai-runtime/providers/runtime.cloudflare';
import { enqueueEnterpriseAiScheduledAction } from '@/features/ai-runtime/channels/server/delivery-queue';
import {
  deterministicReplyDelaySeconds,
  ensureEnterpriseAiConversation,
  recordEnterpriseAiMessage,
  scheduleEnterpriseAiAction,
} from '@/features/ai-runtime/channels/server/conversations';
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
  | { kind: 'completed'; requestId: string; text: string; conversationId: string; deliveryDelaySeconds: number; reminderScheduled: boolean }
  | { kind: 'duplicate'; requestId: string }
  | { kind: 'handoff'; conversationId: string }
  | { kind: 'disabled'; requestId?: string };

export async function runEnterpriseAiManagedChannelTurn(input: {
  tenantId: string;
  projectId?: string | null;
  connectionId: string;
  channelKey?: EnterpriseAiChannelKey;
  providerMessageId: string;
  senderId: string;
  externalConversationId: string;
  replyRecipientId: string;
  replyToId?: string;
  contextId?: string;
  text: string;
  solutionInstanceId?: string | null;
  requestedModel?: string;
  testMode?: boolean;
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

  const conversation = await ensureEnterpriseAiConversation({
    tenantId: input.tenantId,
    projectId: input.projectId ?? null,
    solutionInstanceId: solution?.id ?? null,
    connectionId: input.connectionId,
    externalConversationId: input.externalConversationId,
    externalUserId: input.senderId,
    replyRecipientId: input.replyRecipientId,
    replyContextId: input.contextId ?? input.externalConversationId,
  });
  await recordEnterpriseAiMessage({
    tenantId: input.tenantId,
    conversationId: conversation.id,
    direction: 'inbound',
    role: 'user',
    providerMessageId: input.providerMessageId,
    content: input.text,
  });
  if (conversation.status === 'human') {
    return { kind: 'handoff', conversationId: conversation.id };
  }

  const channel = input.channelKey ? getEnterpriseAiChannel(input.channelKey) : null;
  const remindersEnabled =
    configuration.commitmentRemindersEnabled &&
    !input.testMode &&
    channel?.supportsCommitmentReminders === true;

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
        ...(remindersEnabled
          ? [{
              role: 'system' as const,
              content: [
                `Current UTC time: ${new Date().toISOString()}.`,
                `Business reminder timezone: ${configuration.reminderTimezone}.`,
                'If and only if the customer clearly commits to a future action and provides an unambiguous date/time, you may call schedule_commitment_reminder once.',
                'Do not schedule from vague statements such as later, soon, maybe, or someday. Do not invent a date.',
                'The acknowledgement must not claim a reminder was scheduled unless you call the tool.',
              ].join(' '),
            }]
          : []),
        { role: 'user' as const, content: input.text },
      ],
      ...(remindersEnabled
        ? {
            tools: [{
              name: 'schedule_commitment_reminder',
              description: 'Schedule one reminder for an explicit future commitment stated by the customer.',
              inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['dueAtIso', 'commitment', 'sourceQuote', 'reminderText', 'acknowledgement'],
                properties: {
                  dueAtIso: { type: 'string', description: 'Unambiguous ISO-8601 timestamp with UTC offset.' },
                  commitment: { type: 'string', minLength: 1, maxLength: 500 },
                  sourceQuote: { type: 'string', minLength: 1, maxLength: 300, description: 'Exact short quote from the customer message that contains the commitment/date.' },
                  reminderText: { type: 'string', minLength: 1, maxLength: 1200 },
                  acknowledgement: { type: 'string', minLength: 1, maxLength: 1200 },
                },
              },
            }],
          }
        : {}),
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

  let responseText = result.text ?? '';
  let pendingReminder: {
    dueAt: Date;
    commitment: string;
    sourceQuote: string;
    reminderText: string;
  } | null = null;
  const reminderCall = remindersEnabled
    ? result.toolCalls?.find((item) => item.name === 'schedule_commitment_reminder')
    : undefined;
  if (reminderCall) {
    try {
      const args = JSON.parse(reminderCall.argumentsJson) as Record<string, unknown>;
      const dueAtIso = String(args.dueAtIso ?? '').trim();
      const dueAt = new Date(dueAtIso);
      const hasExplicitOffset = /T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(dueAtIso);
      const commitment = String(args.commitment ?? '').trim().slice(0, 500);
      const sourceQuote = String(args.sourceQuote ?? '').trim().slice(0, 300);
      const reminderText = String(args.reminderText ?? '').trim().slice(0, 1200);
      const acknowledgement = String(args.acknowledgement ?? '').trim().slice(0, 1200);
      const now = Date.now();
      const maxFuture = now + 366 * 24 * 60 * 60 * 1000;
      if (
        hasExplicitOffset &&
        Number.isFinite(dueAt.getTime()) &&
        dueAt.getTime() > now + 60_000 &&
        dueAt.getTime() <= maxFuture &&
        commitment &&
        sourceQuote &&
        input.text.toLocaleLowerCase().includes(sourceQuote.toLocaleLowerCase()) &&
        reminderText &&
        acknowledgement
      ) {
        const scheduledAt = new Date(
          Math.max(now + 60_000, dueAt.getTime() - configuration.reminderLeadMinutes * 60_000),
        );
        pendingReminder = { dueAt: scheduledAt, commitment, sourceQuote, reminderText };
        responseText = acknowledgement;
      } else if (!responseText) {
        responseText = 'Please give me a specific future date and time so I can schedule that reminder safely.';
      }
    } catch {
      if (!responseText) {
        responseText = 'Please give me a specific future date and time so I can schedule that reminder safely.';
      }
    }
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

  let reminderScheduled = false;
  if (pendingReminder) {
    try {
      const reminder = await scheduleEnterpriseAiAction({
        tenantId: input.tenantId,
        conversationId: conversation.id,
        solutionInstanceId: solution?.id ?? null,
        connectionId: input.connectionId,
        kind: 'commitment_reminder',
        idempotencyKey: `reminder:${input.connectionId}:${input.providerMessageId}`,
        dueAt: pendingReminder.dueAt,
        payload: {
          recipientId: input.replyRecipientId,
          contextId: input.contextId,
          text: pendingReminder.reminderText,
          sourceProviderMessageId: input.providerMessageId,
          commitment: pendingReminder.commitment,
          sourceQuote: pendingReminder.sourceQuote,
        },
      });
      const delaySeconds = Math.max(0, Math.ceil((pendingReminder.dueAt.getTime() - Date.now()) / 1_000));
      if (delaySeconds <= 86_400) {
        await enqueueEnterpriseAiScheduledAction({
          actionId: reminder.id,
          tenantId: input.tenantId,
          delaySeconds,
        }).catch(() => ({ queued: false as const, reason: 'queue_failed' as const }));
      }
      reminderScheduled = true;
    } catch {
      responseText = 'I understood your commitment, but I could not save the reminder safely. Please ask me again to schedule it.';
    }
  }

  const deliveryDelaySeconds = input.testMode
    ? 0
    : await deterministicReplyDelaySeconds(configuration, input.providerMessageId);

  return {
    kind: 'completed',
    requestId,
    text: responseText,
    conversationId: conversation.id,
    deliveryDelaySeconds,
    reminderScheduled,
  };
}

export async function releaseEnterpriseAiChannelAdmissionSafely(input: Parameters<typeof releaseAiCommercialRequest>[0]) {
  return releaseAiCommercialRequest(input);
}
