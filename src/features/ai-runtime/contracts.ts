export type AiRuntimeRole = 'system' | 'user' | 'assistant' | 'tool';

export type AiRuntimeMessage = {
  role: AiRuntimeRole;
  content: string;
  name?: string;
  toolCallId?: string;
};

export type AiRuntimeTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type AiRuntimeRequest = {
  tenantId: string;
  projectId?: string | null;
  apiKeyId?: string | null;
  actorUserId?: string | null;
  requestedModel: string;
  messages: AiRuntimeMessage[];
  maxOutputTokens?: number;
  tools?: AiRuntimeTool[];
  responseFormat?: { type: 'text' | 'json_object' | 'json_schema'; schema?: Record<string, unknown> };
  metadata?: Record<string, string>;
  idempotencyKey: string;
};

export type AiRuntimeUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type AiRuntimeResult = {
  requestId: string;
  model: string;
  content: string;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'error';
  usage: AiRuntimeUsage;
  providerRequestId?: string;
};

export type AiRuntimeProviderErrorCode =
  | 'provider_unavailable'
  | 'provider_timeout'
  | 'provider_rate_limited'
  | 'provider_rejected'
  | 'provider_error';

export class AiRuntimeProviderError extends Error {
  constructor(public readonly code: AiRuntimeProviderErrorCode, message = 'AI provider is unavailable.') {
    super(message);
    this.name = 'AiRuntimeProviderError';
  }
}

export interface AiProviderAdapter {
  readonly providerKey: string;
  generate(input: AiRuntimeRequest, route: { nativeModel: string }): Promise<AiRuntimeResult>;
}
