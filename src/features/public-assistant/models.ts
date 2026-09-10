export type PublicAIProviderId =
  | 'openai'
  | 'azure-openai'
  | 'gemini'
  | 'vertex'
  | 'cloudflare-ai'
  | 'bedrock';

export type PublicAIModelStatus = 'current-stable' | 'current-limited';

export interface PublicAIModelDefinition {
  id: string;
  status: PublicAIModelStatus;
}

interface PublicAIProviderModelDefinition {
  defaultModel: string;
  models: readonly PublicAIModelDefinition[];
}

export const PUBLIC_AI_MODEL_REGISTRY: Record<PublicAIProviderId, PublicAIProviderModelDefinition> = {
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
};

export function getDefaultPublicAIModel(provider: PublicAIProviderId): string {
  return PUBLIC_AI_MODEL_REGISTRY[provider].defaultModel;
}

export function getPublicAIModelDefinition(
  provider: PublicAIProviderId,
  model: string,
): PublicAIModelDefinition | undefined {
  return PUBLIC_AI_MODEL_REGISTRY[provider].models.find((candidate) => candidate.id === model);
}

export function assertCurrentPublicAIModel(
  provider: PublicAIProviderId,
  model: string,
): PublicAIModelDefinition {
  const definition = getPublicAIModelDefinition(provider, model);
  if (!definition) {
    throw new Error(`${provider}/${model} is not an approved current public AI model.`);
  }

  return definition;
}
