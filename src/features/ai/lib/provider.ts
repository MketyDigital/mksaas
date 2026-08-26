import { createOpenAI } from '@ai-sdk/openai';

import { env } from '@/shared/lib/env';

export type MketyAIProvider = 'openai' | 'groq' | 'openrouter' | 'custom';

type AIProvider = ReturnType<typeof createOpenAI>;

/**
 * Mkety AI provider abstraction.
 *
 * All currently supported providers expose an OpenAI-compatible chat API, which
 * lets the platform keep one application-level AI interface while remaining
 * portable across providers. Providers are opt-in through environment values;
 * no fake credentials are required for disabled providers.
 */
export function getAIProvider(): AIProvider {
  switch (env.MKETY_AI_PROVIDER) {
    case 'groq':
      if (!env.GROQ_API_KEY) throw new Error('Groq provider is enabled but GROQ_API_KEY is not configured.');
      return createOpenAI({ apiKey: env.GROQ_API_KEY, baseURL: env.GROQ_BASE_URL, name: 'groq' });

    case 'openrouter':
      if (!env.OPENROUTER_API_KEY) throw new Error('OpenRouter provider is enabled but OPENROUTER_API_KEY is not configured.');
      return createOpenAI({ apiKey: env.OPENROUTER_API_KEY, baseURL: env.OPENROUTER_BASE_URL, name: 'openrouter' });

    case 'custom':
      if (!env.MKETY_AI_API_KEY || !env.MKETY_AI_BASE_URL) {
        throw new Error('Custom AI provider requires MKETY_AI_API_KEY and MKETY_AI_BASE_URL.');
      }
      return createOpenAI({ apiKey: env.MKETY_AI_API_KEY, baseURL: env.MKETY_AI_BASE_URL, name: 'mkety-custom' });

    case 'openai':
    default:
      if (!env.OPENAI_API_KEY) throw new Error('OpenAI provider is enabled but OPENAI_API_KEY is not configured.');
      return createOpenAI({ apiKey: env.OPENAI_API_KEY, name: 'openai' });
  }
}

export function getAIModel() {
  return env.MKETY_AI_MODEL;
}
