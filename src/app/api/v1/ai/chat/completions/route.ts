import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { hasEnterpriseAiApiAccess } from '@/features/ai-runtime/server/access';
import { authenticateAiApiKey } from '@/features/ai-runtime/server/api-auth';
import {
  admitAiCommercialRequest,
  releaseAiCommercialRequest,
} from '@/features/ai-runtime/server/commercial-admission';
import { conservativeInputTokenUpperBound } from '@/features/ai-runtime/server/commercial-estimation';
import { getEnterpriseAiRuntimePolicy } from '@/features/ai-runtime/server/commercial-policy';
import {
  estimateAiReservationCredits,
  resolveActiveAiRateCard,
} from '@/features/ai-runtime/server/commercial-rates';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import { db } from '@/shared/db/cloudflare';
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
  tools: z.array(z.unknown()).max(256).optional(),
  response_format: z.unknown().optional(),
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

function duplicateResponse(existing: typeof aiRequests.$inferSelect) {
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

export async function POST(request: Request) {
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

  const existing = await db.query.aiRequests.findFirst({
    where: and(
      eq(aiRequests.tenantId, key.tenantId),
      eq(aiRequests.idempotencyKey, idempotencyKey),
    ),
  });

  if (existing) {
    const existingFingerprint = typeof existing.providerCostMetadata.requestFingerprint === 'string'
      ? existing.providerCostMetadata.requestFingerprint
      : null;
    if (existingFingerprint !== requestFingerprint) {
      return errorResponse(409, 'idempotency_conflict', 'Idempotency-Key was already used with a different request.');
    }
    return duplicateResponse(existing);
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
    const raced = await db.query.aiRequests.findFirst({
      where: and(
        eq(aiRequests.tenantId, key.tenantId),
        eq(aiRequests.idempotencyKey, idempotencyKey),
      ),
    });
    const racedFingerprint = raced && typeof raced.providerCostMetadata.requestFingerprint === 'string'
      ? raced.providerCostMetadata.requestFingerprint
      : null;
    if (raced && racedFingerprint === requestFingerprint) return duplicateResponse(raced);
    return errorResponse(409, 'idempotency_conflict', 'Idempotency-Key was already used with a different request.');
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

  try {
    await releaseAiCommercialRequest({
      admission,
      reason: 'provider_unavailable',
    });
  } catch {
    await db
      .update(aiRequests)
      .set({
        status: 'reconciliation_required',
        errorCode: 'commercial_reconciliation_required',
        providerCostMetadata: {
          requestFingerprint,
          inputTokenUpperBound: inputTokenUpperBound.toString(),
          effectiveMaxOutput,
          creditReservationId: admission.creditReservation.id,
          budgetReservationIds: admission.budgetReservations.map((item) => item.id),
        },
        completedAt: new Date(),
      })
      .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));

    return errorResponse(
      503,
      'commercial_reconciliation_required',
      'Request was not sent to a provider and its commercial holds require reconciliation.',
      requestId,
    );
  }

  await db
    .update(aiRequests)
    .set({
      status: 'provider_unavailable',
      errorCode: 'provider_unavailable',
      providerCostMetadata: {
        requestFingerprint,
        inputTokenUpperBound: inputTokenUpperBound.toString(),
        effectiveMaxOutput,
        creditReservationId: admission.creditReservation.id,
        budgetReservationIds: admission.budgetReservations.map((item) => item.id),
      },
      completedAt: new Date(),
    })
    .where(and(eq(aiRequests.id, requestId), eq(aiRequests.tenantId, key.tenantId)));

  return errorResponse(
    503,
    'provider_unavailable',
    'Commercial admission passed and was released; managed inference is still disabled on this route.',
    requestId,
  );
}
