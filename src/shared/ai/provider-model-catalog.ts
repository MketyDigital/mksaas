/** Pure versioned provider/model choices shared by Platform surfaces and Assist. */
export const MKETY_AI_PROVIDER_MODEL_CATALOG_VERSION = 1;

export type MketyAiModelStatus = 'current-stable' | 'current-limited';

export interface MketyAiProviderModelDefinition {
  defaultModel: string;
  models: readonly { id: string; status: MketyAiModelStatus }[];
}

export const MKETY_AI_PROVIDER_MODEL_CATALOG = {
  'workers-ai': {
    defaultModel: '@cf/google/gemma-4-26b-a4b-it',
    models: [
      { id: '@cf/google/gemma-4-26b-a4b-it', status: 'current-stable' },
      { id: '@cf/zai-org/glm-5.3-flash', status: 'current-stable' },
    ],
  },
  openai: {
    defaultModel: 'gpt-5.6-luna',
    models: [
      { id: 'gpt-6-astra', status: 'current-limited' },
      { id: 'gpt-5.6-sol', status: 'current-stable' },
      { id: 'gpt-5.6-terra', status: 'current-stable' },
      { id: 'gpt-5.6-luna', status: 'current-stable' },
    ],
  },
  'azure-openai': {
    defaultModel: 'gpt-5.6-terra',
    models: [
      { id: 'gpt-6-astra', status: 'current-limited' },
      { id: 'gpt-6-luna-1', status: 'current-stable' },
      { id: 'gpt-5.6-sol', status: 'current-stable' },
      { id: 'gpt-5.6-terra', status: 'current-stable' },
      { id: 'gpt-5.6-luna', status: 'current-stable' },
    ],
  },
  gemini: {
    defaultModel: 'gemini-3.8-flash',
    models: [
      { id: 'gemini-3.8-flash', status: 'current-stable' },
      { id: 'gemini-3.7-flash', status: 'current-stable' },
      { id: 'gemini-3.6-flash', status: 'current-stable' },
      { id: 'gemini-3.5-flash-lite', status: 'current-stable' },
      { id: 'gemini-3.1-pro-preview', status: 'current-limited' },
    ],
  },
  vertex: {
    defaultModel: 'gemini-3.8-flash',
    models: [
      { id: 'gemini-3.8-flash', status: 'current-stable' },
      { id: 'gemini-3.7-flash', status: 'current-stable' },
      { id: 'gemini-3.6-flash', status: 'current-stable' },
      { id: 'gemini-3.1-pro-preview', status: 'current-limited' },
    ],
  },
  'cloudflare-ai': {
    defaultModel: '@cf/qwen/qwen3.8-27b',
    models: [
      { id: '@cf/qwen/qwen3.8-27b', status: 'current-stable' },
      { id: '@cf/meta/llama-4-scout-17b-16e-instruct', status: 'current-stable' },
      { id: '@cf/qwen/qwen3-30b-a3b-fp8', status: 'current-stable' },
    ],
  },
  bedrock: {
    defaultModel: 'global.anthropic.claude-sonnet-5',
    models: [
      { id: 'global.anthropic.claude-sonnet-5', status: 'current-stable' },
      { id: 'anthropic.claude-sonnet-5', status: 'current-stable' },
      { id: 'global.amazon.nova-2-lite-v1:0', status: 'current-stable' },
      { id: 'amazon.nova-2-lite-v1:0', status: 'current-stable' },
    ],
  },
} as const satisfies Record<string, MketyAiProviderModelDefinition>;

export type MketyAiCatalogProviderId = keyof typeof MKETY_AI_PROVIDER_MODEL_CATALOG;

export function getMketyAiModelSuggestions(provider: string): string[] {
  const catalogProvider = provider === 'azure-foundry' ? 'azure-openai' : provider;
  if (!Object.hasOwn(MKETY_AI_PROVIDER_MODEL_CATALOG, catalogProvider)) return [];
  return MKETY_AI_PROVIDER_MODEL_CATALOG[catalogProvider as MketyAiCatalogProviderId].models.map(({ id }) => id);
}
