export type ManagedModelCandidate = {
  alias: string;
  providerKey: 'cloudflare-workers-ai';
  nativeModel: string;
  displayName: string;
  stage: 'day-one' | 'benchmark';
  capabilities: {
    text: true;
    vision: boolean;
    embeddings: false;
    tools: boolean;
    reasoning: boolean;
    structuredOutput: boolean;
  };
  limits: { contextTokens: number };
  providerCostReference: {
    inputPerMillionUsd: number;
    outputPerMillionUsd: number;
    cachedInputPerMillionUsd?: number;
    verifiedOn: string;
  };
};

export const INITIAL_MANAGED_MODEL_CANDIDATES: readonly ManagedModelCandidate[] = [
  {
    alias: 'mkety-gemma',
    providerKey: 'cloudflare-workers-ai',
    nativeModel: '@cf/google/gemma-4-26b-a4b-it',
    displayName: 'Gemma 4 26B A4B',
    stage: 'day-one',
    capabilities: { text: true, vision: true, embeddings: false, tools: true, reasoning: true, structuredOutput: true },
    limits: { contextTokens: 256000 },
    providerCostReference: { inputPerMillionUsd: 0.10, outputPerMillionUsd: 0.30, verifiedOn: '2026-09-28' },
  },
  {
    alias: 'mkety-glm-flash',
    providerKey: 'cloudflare-workers-ai',
    nativeModel: '@cf/zai-org/glm-5.3-flash',
    displayName: 'GLM-5.3 Flash',
    stage: 'benchmark',
    capabilities: { text: true, vision: true, embeddings: false, tools: true, reasoning: true, structuredOutput: true },
    limits: { contextTokens: 1310720 },
    providerCostReference: { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.50, cachedInputPerMillionUsd: 0.03, verifiedOn: '2026-09-28' },
  },
  {
    alias: 'mkety-qwen',
    providerKey: 'cloudflare-workers-ai',
    nativeModel: '@cf/qwen/qwen3.8-27b',
    displayName: 'Qwen 3.8 27B',
    stage: 'benchmark',
    capabilities: { text: true, vision: true, embeddings: false, tools: true, reasoning: true, structuredOutput: true },
    limits: { contextTokens: 262144 },
    providerCostReference: { inputPerMillionUsd: 0.45, outputPerMillionUsd: 3.20, cachedInputPerMillionUsd: 0.05, verifiedOn: '2026-09-28' },
  },
] as const;

export function getManagedModelCandidate(alias: string) {
  return INITIAL_MANAGED_MODEL_CANDIDATES.find((model) => model.alias === alias) ?? null;
}
