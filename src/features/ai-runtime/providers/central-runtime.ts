import type { CentralAiGenerateRequest, CentralAiGenerateResponse, CentralAiMessage, CentralAiProviderAdapter, CentralAiProviderId } from './external-types';
import { getManagedWorkersAiProvider } from './runtime.cloudflare';
import { MANAGED_AI_MODEL_ALIASES, type ManagedAiTaskClass, routeManagedAiTask } from '../managed-model-policy';
import { resolveAiModelRoute } from '../server/model-routing';
import { resolveByokProviderConnection, resolveSystemAiProviderConnection } from '../server/provider-connections';

export type CentralAiExecutionSource = 'managed' | 'byok';

function safeRetryableProviderError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const status = (error as { status?: unknown }).status;
  return status === 429;
}

async function generateWithSafeCapacityRetries(
  adapter: CentralAiProviderAdapter,
  request: CentralAiGenerateRequest,
) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await adapter.generate(request);
    } catch (error) {
      lastError = error;
      if (!safeRetryableProviderError(error) || attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
    }
  }
  throw lastError;
}

export type CentralAiExecutionResult = CentralAiGenerateResponse & {
  provider: CentralAiProviderId | 'workers-ai';
  nativeModel: string;
  source: CentralAiExecutionSource;
  toolCalls?: Array<{ id?: string; name: string; argumentsJson: string }>;
  finishReason?: string;
};

function defaultByokModel(provider: CentralAiProviderId) {
  switch (provider) {
    case 'openai':
      return 'gpt-5.6-luna';
    case 'azure-openai':
      return 'gpt-5.6-terra';
    case 'gemini':
    case 'vertex':
      return 'gemini-3.8-flash';
    case 'cloudflare-ai':
      return '@cf/zai-org/glm-5.3-flash';
    case 'bedrock':
      return 'global.anthropic.claude-sonnet-5';
    case 'openai-compatible':
      return 'default';
  }
}

export async function runCentralAi(input: {
  tenantId: string;
  projectId?: string | null;
  actorUserId?: string | null;
  apiKeyId?: string | null;
  messages: CentralAiMessage[];
  system: string;
  taskClass?: ManagedAiTaskClass;
  model?: string | null;
  maxOutputTokens?: number;
  temperature?: number;
  providerConnectionId?: string | null;
  idempotencyKey?: string;
  tools?: Array<{ name: string; description?: string; inputSchema: Record<string, unknown> }>;
}): Promise<CentralAiExecutionResult> {
  const projectId = input.projectId ?? null;
  const idempotencyKey = input.idempotencyKey ?? `central-${crypto.randomUUID()}`;

  if (input.providerConnectionId) {
    if (input.tools?.length) {
      throw new Error('Tool calling is not yet enabled for external BYOK adapters.');
    }
    const { adapter } = await resolveByokProviderConnection({
      tenantId: input.tenantId,
      projectId,
      connectionId: input.providerConnectionId,
    });
    const model = input.model?.trim() || defaultByokModel(adapter.id);
    const response = await generateWithSafeCapacityRetries(adapter, {
      model,
      system: input.system,
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
    });
    return {
      ...response,
      provider: adapter.id,
      nativeModel: model,
      source: 'byok',
    };
  }

  const decision = routeManagedAiTask(input.taskClass ?? 'smart');
  const requestedAlias: string =
    input.model === MANAGED_AI_MODEL_ALIASES.economy || input.model === MANAGED_AI_MODEL_ALIASES.smart
      ? input.model
      : decision.alias;
  const resolved = await resolveAiModelRoute({
    tenantId: input.tenantId,
    projectId,
    requestedModel: requestedAlias,
  });
  if (!resolved) {
    throw new Error(`Managed AI route is unavailable for alias: ${requestedAlias}`);
  }
  const nativeModel = resolved.model.nativeModel;
  if (resolved.model.providerKey !== 'workers-ai') {
    if (!['openai', 'azure-openai', 'gemini', 'vertex', 'cloudflare-ai', 'bedrock', 'openai-compatible'].includes(resolved.model.providerKey)) {
      throw new Error(`Managed Mkety AI provider is unsupported: ${resolved.model.providerKey}`);
    }
    if (input.tools?.length) {
      throw new Error('Tool calling is not yet enabled for external managed adapters.');
    }
    const { adapter } = await resolveSystemAiProviderConnection({
      mode: 'platform',
      providerKey: resolved.model.providerKey as CentralAiProviderId,
    });
    const response = await generateWithSafeCapacityRetries(adapter, {
      model: nativeModel,
      system: input.system,
      messages: input.messages,
      maxOutputTokens: input.maxOutputTokens,
      temperature: input.temperature,
    });
    return {
      ...response,
      provider: adapter.id,
      nativeModel,
      source: 'managed',
    };
  }

  const result = await getManagedWorkersAiProvider().complete({
    tenantId: input.tenantId,
    projectId,
    apiKeyId: input.apiKeyId ?? null,
    actorUserId: input.actorUserId ?? null,
    requestedModel: requestedAlias,
    messages: [
      ...(input.system.trim() ? [{ role: 'system' as const, content: input.system.trim() }] : []),
      ...input.messages,
    ],
    maxOutputTokens: input.maxOutputTokens,
    tools: input.tools,
    idempotencyKey,
  }, nativeModel);

  return {
    text: result.text ?? '',
    usage: {
      inputTokens: Number(result.usage.inputTokens),
      outputTokens: Number(result.usage.outputTokens),
      totalTokens: Number(result.usage.inputTokens + result.usage.outputTokens),
    },
    providerRequestId: result.providerRequestId,
    provider: 'workers-ai',
    nativeModel,
    source: 'managed',
    toolCalls: result.toolCalls,
    finishReason: result.finishReason,
  };
}
