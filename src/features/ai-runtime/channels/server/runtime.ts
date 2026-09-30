import { and, eq } from 'drizzle-orm';

import type { EnterpriseAiInboundAttachment } from '@/features/ai-runtime/channels/inbound';
import {
  estimateEnterpriseAiMediaProviderCostUsdMicros,
  resolveEnterpriseAiMediaContext,
} from '@/features/ai-runtime/channels/media';
import { type EnterpriseAiChannelKey, getEnterpriseAiChannel } from '@/features/ai-runtime/channels/registry';
import {
  deterministicReplyDelaySeconds,
  ensureEnterpriseAiConversation,
  getBoundedEnterpriseAiConversationContext,
  recordEnterpriseAiMessage,
  scheduleEnterpriseAiAction,
} from '@/features/ai-runtime/channels/server/conversations';
import { enqueueEnterpriseAiScheduledAction } from '@/features/ai-runtime/channels/server/delivery-queue';
import { runCentralAi } from '@/features/ai-runtime/providers/central-runtime';
import { getManagedWorkersAiProvider } from '@/features/ai-runtime/providers/runtime.cloudflare';
import { parseEnterpriseAiSolutionConfiguration } from '@/features/ai-runtime/server/business-solutions';
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
import { assertEnterpriseAiManagedCostEnvelope } from '@/features/ai-runtime/server/enterprise-cost-envelope';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import {
  calculateProviderCostUsdMicros,
  getManagedAiCostRateForModel,
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
  attachments?: EnterpriseAiInboundAttachment[];
  solutionInstanceId?: string | null;
  requestedModel?: string;
  testMode?: boolean;
  skipInboundRecord?: boolean;
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
  if (!input.skipInboundRecord) {
    await recordEnterpriseAiMessage({
      tenantId: input.tenantId,
      conversationId: conversation.id,
      direction: 'inbound',
      role: 'user',
      providerMessageId: input.providerMessageId,
      content: input.text,
      metadata: input.attachments?.length
        ? {
            attachmentKinds: input.attachments.map((item) => item.kind),
            attachmentCount: input.attachments.length,
          }
        : {},
    });
  }
  if (conversation.status === 'human') {
    return { kind: 'handoff', conversationId: conversation.id };
  }

  const recentMessages = await getBoundedEnterpriseAiConversationContext({
    tenantId: input.tenantId,
    conversationId: conversation.id,
    maxMessages: 12,
    maxCharacters: 24_000,
  });
  const boundedSystemPrompt = configuration.systemPrompt.slice(0, 12_000);
  const boundedKnowledge = configuration.knowledgeText.slice(0, 24_000);

  const channel = input.channelKey ? getEnterpriseAiChannel(input.channelKey) : null;
  const remindersRequested =
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
  const rate = await resolveActiveAiRateCard(resolved.model.id);
  if (!rate) throw new Error('Managed channel commercial rate is unavailable.');
  const providerRate = getManagedAiCostRateForModel({
    nativeModel: resolved.model.nativeModel,
    providerCostMetadata: resolved.model.providerCostMetadata,
  });
  if (!providerRate) throw new Error('Managed channel provider cost is not verified.');

  const remindersEnabled = remindersRequested && resolved.model.providerKey === 'workers-ai';

  const contextText = [
    boundedSystemPrompt,
    boundedKnowledge,
    ...recentMessages.map((message) => message.content),
  ].filter(Boolean).join('\n\n');
  const messageBytes = new TextEncoder().encode(contextText).byteLength;
  const mediaReservationBytes = Math.min(72_000, (input.attachments?.length ?? 0) * 24_000);
  const inputTokenUpperBound = conservativeInputTokenUpperBound(
    Math.max(1, messageBytes + mediaReservationBytes),
  );
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
    attachments: input.attachments ?? [],
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

  const mediaProviderCostReserveUsdMicros =
    estimateEnterpriseAiMediaProviderCostUsdMicros(input.attachments);
  const estimatedProviderCostUsdMicros = calculateProviderCostUsdMicros({
    rate: providerRate,
    inputTokens: inputTokenUpperBound,
    cachedInputTokens: 0n,
    outputTokens: BigInt(effectiveMaxOutput),
  }) + mediaProviderCostReserveUsdMicros;
  try {
    await assertEnterpriseAiManagedCostEnvelope({
      requestId,
      tenantId: input.tenantId,
      estimatedAdditionalCostUsdMicros: estimatedProviderCostUsdMicros,
      now: startedAt,
    });
  } catch {
    try {
      await releaseAiCommercialRequest({ admission, reason: 'managed_cost_envelope_exhausted' });
    } catch {
      await db.update(aiRequests).set({
        status: 'reconciliation_required',
        errorCode: 'commercial_reconciliation_required',
        completedAt: new Date(),
      }).where(eq(aiRequests.id, requestId));
      throw new Error('Managed channel commercial holds require reconciliation.');
    }
    await db.update(aiRequests).set({
      status: 'admission_denied',
      errorCode: 'managed_cost_envelope_exhausted',
      completedAt: new Date(),
    }).where(eq(aiRequests.id, requestId));
    throw new Error('Prepaid Enterprise AI capacity is exhausted. Add funds to continue.');
  }

  let mediaContext = {
    text: '',
    imageInputs: 0,
    documentInputs: 0,
    audioSeconds: 0,
    providerCostUsdMicros: 0n,
  };
  try {
    mediaContext = await resolveEnterpriseAiMediaContext({
      tenantId: input.tenantId,
      connectionId: input.connectionId,
      channelKey: input.channelKey,
      attachments: input.attachments,
    });
  } catch {
    try {
      await releaseAiCommercialRequest({ admission, reason: 'media_processing_failed' });
    } catch {
      await db.update(aiRequests).set({
        status: 'reconciliation_required',
        errorCode: 'commercial_reconciliation_required',
        completedAt: new Date(),
      }).where(eq(aiRequests.id, requestId));
      throw new Error('Managed channel commercial holds require reconciliation.');
    }
    await db.update(aiRequests).set({
      status: 'provider_unavailable',
      errorCode: 'media_processing_failed',
      completedAt: new Date(),
    }).where(eq(aiRequests.id, requestId));
    throw new Error('Enterprise AI could not safely process the attachment.');
  }

  const mediaMessage = mediaContext.text
    ? [{ role: 'user' as const, content: mediaContext.text }]
    : [];

  let result;
  try {
    if (resolved.model.providerKey === 'workers-ai') {
      const provider = getManagedWorkersAiProvider();
      result = await provider.complete({
      tenantId: input.tenantId,
      projectId: input.projectId ?? null,
      apiKeyId: null,
      actorUserId: null,
      requestedModel: resolved.alias.alias,
      messages: [
        ...(boundedSystemPrompt
          ? [{ role: 'system' as const, content: boundedSystemPrompt }]
          : []),
        ...(boundedKnowledge
          ? [{
              role: 'system' as const,
              content: `Approved business knowledge:\n${boundedKnowledge}`,
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
        ...recentMessages,
        ...mediaMessage,
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
    } else {
      const external = await runCentralAi({
        tenantId: input.tenantId,
        projectId: input.projectId ?? null,
        model: resolved.alias.alias,
        system: [
          boundedSystemPrompt,
          boundedKnowledge ? `Approved business knowledge:\n${boundedKnowledge}` : '',
        ].filter(Boolean).join('\n\n'),
        messages: [
          ...recentMessages
            .filter((message): message is typeof message & { role: 'system' | 'user' | 'assistant' } => message.role !== 'tool'),
          ...mediaMessage,
        ],
        maxOutputTokens: effectiveMaxOutput,
        idempotencyKey,
      });
      result = {
        requestId,
        provider: external.provider,
        nativeModel: external.nativeModel,
        text: external.text,
        finishReason: 'stop' as const,
        usage: {
          inputTokens: BigInt(Math.max(0, Math.trunc(external.usage?.inputTokens ?? 0))),
          cachedInputTokens: 0n,
          outputTokens: BigInt(Math.max(0, Math.trunc(external.usage?.outputTokens ?? 0))),
        },
        providerRequestId: external.providerRequestId,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const explicitCapacityRejection = /(?:\b429\b|rate.?limit|too many requests|busy|capacity|overloaded)/i.test(message);
    if (explicitCapacityRejection) {
      try {
        await releaseAiCommercialRequest({ admission, reason: 'provider_capacity_rejected' });
      } catch {
        await db.update(aiRequests).set({
          status: 'reconciliation_required',
          errorCode: 'commercial_reconciliation_required',
          completedAt: new Date(),
        }).where(eq(aiRequests.id, requestId));
        throw new Error('Managed channel commercial holds require reconciliation.');
      }
      await db.update(aiRequests).set({
        status: 'provider_unavailable',
        errorCode: 'provider_capacity_retryable',
        completedAt: new Date(),
      }).where(eq(aiRequests.id, requestId));
      const retryable = new Error('Enterprise AI provider capacity is temporarily unavailable.');
      Object.assign(retryable, {
        code: 'ENTERPRISE_AI_PROVIDER_CAPACITY_RETRYABLE',
        conversationId: conversation.id,
      });
      throw retryable;
    }

    await db.update(aiRequests).set({
      status: 'reconciliation_required',
      errorCode: 'provider_outcome_unknown',
      providerCostMetadata: {
        requestFingerprint,
        channelConnectionId: input.connectionId,
        creditReservationId: admission.creditReservation.id,
        budgetReservationIds: admission.budgetReservations.map((item) => item.id),
        providerOutcome: 'unknown_after_dispatch',
        reservedProviderCostUsdMicros: estimatedProviderCostUsdMicros.toString(),
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
  }) + mediaContext.providerCostUsdMicros;

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
        mediaProviderCostUsdMicros: mediaContext.providerCostUsdMicros.toString(),
        mediaImageInputs: mediaContext.imageInputs,
        mediaDocumentInputs: mediaContext.documentInputs,
        mediaAudioSeconds: mediaContext.audioSeconds,
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
