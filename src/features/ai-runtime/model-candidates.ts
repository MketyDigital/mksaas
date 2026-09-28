export interface ManagedAiModelCandidate {
  key: 'gemma-4' | 'glm-5.3-flash' | 'qwen-3.8-27b';
  providerKey: 'workers-ai';
  nativeModel: string;
  displayName: string;
  status: 'approved-candidate' | 'benchmark-candidate';
  capabilities: {
    text: true;
    vision: boolean;
    embeddings: false;
    tools: boolean;
    reasoning: boolean;
    structuredOutput: boolean;
  };
  contextTokens: number;
  pricingUsdPerMillionTokens: {
    input: number;
    output: number;
    cachedInput?: number;
  };
}

export const MANAGED_AI_MODEL_CANDIDATES: readonly ManagedAiModelCandidate[] = [
  {
    key: 'gemma-4',
    providerKey: 'workers-ai',
    nativeModel: '@cf/google/gemma-4-26b-a4b-it',
    displayName: 'Gemma 4 26B A4B',
    status: 'approved-candidate',
    capabilities: {
      text: true,
      vision: true,
      embeddings: false,
      tools: true,
      reasoning: true,
      structuredOutput: true,
    },
    contextTokens: 256_000,
    pricingUsdPerMillionTokens: {
      input: 0.10,
      output: 0.30,
    },
  },
  {
    key: 'glm-5.3-flash',
    providerKey: 'workers-ai',
    nativeModel: '@cf/zai-org/glm-5.3-flash',
    displayName: 'GLM-5.3 Flash',
    status: 'benchmark-candidate',
    capabilities: {
      text: true,
      vision: true,
      embeddings: false,
      tools: true,
      reasoning: true,
      structuredOutput: true,
    },
    contextTokens: 1_310_720,
    pricingUsdPerMillionTokens: {
      input: 0.15,
      output: 0.50,
      cachedInput: 0.03,
    },
  },
  {
    key: 'qwen-3.8-27b',
    providerKey: 'workers-ai',
    nativeModel: '@cf/qwen/qwen3.8-27b',
    displayName: 'Qwen 3.8 27B',
    status: 'benchmark-candidate',
    capabilities: {
      text: true,
      vision: true,
      embeddings: false,
      tools: true,
      reasoning: true,
      structuredOutput: true,
    },
    contextTokens: 262_144,
    pricingUsdPerMillionTokens: {
      input: 0.45,
      output: 3.20,
      cachedInput: 0.05,
    },
  },
] as const;

export function getManagedAiModelCandidate(key: ManagedAiModelCandidate['key']) {
  return MANAGED_AI_MODEL_CANDIDATES.find((model) => model.key === key);
}
