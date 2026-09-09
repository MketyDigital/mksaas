import { extractOpenAIResponseText, readProviderJson } from './http';
import type { PublicAIProviderAdapter } from './types';

export function createOpenAIPublicAdapter(apiKey: string): PublicAIProviderAdapter {
  return {
    id: 'openai',
    async generate(request) {
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          instructions: request.system,
          input: request.messages.map((message) => ({ role: message.role, content: message.content })),
          reasoning: { effort: 'none' },
          max_output_tokens: request.maxOutputTokens ?? 900,
        }),
        signal: request.signal,
      });
      const payload = await readProviderJson(response);
      return {
        text: extractOpenAIResponseText(payload),
        providerRequestId: response.headers.get('x-request-id') ?? undefined,
        usage: typeof payload.usage === 'object' && payload.usage
          ? {
              inputTokens: Number((payload.usage as { input_tokens?: unknown }).input_tokens) || undefined,
              outputTokens: Number((payload.usage as { output_tokens?: unknown }).output_tokens) || undefined,
              totalTokens: Number((payload.usage as { total_tokens?: unknown }).total_tokens) || undefined,
            }
          : undefined,
      };
    },
  };
}
