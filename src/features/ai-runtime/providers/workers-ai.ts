import type {
  AiRuntimeProviderAdapter,
  AiRuntimeRequest,
  AiRuntimeResult,
} from '../runtime/types';

export interface WorkersAiBinding {
  run(
    model: string,
    input: Record<string, unknown>,
    options?: {
      gateway?: {
        id: string;
        skipCache?: boolean;
        cacheTtl?: number;
      };
      rejectIfBusy?: boolean;
    },
  ): Promise<unknown>;
}

type WorkersAiChatResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    finish_reason?: string | null;
    message?: {
      content?: string | Array<{ type?: string; text?: string; content?: string }> | null;
      tool_calls?: Array<{
        id?: string;
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
    };
    input_tokens?: number;
    output_tokens?: number;
    cached_input_tokens?: number;
  };
  response?: string | Array<{ type?: string; text?: string; content?: string }>;
};


function isExplicitCapacityRejection(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /(?:\b429\b|rate.?limit|too many requests|busy|capacity|overloaded)/i.test(message);
}

async function sleep(milliseconds: number) {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function nonNegativeBigInt(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? BigInt(Math.trunc(value))
    : 0n;
}

function normalizeFinishReason(value: unknown): AiRuntimeResult['finishReason'] {
  switch (value) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool_calls':
      return 'tool_calls';
    case 'content_filter':
      return 'content_filter';
    default:
      return 'unknown';
  }
}

function normalizeWorkersAiResponse(
  response: unknown,
  nativeModel: string,
): Omit<AiRuntimeResult, 'requestId' | 'provider'> {
  if (!response || typeof response !== 'object') {
    throw new Error('Workers AI returned an invalid response.');
  }

  const value = response as WorkersAiChatResponse;
  const choice = value.choices?.[0];
  const content = choice?.message?.content;
  const text = typeof content === 'string'
    ? content
    : Array.isArray(content)
      ? content
          .map((part) => {
            if (!part || typeof part !== 'object') return '';
            if (typeof part.text === 'string') return part.text;
            if (typeof part.content === 'string') return part.content;
            return '';
          })
          .join('')
          .trim() || undefined
      : typeof value.response === 'string'
        ? value.response
        : Array.isArray(value.response)
          ? value.response
              .map((part) => {
                if (!part || typeof part !== 'object') return '';
                if (typeof part.text === 'string') return part.text;
                if (typeof part.content === 'string') return part.content;
                return '';
              })
              .join('')
              .trim() || undefined
          : undefined;

  const toolCalls = choice?.message?.tool_calls
    ?.filter((item) => item.function?.name)
    .map((item) => ({
      id: item.id,
      name: item.function!.name!,
      argumentsJson: item.function?.arguments ?? '{}',
    }));

  const usage = value.usage;
  const inputTokens = nonNegativeBigInt(usage?.prompt_tokens ?? usage?.input_tokens);
  const outputTokens = nonNegativeBigInt(usage?.completion_tokens ?? usage?.output_tokens);
  const cachedInputTokens = nonNegativeBigInt(
    usage?.prompt_tokens_details?.cached_tokens ?? usage?.cached_input_tokens,
  );

  return {
    nativeModel: value.model ?? nativeModel,
    text,
    ...(toolCalls?.length ? { toolCalls } : {}),
    finishReason: normalizeFinishReason(choice?.finish_reason),
    usage: {
      inputTokens,
      cachedInputTokens,
      outputTokens,
    },
    providerRequestId: value.id,
  };
}

function mapTools(request: AiRuntimeRequest) {
  if (!request.tools?.length) return undefined;
  return request.tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}

function mapResponseFormat(request: AiRuntimeRequest) {
  if (!request.structuredOutput) return undefined;
  return {
    type: 'json_schema',
    json_schema: {
      name: request.structuredOutput.name ?? 'mkety_output',
      strict: request.structuredOutput.strict ?? true,
      schema: request.structuredOutput.schema,
    },
  };
}

export class WorkersAiProviderAdapter implements AiRuntimeProviderAdapter {
  readonly key = 'workers-ai';

  constructor(
    private readonly binding: WorkersAiBinding,
    private readonly options: {
      gatewayId: string;
      cacheTtlSeconds?: number;
    },
  ) {}

  async complete(request: AiRuntimeRequest, nativeModel: string): Promise<AiRuntimeResult> {
    let response: unknown;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        response = await this.binding.run(
      nativeModel,
      {
        messages: request.messages.map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.name ? { name: message.name } : {}),
          ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
        })),
        stream: false,
        ...(nativeModel === '@cf/google/gemma-4-26b-a4b-it'
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
        ...(request.maxOutputTokens ? { max_completion_tokens: request.maxOutputTokens } : {}),
        ...(request.tools?.length ? { tools: mapTools(request) } : {}),
        ...(request.structuredOutput ? { response_format: mapResponseFormat(request) } : {}),
        ...(nativeModel === '@cf/google/gemma-4-26b-a4b-it'
          ? { chat_template_kwargs: { enable_thinking: false } }
          : {}),
      },
      {
        rejectIfBusy: true,
        gateway: {
          id: this.options.gatewayId,
          // AI-01 does not enable response caching by default. The orchestration
          // layer must explicitly establish cache eligibility first.
          skipCache: this.options.cacheTtlSeconds === undefined,
          ...(this.options.cacheTtlSeconds !== undefined
            ? { cacheTtl: this.options.cacheTtlSeconds }
            : {}),
        },
      },
    );
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
        if (!isExplicitCapacityRejection(error) || attempt === 2) throw error;
        await sleep(150 * 2 ** attempt);
      }
    }
    if (lastError) throw lastError;

    const normalized = normalizeWorkersAiResponse(response, nativeModel);
    if (!normalized.text && !normalized.toolCalls?.length) {
      const record = response && typeof response === 'object'
        ? response as Record<string, unknown>
        : {};
      const choice = Array.isArray(record.choices) && record.choices[0] && typeof record.choices[0] === 'object'
        ? record.choices[0] as Record<string, unknown>
        : {};
      const message = choice.message && typeof choice.message === 'object'
        ? choice.message as Record<string, unknown>
        : {};
      console.warn('Workers AI returned no normalized text/tool call', {
        nativeModel,
        topLevelKeys: Object.keys(record).sort(),
        choiceKeys: Object.keys(choice).sort(),
        messageKeys: Object.keys(message).sort(),
        responseType: typeof record.response,
        responseArray: Array.isArray(record.response),
        contentType: typeof message.content,
        contentArray: Array.isArray(message.content),
        usageKeys: record.usage && typeof record.usage === 'object'
          ? Object.keys(record.usage as Record<string, unknown>).sort()
          : [],
      });
      throw new Error('Workers AI returned no assistant text or tool call.');
    }
    return {
      requestId: crypto.randomUUID(),
      provider: this.key,
      ...normalized,
    };
  }
}
