export type AiRuntimeRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AiRuntimeMessage {
  role: AiRuntimeRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface AiRuntimeToolDefinition {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
}

export interface AiRuntimeStructuredOutput {
  name?: string;
  schema: Record<string, unknown>;
  strict?: boolean;
}

export interface AiRuntimeRequest {
  tenantId: string;
  projectId: string | null;
  apiKeyId: string | null;
  actorUserId: string | null;
  requestedModel: string;
  messages: AiRuntimeMessage[];
  maxOutputTokens?: number;
  tools?: AiRuntimeToolDefinition[];
  structuredOutput?: AiRuntimeStructuredOutput;
  metadata?: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AiRuntimeUsage {
  inputTokens: bigint;
  cachedInputTokens: bigint;
  outputTokens: bigint;
}

export type AiRuntimeFinishReason =
  | 'stop'
  | 'length'
  | 'tool_calls'
  | 'content_filter'
  | 'error'
  | 'unknown';

export interface AiRuntimeResult {
  requestId: string;
  provider: string;
  nativeModel: string;
  text?: string;
  finishReason: AiRuntimeFinishReason;
  usage: AiRuntimeUsage;
  providerRequestId?: string;
}

export interface AiRuntimeProviderAdapter {
  readonly key: string;
  complete(request: AiRuntimeRequest, nativeModel: string): Promise<AiRuntimeResult>;
}
