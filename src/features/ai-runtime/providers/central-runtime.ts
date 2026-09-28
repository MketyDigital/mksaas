import type { CentralAiGenerateResponse, CentralAiMessage, CentralAiProviderId } from './external-types';
import { getManagedWorkersAiProvider } from './runtime.cloudflare';
import { type ManagedAiTaskClass, routeManagedAiTask } from '../managed-model-policy';
import { resolveByokProviderConnection } from '../server/provider-connections';

export type CentralAiExecutionSource = 'managed' | 'byok';

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
    const response = await adapter.generate({
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
  const nativeModel = input.model?.trim() || decision.model.nativeModel;
  const result = await getManagedWorkersAiProvider().complete({
    tenantId: input.tenantId,
    projectId,
    apiKeyId: input.apiKeyId ?? null,
    actorUserId: input.actorUserId ?? null,
    requestedModel: decision.alias,
    messages: [
      { role: 'system', content: input.system },
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
