import { eq } from 'drizzle-orm';

import type { Database } from '@/shared/db';
import { platformSiteSettings } from '@/shared/db/schema';

import { type PublicAIProviderTarget, runPublicAIGateway } from './gateway';
import {
  appendPublicAIMessage,
  createPublicAIConversation,
  getPublicAIConversation,
  recordPublicAIToolRun,
} from './memory';
import { createPublicAIProviderAdapters } from './providers';
import { buildPublicSystemPrompt, planPublicSupportTools, sanitizePublicAssistantAnswer } from './support';
import { getPublicPricingKnowledge } from './knowledge';
import { executePublicSupportTool, type PublicSupportToolName } from './tools';
import { parsePublicAIProviderConfig, type PublicAssistantEnvironment } from '../config';
import { getDefaultPublicAIModel } from '../models';

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
    [/\b(mkety media|media\.mkety\.com)\b/, 'media'],
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

const PRICING_REQUEST_PATTERN = /\b(price|pricing|plan|plans|cost|billing|subscription)\b/i;
const ACADEMY_ACCESS_PATTERN = /\b(academy|training|education)\b/i;
const MEDIA_REQUEST_PATTERN = /\b(mkety media|media\.mkety\.com)\b/i;
const MEDIA_DESTINATION_REQUEST_PATTERN = /\b(where|access|open|visit|go to|link|website|url|products?|features?|plans?|pricing|signup|sign up|join)\b/i;
const ACCESS_REQUEST_PATTERN = /\b(where|access|open|visit|go to|link|website|url)\b/i;

function normalizeMoneyLabel(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

async function ensureCriticalPublicFacts(message: string, answer: string) {
  const additions: string[] = [];

  if (PRICING_REQUEST_PATTERN.test(message)) {
    const plans = (await getPublicPricingKnowledge()).filter((plan) => plan.key !== 'enterprise');
    const missing = plans.filter((plan) => {
      const price = normalizeMoneyLabel(plan.priceLabel);
      return !answer.toLowerCase().includes(plan.name.toLowerCase()) || !answer.includes(price);
    });

    if (missing.length > 0) {
      additions.push(
        `Current self-service pricing: ${plans
          .map((plan) => `${plan.name} — ${normalizeMoneyLabel(plan.priceLabel)}${plan.billingLabel ? ` ${plan.billingLabel}` : ''}`)
          .join('; ')}.`,
      );
    }
  }

  if (
    ACADEMY_ACCESS_PATTERN.test(message) &&
    ACCESS_REQUEST_PATTERN.test(message) &&
    !/academy\.mkety\.com/i.test(answer)
  ) {
    additions.push('Mkety Academy access: https://academy.mkety.com.');
  }

  if (
    MEDIA_REQUEST_PATTERN.test(message) &&
    MEDIA_DESTINATION_REQUEST_PATTERN.test(message) &&
    !/media\.mkety\.com/i.test(answer)
  ) {
    additions.push(
      'Mkety Media: https://media.mkety.com for current Starter, Growth and Business plan prices/quotas, Enterprise options, product details and signup.',
    );
  }

  return additions.length ? `${answer.trim()} ${additions.join(' ')}` : answer;
}

function detectLeadMetadata(message: string) {
  const email = message.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i)?.[0];
  const phone = message.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.trim();
  if (!email && !phone) return undefined;
  return { leadCapture: true, ...(email ? { email } : {}), ...(phone ? { phone } : {}) };
}

async function getPublicSupportSettings(database: Database) {
  const row = await database.query.platformSiteSettings.findFirst({
    where: eq(platformSiteSettings.environment, 'production'),
  });
  return {
    supportEmail: row?.contactEmail ?? 'support@mkety.com',
    salesEmail: row?.salesEmail ?? 'hello@mkety.com',
    telegramHref: row?.telegramHref ?? 'https://t.me/mketyadmin',
    promptExtension: row?.publicAiPrompt ?? undefined,
    fallbackMessage:
      row?.publicAiFallbackMessage ??
      'Mkety AI is temporarily unavailable. You can continue with Mkety support by email or Telegram.',
    leadCaptureEnabled: row?.publicAiLeadCaptureEnabled ?? true,
  };
}

function resolveProviderTargets(environment: PublicAssistantEnvironment): PublicAIProviderTarget[] {
  const config = parsePublicAIProviderConfig(environment);
  const requestedProviders = [config.primaryProvider, ...config.fallbackProviders];
  const adapters = createPublicAIProviderAdapters(requestedProviders, environment);
  const targetByProvider = new Map(adapters.map((adapter) => [adapter.id, adapter]));

  return requestedProviders.flatMap((provider) => {
    const adapter = targetByProvider.get(provider);
    if (!adapter) return [];
    const model = provider === config.primaryProvider ? config.model : getDefaultPublicAIModel(provider);
    return [{ adapter, model }];
  });
}

function buildDeterministicSupportFallback(settings: {
  fallbackMessage: string;
  supportEmail: string;
  salesEmail: string;
  telegramHref: string;
}) {
  return [
    settings.fallbackMessage,
    settings.supportEmail ? `[Email Mkety support](mailto:${settings.supportEmail})` : null,
    settings.telegramHref ? `[Message Mkety on Telegram](${settings.telegramHref})` : null,
    settings.salesEmail ? `[Email Mkety sales](mailto:${settings.salesEmail})` : null,
  ].filter(Boolean).join(' ');
}

async function returnDeterministicFallback(input: {
  database: Database;
  visitorId: string;
  conversationId: string;
  settings: {
    fallbackMessage: string;
    supportEmail: string;
    salesEmail: string;
    telegramHref: string;
  };
}) {
  const answer = buildDeterministicSupportFallback(input.settings);
  await appendPublicAIMessage(input.database, {
    visitorId: input.visitorId,
    conversationId: input.conversationId,
    role: 'assistant',
    content: answer,
    metadata: { deterministicFallback: true },
  });
  return { answer, conversationId: input.conversationId };
}

export async function runMketyPublicAssistant(input: {
  database: Database;
  visitorId: string;
  conversationId?: string;
  message: string;
  environment: PublicAssistantEnvironment;
}) {
  const config = parsePublicAIProviderConfig(input.environment);

  let conversationId = input.conversationId;
  if (conversationId) {
    const existing = await getPublicAIConversation(input.database, input.visitorId, conversationId);
    if (!existing) throw new PublicAssistantRuntimeError('Mkety AI conversation not found.', 404);
  } else {
    const conversation = await createPublicAIConversation(input.database, input.visitorId, input.message);
    if (!conversation) throw new PublicAssistantRuntimeError('Could not start Mkety AI conversation.', 503);
    conversationId = conversation.id;
  }

  const supportSettings = await getPublicSupportSettings(input.database);
  const leadMetadata = supportSettings.leadCaptureEnabled ? detectLeadMetadata(input.message) : undefined;

  await appendPublicAIMessage(input.database, {
    visitorId: input.visitorId,
    conversationId,
    role: 'user',
    content: input.message,
    metadata: leadMetadata,
  });

  if (!config.enabled) {
    return returnDeterministicFallback({
      database: input.database,
      visitorId: input.visitorId,
      conversationId,
      settings: supportSettings,
    });
  }

  const conversation = await getPublicAIConversation(input.database, input.visitorId, conversationId);
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
    return returnDeterministicFallback({
      database: input.database,
      visitorId: input.visitorId,
      conversationId,
      settings: supportSettings,
    });
  }

  try {
    const response = await runPublicAIGateway({
      request: {
        messages: toProviderMessages(conversation.messages),
        system: buildPublicSystemPrompt(
          groundedContext || 'No additional public Mkety context was retrieved for this question.',
          supportSettings,
        ),
        maxOutputTokens: 900,
      },
      primary,
      fallbacks: targets.slice(1),
    });

    const answer = await ensureCriticalPublicFacts(
      input.message,
      sanitizePublicAssistantAnswer(response.text),
    );
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
    if (error instanceof PublicAssistantRuntimeError && error.status < 500) throw error;
    return returnDeterministicFallback({
      database: input.database,
      visitorId: input.visitorId,
      conversationId,
      settings: supportSettings,
    });
  }
}
