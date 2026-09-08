import {
  parsePublicAIProviderConfig,
  type PublicAssistantEnvironment,
} from '../config';
import { getDefaultPublicAIModel } from '../models';
import { type PublicAIProviderTarget, runPublicAIGateway } from './gateway';
import {
  appendPublicAIMessage,
  createPublicAIConversation,
  getPublicAIConversation,
  recordPublicAIToolRun,
} from './memory';
import { createPublicAIProviderAdapters } from './providers';
import { buildPublicSystemPrompt, planPublicSupportTools } from './support';
import { executePublicSupportTool, type PublicSupportToolName } from './tools';

export class PublicAssistantRuntimeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PublicAssistantRuntimeError';
  }
}

function toProviderMessages(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
  return messages
    .filter((message) => ['user', 'assistant', 'system'].includes(message.role))
    .map((message) => ({
      role: message.role as 'user' | 'assistant' | 'system',
      content: message.content,
    }));
}

async function buildGroundedContext(input: {
  visitorId: string;
  conversationId: string;
  message: string;
}) {
  const plans = planPublicSupportTools(input.message);
  const contextParts: string[] = [];

  for (const plan of plans) {
    const startedAt = Date.now();
    try {
      const result = await executePublicSupportTool(plan.name, plan.input);
      await recordPublicAIToolRun({
        visitorId: input.visitorId,
        conversationId: input.conversationId,
        toolName: plan.name,
        input: plan.input,
        output: result,
        status: 'success',
        latencyMs: Date.now() - startedAt,
      });
      contextParts.push(`${plan.name}: ${JSON.stringify(result)}`);
    } catch (error) {
      await recordPublicAIToolRun({
        visitorId: input.visitorId,
        conversationId: input.conversationId,
        toolName: plan.name,
        input: plan.input,
        status: 'error',
        latencyMs: Date.now() - startedAt,
        errorCode: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  return contextParts.join('\n\n');
}

function resolveProviderTargets(environment: PublicAssistantEnvironment): PublicAIProviderTarget[] {
  const config = parsePublicAIProviderConfig(environment);
  const requestedProviders = [config.primaryProvider, ...config.fallbackProviders];
  const adapters = createPublicAIProviderAdapters(requestedProviders, environment);
  const targetByProvider = new Map(adapters.map((adapter) => [adapter.id, adapter]));

  return requestedProviders.flatMap((provider) => {
    const adapter = targetByProvider.get(provider);
    if (!adapter) return [];
    const model = provider === config.primaryProvider
      ? config.model
      : getDefaultPublicAIModel(provider);
    return [{ adapter, model }];
  });
}

export async function runMketyPublicAssistant(input: {
  visitorId: string;
  conversationId?: string;
  message: string;
  environment: PublicAssistantEnvironment;
}) {
  const config = parsePublicAIProviderConfig(input.environment);
  if (!config.enabled) {
    throw new PublicAssistantRuntimeError('Mkety AI is currently unavailable.', 503);
  }

  let conversationId = input.conversationId;
  if (conversationId) {
    const existing = await getPublicAIConversation(input.visitorId, conversationId);
    if (!existing) throw new PublicAssistantRuntimeError('Mkety AI conversation not found.', 404);
  } else {
    const conversation = await createPublicAIConversation(input.visitorId, input.message);
    if (!conversation) throw new PublicAssistantRuntimeError('Could not start Mkety AI conversation.', 503);
    conversationId = conversation.id;
  }

  await appendPublicAIMessage({
    visitorId: input.visitorId,
    conversationId,
    role: 'user',
    content: input.message,
  });

  const conversation = await getPublicAIConversation(input.visitorId, conversationId);
  if (!conversation) throw new PublicAssistantRuntimeError('Mkety AI conversation not found.', 404);

  const groundedContext = await buildGroundedContext({
    visitorId: input.visitorId,
    conversationId,
    message: input.message,
  });
  const targets = resolveProviderTargets(input.environment);
  const primary = targets[0];
  if (!primary) {
    throw new PublicAssistantRuntimeError('Mkety AI provider is not configured.', 503);
  }

  const providerMessages = toProviderMessages(conversation.messages);
  if (groundedContext) {
    providerMessages.push({
      role: 'system',
      content: `Relevant current public Mkety information:\n${groundedContext}`,
    });
  }

  try {
    const response = await runPublicAIGateway({
      request: {
        messages: providerMessages,
        system: buildPublicSystemPrompt(),
        maxOutputTokens: 900,
      },
      primary,
      fallbacks: targets.slice(1),
    });

    const answer = response.text.trim();
    if (!answer) {
      throw new PublicAssistantRuntimeError('Mkety AI did not return a usable answer.', 503);
    }

    await appendPublicAIMessage({
      visitorId: input.visitorId,
      conversationId,
      role: 'assistant',
      content: answer,
      metadata: {
        provider: response.providerId,
        fallbackCount: response.fallbackCount,
        usage: response.usage,
      },
    });

    return {
      answer,
      conversationId,
    };
  } catch (error) {
    if (error instanceof PublicAssistantRuntimeError) throw error;
    throw new PublicAssistantRuntimeError('Mkety AI is temporarily unavailable. Please try again.', 503);
  }
}