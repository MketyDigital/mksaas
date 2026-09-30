export const CENTRAL_AI_PROVIDER_IDS = [
  'openai',
  'azure-openai',
  'gemini',
  'vertex',
  'cloudflare-ai',
  'bedrock',
  'openai-compatible',
] as const;

export type CentralAiProviderId = (typeof CENTRAL_AI_PROVIDER_IDS)[number];

export type CentralAiMessageRole = 'system' | 'user' | 'assistant';

export interface CentralAiMessage {
  role: CentralAiMessageRole;
  content: string;
}

export interface CentralAiGenerateRequest {
  model: string;
  system: string;
  messages: CentralAiMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface CentralAiUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface CentralAiGenerateResponse {
  text: string;
  usage?: CentralAiUsage;
  providerRequestId?: string;
}

export interface CentralAiProviderAdapter {
  id: CentralAiProviderId;
  generate(request: CentralAiGenerateRequest): Promise<CentralAiGenerateResponse>;
}

export interface CentralAiProviderError extends Error {
  retryable?: boolean;
  status?: number;
}

export function createCentralAiProviderError(
  message: string,
  options: { retryable: boolean; status?: number },
): CentralAiProviderError {
  return Object.assign(new Error(message), options);
}
