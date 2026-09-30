import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { hasEnterpriseAiApiAccess } from '@/features/ai-runtime/server/access';
import { authenticateAiApiKey } from '@/features/ai-runtime/server/api-auth';
import { getManagedWorkersAiProvider } from '@/features/ai-runtime/providers/runtime.cloudflare';
import { runCentralAi } from '@/features/ai-runtime/providers/central-runtime';
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
import {
  calculateProviderCostUsdMicros,
  getManagedAiCostRate,
  getManagedAiCostRateForModel,
  minimumCustomerRevenueUsdMicros,
} from '@/features/ai-runtime/server/provider-cost';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import { assertEnterpriseAiManagedCostEnvelope } from '@/features/ai-runtime/server/enterprise-cost-envelope';
import { db } from '@/shared/db/cloudflare';
import { withRequestDatabase } from '@/shared/db/request';
import { aiRequests, projects } from '@/shared/db/schema';

const ABSOLUTE_MAX_REQUEST_BYTES = 5_000_000;

const requestSchema = z.object({
  model: z.string().min(1).max(128),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().max(500_000),
    name: z.string().max(128).optional(),
    tool_call_id: z.string().max(160).optional(),
  })).min(1).max(512),
  max_tokens: z.number().int().positive().max(131_072).optional(),
  max_completion_tokens: z.number().int().positive().max(131_072).optional(),
  stream: z.boolean().optional().default(false),
  tools: z.array(z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string().min(1).max(128),
      description: z.string().max(2_000).optional(),
      parameters: z.record(z.string(), z.unknown()),
    }),
  })).max(256).optional(),
  provider_connection_id: z.string().uuid().optional(),
  response_format: z.object({
    type: z.literal('json_schema'),
    json_schema: z.object({
      name: z.string().min(1).max(128).optional(),
      strict: z.boolean().optional(),
      schema: z.record(z.string(), z.unknown()),
    }),
  }).optional(),
});

function errorResponse(status: number, code: string, message: string, requestId?: string) {
  return Response.json({
    error: {
      code,
      message,
      ...(requestId ? { request_id: requestId } : {}),
    },
  }, { status });
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJsonBody(request: Request, maxRequestBytes: number) {
  const enforcedMax = Math.min(maxRequestBytes, ABSOLUTE_MAX_REQUEST_BYTES);
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > enforcedMax) return { tooLarge: true as const };

  const raw = await request.text();
  const rawBytes = new TextEncoder().encode(raw).byteLength;
  if (rawBytes > enforcedMax) return { tooLarge: true as const };

  try {
    return {
      tooLarge: false as const,
      rawBytes,
      value: JSON.parse(raw) as unknown,
    };
  } catch {
    return { tooLarge: false as const, rawBytes, value: null };
  }
}

type DuplicateRequestRecord = Pick<
  typeof aiRequests.$inferSelect,
  'id' | 'errorCode' | 'providerCostMetadata'
>;

function requestFingerprintFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const value = (metadata as Record<string, unknown>).requestFingerprint;
  return typeof value === 'string' ? value : null;
}

async function findExistingRequest(tenantId: string, idempotencyKey: string): Promise<DuplicateRequestRecord | null> {
  const [row] = await db
    .select({
      id: aiRequests.id,
      errorCode: aiRequests.errorCode,
      providerCostMetadata: aiRequests.providerCostMetadata,
    })
    .from(aiRequests)
    .where(and(
      eq(aiRequests.tenantId, tenantId),
      eq(aiRequests.idempotencyKey, idempotencyKey),
    ))
    .limit(1);
  return row ?? null;
}

async function resolveIdempotencyReplay(input: {
  tenantId: string;
  idempotencyKey: string;
  requestFingerprint: string;
}) {
  try {
    const existing = await findExistingRequest(input.tenantId, input.idempotencyKey);
    if (!existing) return null;
    const existingFingerprint = requestFingerprintFromMetadata(existing.providerCostMetadata);
    if (existingFingerprint !== input.requestFingerprint) {
      return errorResponse(
        409,
        'idempotency_conflict',
        'Idempotency-Key was already used with a different request.',
      );
    }
    return duplicateResponse(existing);
  } catch {
    return errorResponse(
      503,
      'idempotency_lookup_unavailable',
      'Idempotency state could not be verified safely. The request was not sent upstream.',
    );
  }
}

function duplicateResponse(existing: DuplicateRequestRecord) {
  const messages: Record<string, string> = {
    runtime_disabled: 'Enterprise AI customer inference is not enabled yet.',
    provider_unavailable: 'Managed inference is not enabled on this route yet.',
    commercial_reconciliation_required: 'This request is awaiting commercial reconciliation.',
  };
  const code = existing.errorCode ?? 'duplicate_request';
  const status = code === 'runtime_disabled' || code === 'provider_unavailable' || code === 'commercial_reconciliation_required' ? 503 : 409;
  return errorResponse(
    status,
    code,
    messages[code] ?? 'This request has already been accepted.',
    existing.id,
  );
}

async function handlePost(request: Request) {
  const key = await authenticateAiApiKey(request, 'ai:chat');
  if (!key) return errorResponse(401, 'unauthorized', 'Invalid API key.');

  if (!(await hasEnterpriseAiApiAccess(key.tenantId))) {
    return errorResponse(403, 'forbidden', 'Enterprise AI API access is not enabled.');
  }

  const policy = await getEnterpriseAiRuntimePolicy();
  const body = await readJsonBody(request, policy.maxRequestBytes);
  if (body.tooLarge) return errorResponse(413, 'request_too_large', 'Request body is too large.');

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return errorResponse(400, 'invalid_request', 'Invalid chat completion request.');
  }
  if (parsed.data.messages.length > policy.maxMessages) {
    return errorResponse(400, 'too_many_messages', 'Request exceeds the configured message limit.');
  }
  if ((parsed.data.tools?.length ?? 0) > policy.maxTools) {
    return errorResponse(400, 'too_many_tools', 'Request exceeds the configured tool limit.');
  }
  if (parsed.data.stream) {
    return errorResponse(501, 'streaming_not_enabled', 'Streaming is not enabled yet.');
  }

  const projectHeader = request.headers.get('x-mkety-project-id')?.trim() || null;
  const projectId = key.projectId ?? projectHeader;

  if (key.projectId && projectHeader && projectHeader !== key.projectId) {
    return errorResponse(403, 'project_scope_mismatch', 'API key is not valid for this project.');
  }

  if (projectId) {
    const ownedProject = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.tenantId, key.tenantId)),
      columns: { id: true },
    });
    if (!ownedProject) {
      return errorResponse(403, 'project_scope_mismatch', 'Project is not available to this tenant.');
    }
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 160) {
    return errorResponse(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required.');
  }

  const requestFingerprint = await sha256(JSON.stringify({
    projectId,
    body: parsed.data,
  }));

  const replay = await resolveIdempotencyReplay({
    tenantId: key.tenantId,
    idempotencyKey,
    requestFingerprint,
  });
  if (replay) return replay;

  if (parsed.data.provider_connection_id) {
    if (!policy.customerInferenceEnabled) {
      return errorResponse(503, 'runtime_disabled', 'Enterprise AI customer inference is not enabled yet.');
    }
    if (parsed.data.tools?.length) {
      return errorResponse(400, 'byok_tools_not_supported', 'Tool calling is not enabled for this BYOK provider route yet.');
    }
    if (parsed.data.response_format) {
      return errorResponse(400, 'byok_structured_output_not_supported', 'Structured output is not enabled for this BYOK provider route yet.');
    }

    const requestId = crypto.randomUUID();
    const startedAt = new Date();
    try {
      await db.insert(aiRequests).values({
        id: requestId,
        tenantId: key.tenantId,
        projectId,
        apiKeyId: key.id,
        idempotencyKey,
        modelAlias: parsed.data.model,
        providerKey: 'byok',
        nativeModel: parsed.data.model,
        reservedCredits: 0n,
        settledCredits: 0n,
        status: 'provider_dispatch',
        providerCostMetadata: {
          requestFingerprint,
          commercialMode: 'byok',
          providerCostOwnership: 'customer',
        },
        startedAt,
      });
    } catch {
      const raced = await resolveIdempotencyReplay({
        tenantId: key.tenantId,
        idempotencyKey,
        requestFingerprint,
      });
      return raced ?? errorResponse(
        503,
        'idempotency_lookup_unavailable',
        'Idempotency state could not be verified safely. The request was not sent upstream.',
      );
    }

    try {
      const result = await runCentralAi({
        tenantId: key.tenantId,
        projectId,
        apiKeyId: key.id,
        providerConnectionId: parsed.data.provider_connection_id,
        model: parsed.data.model,
        system: '',
        messages: parsed.data.messages
          .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
          .map((message) => ({
            role: message.role as 'system' | 'user' | 'assistant',
            content: message.content,
          })),
        maxOutputTokens: parsed.data.max_completion_tokens ?? parsed.data.max_tokens ?? policy.maxOutputTokens,
        idempotencyKey,
      });

      await db.update(aiRequests).set({
        providerKey: result.provider,
        nativeModel: result.nativeModel,
        status: 'completed',
        inputTokens: BigInt(result.usage?.inputTokens ?? 0),
        outputTokens: BigInt(result.usage?.outputTokens ?? 0),
        cachedInputTokens: 0n,
        settledCredits: 0n,
        providerCostMetadata: {
          requestFingerprint,
          commercialMode: 'byok',
          providerCostOwnership: 'customer',
          mketyProviderCostUsdMicros: '0',
          providerRequestId: result.providerRequestId ?? null,
        },
        completedAt: new Date(),
      }).where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));

      return Response.json({
        id: requestId,
        object: 'chat.completion',
        model: result.nativeModel,
        choices: [{
          index: 0,
          message: { role: 'assistant', content: result.text || null },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: result.usage?.inputTokens ?? 0,
          completion_tokens: result.usage?.outputTokens ?? 0,
          total_tokens: result.usage?.totalTokens ?? ((result.usage?.inputTokens ?? 0) + (result.usage?.outputTokens ?? 0)),
        },
        mkety_commercial_mode: 'byok',
      });
    } catch {
      await db.update(aiRequests).set({
        status: 'provider_unavailable',
        errorCode: 'byok_provider_failed',
        completedAt: new Date(),
      }).where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));

      return errorResponse(
        503,
        'byok_provider_failed',
        'The customer-owned provider request failed. Mkety did not fall back to managed inference.',
        requestId,
      );
    }
  }

  const resolved = await resolveAiModelRoute({
    tenantId: key.tenantId,
    projectId,
    requestedModel: parsed.data.model,
  });
  if (!resolved) {
    return errorResponse(403, 'model_not_allowed', 'Requested model is not available for this tenant.');
  }

  if (parsed.data.tools?.length && !resolved.model.capabilities.tools) {
    return errorResponse(400, 'tools_not_supported', 'Requested model does not support tool calling.');
  }
  if (parsed.data.response_format && !resolved.model.capabilities.structuredOutput) {
    return errorResponse(400, 'structured_output_not_supported', 'Requested model does not support structured output.');
  }

  const requestedMaxOutput = parsed.data.max_completion_tokens ?? parsed.data.max_tokens;
  const modelMaxOutput = typeof resolved.model.limits.maxOutputTokens === 'number'
    ? resolved.model.limits.maxOutputTokens
    : policy.maxOutputTokens;
  const effectiveMaxOutput = Math.min(
    requestedMaxOutput ?? policy.maxOutputTokens,
    policy.maxOutputTokens,
    modelMaxOutput,
  );
  if (requestedMaxOutput && requestedMaxOutput > effectiveMaxOutput) {
    return errorResponse(400, 'max_output_exceeded', 'Requested output limit exceeds the configured policy.');
  }

  const rate = await resolveActiveAiRateCard(resolved.model.id);
  if (!rate) {
    return errorResponse(503, 'commercial_rate_unavailable', 'This model is not commercially ready.');
  }

  const inputTokenUpperBound = conservativeInputTokenUpperBound(body.rawBytes);
  const reservedCredits = estimateAiReservationCredits({
    inputTokenUpperBound,
    maxOutputTokens: BigInt(effectiveMaxOutput),
    rate,
  });
  const requestId = crypto.randomUUID();
  const startedAt = new Date();

  try {
    await db.insert(aiRequests).values({
      id: requestId,
      tenantId: key.tenantId,
      projectId,
      apiKeyId: key.id,
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
        inputTokenUpperBound: inputTokenUpperBound.toString(),
        effectiveMaxOutput,
      },
      startedAt,
    });
  } catch {
    const raced = await resolveIdempotencyReplay({
      tenantId: key.tenantId,
      idempotencyKey,
      requestFingerprint,
    });
    return raced ?? errorResponse(
      503,
      'idempotency_lookup_unavailable',
      'Idempotency state could not be verified safely. The request was not sent upstream.',
    );
  }

  if (!policy.customerInferenceEnabled) {
    await db
      .update(aiRequests)
      .set({
        status: 'provider_unavailable',
        errorCode: 'runtime_disabled',
        completedAt: new Date(),
      })
      .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
    return errorResponse(503, 'runtime_disabled', 'Enterprise AI customer inference is not enabled yet.', requestId);
  }

  let admission;
  try {
    admission = await admitAiCommercialRequest({
      tenantId: key.tenantId,
      projectId,
      apiKeyId: key.id,
      requestId,
      idempotencyKey,
      reservedCredits,
      expiresAt: new Date(startedAt.getTime() + policy.reservationTtlSeconds * 1_000),
      now: startedAt,
    });
  } catch {
    await db
      .update(aiRequests)
      .set({
        status: 'admission_denied',
        errorCode: 'commercial_admission_denied',
        completedAt: new Date(),
      })
      .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
    return errorResponse(402, 'commercial_admission_denied', 'Prepaid credits or budget do not authorize this request.', requestId);
  }

  const providerRate = getManagedAiCostRate(resolved.model.nativeModel)
    ?? getManagedAiCostRateForModel({
      nativeModel: resolved.model.nativeModel,
      providerCostMetadata: resolved.model.providerCostMetadata,
    });
  if (!providerRate) {
    try {
      await releaseAiCommercialRequest({ admission, reason: 'provider_cost_unavailable' });
    } catch {
      await db
        .update(aiRequests)
        .set({
          status: 'reconciliation_required',
          errorCode: 'commercial_reconciliation_required',
          completedAt: new Date(),
        })
        .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
      return errorResponse(503, 'commercial_reconciliation_required', 'Commercial holds require reconciliation.', requestId);
    }

    await db
      .update(aiRequests)
      .set({
        status: 'provider_unavailable',
        errorCode: 'provider_cost_unavailable',
        completedAt: new Date(),
      })
      .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
    return errorResponse(503, 'provider_cost_unavailable', 'Provider cost is not verified for this model.', requestId);
  }

  const estimatedProviderCostUsdMicros = calculateProviderCostUsdMicros({
    rate: providerRate,
    inputTokens: inputTokenUpperBound,
    cachedInputTokens: 0n,
    outputTokens: BigInt(effectiveMaxOutput),
  });
  try {
    await assertEnterpriseAiManagedCostEnvelope({
      tenantId: key.tenantId,
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
      }).where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
      return errorResponse(503, 'commercial_reconciliation_required', 'Commercial holds require reconciliation.', requestId);
    }
    await db.update(aiRequests).set({
      status: 'admission_denied',
      errorCode: 'managed_cost_envelope_exhausted',
      completedAt: new Date(),
    }).where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
    return errorResponse(402, 'prepaid_capacity_exhausted', 'Prepaid Enterprise AI capacity is exhausted. Add funds to continue.', requestId);
  }

  let result;
  try {
    if (resolved.model.providerKey === 'workers-ai') {
      const provider = getManagedWorkersAiProvider();
      result = await provider.complete({
      tenantId: key.tenantId,
      projectId,
      apiKeyId: key.id,
      actorUserId: null,
      requestedModel: resolved.alias.alias,
      messages: parsed.data.messages.map((message) => ({
        role: message.role,
        content: message.content,
        ...(message.name ? { name: message.name } : {}),
        ...(message.tool_call_id ? { toolCallId: message.tool_call_id } : {}),
      })),
      maxOutputTokens: effectiveMaxOutput,
      tools: parsed.data.tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: tool.function.parameters,
      })),
      structuredOutput: parsed.data.response_format
        ? {
            name: parsed.data.response_format.json_schema.name,
            strict: parsed.data.response_format.json_schema.strict,
            schema: parsed.data.response_format.json_schema.schema,
          }
        : undefined,
      idempotencyKey,
      metadata: { requestId },
    }, resolved.model.nativeModel);
    } else {
      const external = await runCentralAi({
        tenantId: key.tenantId,
        projectId,
        apiKeyId: key.id,
        model: resolved.alias.alias,
        messages: parsed.data.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
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
  } catch {
    // Once provider invocation begins, an exception can be ambiguous: the upstream
    // provider may have accepted or completed work even if the Worker lost the
    // response. Preserve commercial holds and require reconciliation rather than
    // releasing value and risking untracked provider spend.
    await db
      .update(aiRequests)
      .set({
        status: 'reconciliation_required',
        errorCode: 'provider_outcome_unknown',
        providerCostMetadata: {
          requestFingerprint,
          inputTokenUpperBound: inputTokenUpperBound.toString(),
          effectiveMaxOutput,
          creditReservationId: admission.creditReservation.id,
          budgetReservationIds: admission.budgetReservations.map((item) => item.id),
          providerOutcome: 'unknown_after_dispatch',
        },
        completedAt: new Date(),
      })
      .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));

    return errorResponse(
      503,
      'provider_outcome_unknown',
      'The provider outcome is unknown and the request is awaiting reconciliation. It will not be sent upstream again.',
      requestId,
    );
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
  const minimumRevenueUsdMicros = minimumCustomerRevenueUsdMicros(providerCostUsdMicros);

  try {
    await settleAiCommercialRequest({
      admission,
      actualCredits,
      settledAt: new Date(),
    });
  } catch {
    await db
      .update(aiRequests)
      .set({
        status: 'reconciliation_required',
        errorCode: 'commercial_reconciliation_required',
        inputTokens: result.usage.inputTokens,
        cachedInputTokens: result.usage.cachedInputTokens,
        outputTokens: result.usage.outputTokens,
        providerCostMetadata: {
          requestFingerprint,
          providerRequestId: result.providerRequestId ?? null,
          providerCostUsdMicros: providerCostUsdMicros.toString(),
          providerCostVerifiedAt: providerRate.verifiedAt,
          minimumRevenueUsdMicros: minimumRevenueUsdMicros.toString(),
          actualCredits: actualCredits.toString(),
          creditReservationId: admission.creditReservation.id,
          budgetReservationIds: admission.budgetReservations.map((item) => item.id),
        },
        completedAt: new Date(),
      })
      .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));
    return errorResponse(
      503,
      'commercial_reconciliation_required',
      'The provider completed the request but accounting requires reconciliation. The request will not be sent upstream again.',
      requestId,
    );
  }

  await db
    .update(aiRequests)
    .set({
      status: 'completed',
      errorCode: null,
      settledCredits: actualCredits,
      inputTokens: result.usage.inputTokens,
      cachedInputTokens: result.usage.cachedInputTokens,
      outputTokens: result.usage.outputTokens,
      providerCostMetadata: {
        requestFingerprint,
        providerRequestId: result.providerRequestId ?? null,
        providerCostUsdMicros: providerCostUsdMicros.toString(),
          providerCostVerifiedAt: providerRate.verifiedAt,
        minimumRevenueUsdMicros: minimumRevenueUsdMicros.toString(),
        actualCredits: actualCredits.toString(),
        creditReservationId: admission.creditReservation.id,
        budgetReservationIds: admission.budgetReservations.map((item) => item.id),
      },
      completedAt: new Date(),
    })
    .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));

  return Response.json({
    id: requestId,
    object: 'chat.completion',
    model: resolved.alias.alias,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: result.text ?? null,
        ...(result.toolCalls?.length
          ? {
              tool_calls: result.toolCalls.map((toolCall, index) => ({
                id: toolCall.id ?? `call_${index + 1}`,
                type: 'function',
                function: {
                  name: toolCall.name,
                  arguments: toolCall.argumentsJson,
                },
              })),
            }
          : {}),
      },
      finish_reason: result.finishReason,
    }],
    usage: {
      prompt_tokens: Number(result.usage.inputTokens),
      completion_tokens: Number(result.usage.outputTokens),
      total_tokens: Number(result.usage.inputTokens + result.usage.outputTokens),
      cached_input_tokens: Number(result.usage.cachedInputTokens),
    },
  });
}


export async function POST(request: Request) {
  return withRequestDatabase(async () => handlePost(request));
}
