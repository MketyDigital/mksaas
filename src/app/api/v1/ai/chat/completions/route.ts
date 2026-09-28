import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { authenticateAiApiKey } from '@/features/ai-runtime/server/api-auth';
import { hasEnterpriseAiApiAccess } from '@/features/ai-runtime/server/access';
import { authorizeAiBudget } from '@/features/ai-runtime/server/budget-authorization';
import { resolveAiModelRoute } from '@/features/ai-runtime/server/model-routing';
import { db } from '@/shared/db/cloudflare';
import { aiRequests } from '@/shared/db/schema';

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

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 1_000_000) {
    return Response.json({ error: { code: 'request_too_large', message: 'Request body is too large.' } }, { status: 413 });
  }

  const key = await authenticateAiApiKey(request, 'ai:chat');
  if (!key) return Response.json({ error: { code: 'unauthorized', message: 'Invalid API key.' } }, { status: 401 });
  if (!(await hasEnterpriseAiApiAccess(key.tenantId))) {
    return Response.json({ error: { code: 'forbidden', message: 'Enterprise AI API access is not enabled.' } }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: { code: 'invalid_request', message: 'Invalid chat completion request.' } }, { status: 400 });
  }

  const projectHeader = request.headers.get('x-mkety-project-id');
  const projectId = key.projectId ?? projectHeader ?? null;
  if (key.projectId && projectHeader && projectHeader !== key.projectId) {
    return Response.json({ error: { code: 'project_scope_mismatch', message: 'API key is not valid for this project.' } }, { status: 403 });
  }

  const idempotencyKey = request.headers.get('idempotency-key')?.trim();
  if (!idempotencyKey || idempotencyKey.length > 180) {
    return Response.json({ error: { code: 'idempotency_key_required', message: 'A valid Idempotency-Key header is required.' } }, { status: 400 });
  }

  const resolved = await resolveAiModelRoute({ tenantId: key.tenantId, projectId, requestedModel: parsed.data.model });
  if (!resolved) {
    return Response.json({ error: { code: 'model_not_allowed', message: 'Requested model is not available for this tenant.' } }, { status: 403 });
  }

  const maxOutput = parsed.data.max_completion_tokens ?? parsed.data.max_tokens;
  const modelMaxOutput = typeof resolved.model.limits.maxOutputTokens === 'number'
    ? resolved.model.limits.maxOutputTokens
    : undefined;
  if (maxOutput && modelMaxOutput && maxOutput > modelMaxOutput) {
    return Response.json({ error: { code: 'max_output_exceeded', message: 'Requested output limit exceeds the model policy.' } }, { status: 400 });
  }

  const budget = await authorizeAiBudget({ tenantId: key.tenantId, projectId, apiKeyId: key.id });
  if (!budget.ok) {
    return Response.json({ error: { code: budget.code, message: 'AI budget does not authorize this request.' } }, { status: 402 });
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
      completedAt: new Date(),
    });
  } catch {
    return Response.json({ error: { code: 'duplicate_request', message: 'This idempotency key has already been used.' } }, { status: 409 });
  }

  return Response.json({
    error: {
      code: 'provider_unavailable',
      message: 'Managed inference is not enabled on this AI-01 foundation route yet.',
      request_id: requestId,
    },
  }, { status: 503 });
}
