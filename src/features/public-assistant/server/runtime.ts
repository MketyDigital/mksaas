import type { Database } from '@/shared/db';

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

function inferPublicRouteDestination(message: string) {
  const normalized = message.toLowerCase();
  const candidates: Array<[RegExp, string]> = [
    [/\b(docs?|documentation)\b/, 'docs'],
    [/\b(price|pricing|plans?|billing|credits?)\b/, 'pricing'],
    [/\b(academy|training|education)\b/, 'academy'],
    [/\b(trading|enterprise|custom)\b/, 'enterprise'],
    [/\b(solutionhub|solution hub|solutions?)\b/, 'solutions'],
    [/\b(automation|automate|deploy|workspaces?)\b/, 'workspaces'],
    [/\b(platform|ai|agents?|agent builder)\b/, 'platform'],
    [/\b(contact|support)\b/, 'contact'],
    [/\b(about|company)\b/, 'about'],
  ];
  return candidates.find(([pattern]) => pattern.test(normalized))?.[1] ?? 'home';
}

function buildToolInput(name: PublicSupportToolName, message: string): Record<string, string> {
  switch (name) {
    case 'search_public_docs':
    case 'search_public_site':
      return { query: message };
    case 'get_public_pricing':
      return {};
    case 'resolve_public_route':
      return { destination: inferPublicRouteDestination(message) };
    case 'get_public_product_summary':
      return { product: message };
  }
}

async function buildGroundedContext(input: {
  database: Database;
  visitorId: string;
  conversationId: string;
  message: string;
}) {
  const toolNames = planPublicSupportTools(input.message);
  const contextParts: string[] = [];

  for (const toolName of toolNames) {
    const toolInput = buildToolInput(toolName, input.message);
    const startedAt = Date.now();
    try {
      const result = await executePublicSupportTool(toolName, toolInput);
      const latencyMs = Date.now() - startedAt;
      await recordPublicAIToolRun(input.database, {
        visitorId: input.visitorId,
        conversationId: input.conversationId,
        toolName,
        status: 'success',
        metadata: { input: toolInput, output: result, latencyMs },
      });
      contextParts.push(`${toolName}: ${JSON.stringify(result)}`);
    } catch (error) {
      await recordPublicAIToolRun(input.database, {
        visitorId: input.visitorId,
        conversationId: input.conversationId,
        toolName,
        status: 'failure',
        metadata: {
          input: toolInput,
          latencyMs: Date.now() - startedAt,
          errorCode: error instanceof Error ? error.name : 'UnknownError',
        },
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
  database: Database;
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
    const existing = await getPublicAIConversation(input.database, input.visitorId, conversationId);
    if (!existing) throw new PublicAssistantRuntimeError('Mkety AI conversation not found.', 404);
  } else {
    const conversation = await createPublicAIConversation(
      input.database,
      input.visitorId,
      input.message,
    );
    if (!conversation) throw new PublicAssistantRuntimeError('Could not start Mkety AI conversation.', 503);
    conversationId = conversation.id;
  }

  await appendPublicAIMessage(input.database, {
    visitorId: input.visitorId,
    conversationId,
    role: 'user',
    content: input.message,
  });

  const conversation = await getPublicAIConversation(
    input.database,
    input.visitorId,
    conversationId,
  );
  if (!conversation) throw new PublicAssistantRuntimeError('Mkety AI conversation not found.', 404);

  const groundedContext = await buildGroundedContext({
    database: input.database,
    visitorId: input.visitorId,
    conversationId,
    message: input.message,
  });
  const targets = resolveProviderTargets(input.environment);
  const primary = targets[0];
  if (!primary) {
    throw new PublicAssistantRuntimeError('Mkety AI provider is not configured.', 503);
  }

  try {
    const response = await runPublicAIGateway({
      request: {
        messages: toProviderMessages(conversation.messages),
        system: buildPublicSystemPrompt(
          groundedContext || 'No additional public Mkety context was retrieved for this question.',
        ),
        maxOutputTokens: 900,
      },
      primary,
      fallbacks: targets.slice(1),
    });

    const answer = response.text.trim();
    if (!answer) {
      throw new PublicAssistantRuntimeError('Mkety AI did not return a usable answer.', 503);
    }

    await appendPublicAIMessage(input.database, {
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
