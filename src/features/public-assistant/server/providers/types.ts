import type { PublicAIProviderId } from '../../models';

export type PublicAIProviderMessageRole = 'system' | 'user' | 'assistant';

export interface PublicAIProviderMessage {
  role: PublicAIProviderMessageRole;
  content: string;
}

export interface PublicAIProviderRequest {
  model: string;
  system: string;
  messages: PublicAIProviderMessage[];
  maxOutputTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
}

export interface PublicAIProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface PublicAIProviderResponse {
  text: string;
  usage?: PublicAIProviderUsage;
  providerRequestId?: string;
}

export interface PublicAIProviderAdapter {
  id: PublicAIProviderId;
  generate(request: PublicAIProviderRequest): Promise<PublicAIProviderResponse>;
}

export interface PublicAIProviderError extends Error {
  retryable?: boolean;
  status?: number;
}

export function createPublicAIProviderError(
  message: string,
  options: { retryable: boolean; status?: number },
): PublicAIProviderError {
  return Object.assign(new Error(message), options);
}
