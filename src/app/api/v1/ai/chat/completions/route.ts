import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { authenticateAiApiKey } from '@/features/ai-runtime/server/api-auth';
import { hasEnterpriseAiApiAccess } from '@/features/ai-runtime/server/access';
import { authorizeAiBudget } from '@/features/ai-runtime/server/budget-authorization';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import { db } from '@/shared/db/cloudflare';
import { aiRequests, projects } from '@/shared/db/schema';

const MAX_REQUEST_BYTES = 1_000_000;

const requestSchema = z.object({
  model: z.string().min(1).max(128),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().max(100_000),
    name: z.string().max(128).optional(),
    tool_call_id: z.string().max(160).optional(),
  })).min(1).max(128),
  max_tokens: z.number().int().positive().max(32_768).optional(),
  max_completion_tokens: z.number().int().positive().max(32_768).optional(),
  stream: z.boolean().optional().default(false),
  tools: z.array(z.unknown()).max(64).optional(),
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

async function readJsonBody(request: Request) {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_REQUEST_BYTES) return { tooLarge: true as const };

  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) return { tooLarge: true as const };

  try {
    return { tooLarge: false as const, value: JSON.parse(raw) as unknown };
  } catch {
    return { tooLarge: false as const, value: null };
  }
}

export async function POST(request: Request) {
  const key = await authenticateAiApiKey(request, 'ai:chat');
  if (!key) return errorResponse(401, 'unauthorized', 'Invalid API key.');

  if (!(await hasEnterpriseAiApiAccess(key.tenantId))) {
    return errorResponse(403, 'forbidden', 'Enterprise AI API access is not enabled.');
  }

  const body = await readJsonBody(request);
  if (body.tooLarge) return errorResponse(413, 'request_too_large', 'Request body is too large.');

  const parsed = requestSchema.safeParse(body.value);
  if (!parsed.success) {
    return errorResponse(400, 'invalid_request', 'Invalid chat completion request.');
  }

  if (parsed.data.stream) {
    return errorResponse(501, 'streaming_not_enabled', 'Streaming is not enabled on the AI-01 foundation route yet.');
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
  if (!idempotencyKey || idempotencyKey.length > 180) {
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
    return errorResponse(
      existing.status === 'provider_unavailable' ? 503 : 409,
      existing.errorCode ?? 'duplicate_request',
      existing.status === 'provider_unavailable'
        ? 'Managed inference is not enabled on this AI-01 foundation route yet.'
        : 'This request has already been accepted.',
      existing.id,
    );
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

  const maxOutput = parsed.data.max_completion_tokens ?? parsed.data.max_tokens;
  const modelMaxOutput = typeof resolved.model.limits.maxOutputTokens === 'number'
    ? resolved.model.limits.maxOutputTokens
    : undefined;
  if (maxOutput && modelMaxOutput && maxOutput > modelMaxOutput) {
    return errorResponse(400, 'max_output_exceeded', 'Requested output limit exceeds the model policy.');
  }

  const budget = await authorizeAiBudget({
    tenantId: key.tenantId,
    projectId,
    apiKeyId: key.id,
  });
  if (!budget.ok) {
    return errorResponse(402, budget.code, 'AI budget does not authorize this request.');
  }

  const requestId = crypto.randomUUID();

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
      status: 'provider_unavailable',
      errorCode: 'provider_unavailable',
      providerCostMetadata: { requestFingerprint },
      completedAt: new Date(),
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
    if (raced && racedFingerprint === requestFingerprint) {
      return errorResponse(503, 'provider_unavailable', 'Managed inference is not enabled on this AI-01 foundation route yet.', raced.id);
    }
    return errorResponse(409, 'idempotency_conflict', 'Idempotency-Key was already used with a different request.');
  }

  return errorResponse(
    503,
    'provider_unavailable',
    'Managed inference is not enabled on this AI-01 foundation route yet.',
    requestId,
  );
}
