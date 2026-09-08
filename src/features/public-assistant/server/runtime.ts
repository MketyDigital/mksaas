import {
  parsePublicAIProviderConfig,
  type PublicAssistantEnvironment,
} from '../config';
import { getDefaultPublicAIModel } from '../models';
import { runPublicAIGateway, type PublicAIProviderTarget } from './gateway';
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

function toolInput(name: PublicSupportToolName, message: string) {
  switch (name) {
    case 'search_public_docs':
    case 'search_public_site':
      return { query: message };
    case 'get_public_pricing':
      return {};
    case 'resolve_public_route':
      return { destination: message };
    case 'get_public_product_summary':
      return { product: message };
  }
}

async function buildPublicContext(input: {
  conversationId: string;
  message: string;
  visitorId: string;
}) {
  const plannedTools = planPublicSupportTools(input.message);
  const context: Array<{ name: PublicSupportToolName; result: unknown }> = [];

  for (const name of plannedTools) {
    try {
      const result = await executePublicSupportTool(name, toolInput(name, input.message));
      context.push({ name, result });
      await recordPublicAIToolRun({
        visitorId: input.visitorId,
        conversationId: input.conversationId,
        toolName: name,
        status: 'success',
      });
    } catch (error) {
      await recordPublicAIToolRun({
        visitorId: input.visitorId,
        conversationId: input.conversationId,
        toolName: name,
        status: 'failure',
        metadata: { errorName: error instanceof Error ? error.name : 'UnknownError' },
      }).catch(() => undefined);
    }
  }

  return JSON.stringify(context).slice(0, 12_000);
}

function resolveProviderTargets(
  environment: PublicAssistantEnvironment,
): { primary: PublicAIProviderTarget; fallbacks: PublicAIProviderTarget[] } {
  const config = parsePublicAIProviderConfig(environment);
  if (!config.enabled) throw new PublicAssistantRuntimeError('Mkety AI is currently unavailable.', 503);

  const providerIds = [config.primaryProvider, ...config.fallbackProviders];
  const adapters = createPublicAIProviderAdapters(providerIds, environment);
  const adapterById = new Map(adapters.map((adapter) => [adapter.id, adapter]));
  const primaryAdapter = adapterById.get(config.primaryProvider);
  if (!primaryAdapter) {
    throw new PublicAssistantRuntimeError('Mkety AI is currently unavailable.', 503);
  }

  const primary: PublicAIProviderTarget = {
    adapter: primaryAdapter,
    model: config.model,
  };
  const fallbacks = config.fallbackProviders.flatMap((providerId) => {
    const adapter = adapterById.get(providerId);
    return adapter ? [{ adapter, model: getDefaultPublicAIModel(providerId) }] : [];
  });

  return { primary, fallbacks };
}

export async function runMketyPublicAssistant(input: {
  conversationId?: string;
  environment: PublicAssistantEnvironment;
  message: string;
  visitorId: string;
}) {
  let conversation;
  if (input.conversationId) {
    const existing = await getPublicAIConversation(input.visitorId, input.conversationId);
    if (!existing) throw new PublicAssistantRuntimeError('Conversation not found.', 404);
    conversation = existing.conversation;
  } else {
    conversation = await createPublicAIConversation(input.visitorId, input.message);
  }

  await appendPublicAIMessage({
    visitorId: input.visitorId,
    conversationId: conversation.id,
    role: 'user',
    content: input.message,
  });

  const history = await getPublicAIConversation(input.visitorId, conversation.id);
  if (!history) throw new PublicAssistantRuntimeError('Conversation not found.', 404);

  const publicContext = await buildPublicContext({
    conversationId: conversation.id,
    message: input.message,
    visitorId: input.visitorId,
  });
  const targets = resolveProviderTargets(input.environment);
  const result = await runPublicAIGateway({
    primary: targets.primary,
    fallbacks: targets.fallbacks,
    request: {
      system: buildPublicSystemPrompt(publicContext),
      messages: history.messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => ({
          role: message.role as 'user' | 'assistant',
          content: message.content,
        })),
      maxOutputTokens: 900,
    },
  });

  const answer = result.text.trim() || 'I could not produce a useful response just now. Please try again.';
  await appendPublicAIMessage({
    visitorId: input.visitorId,
    conversationId: conversation.id,
    role: 'assistant',
    content: answer,
    metadata: {
      providerId: result.providerId,
      fallbackCount: result.fallbackCount,
      usage: result.usage,
    },
  });

  return {
    answer,
    conversationId: conversation.id,
  };
}
