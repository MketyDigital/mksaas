import { readProviderJson } from './http';
import type { PublicAIProviderAdapter } from './types';

function extractCloudflareText(payload: Record<string, unknown>): string {
  const result = payload.result;
  if (typeof result === 'string') return result.trim();
  if (!result || typeof result !== 'object') return '';
  const response = (result as { response?: unknown }).response;
  if (typeof response === 'string') return response.trim();
  const text = (result as { text?: unknown }).text;
  return typeof text === 'string' ? text.trim() : '';
}

export function createCloudflareAIPublicAdapter(input: {
  accountId: string;
  apiToken: string;
}): PublicAIProviderAdapter {
  return {
    id: 'cloudflare-ai',
    async generate(request) {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(input.accountId)}/ai/run/${request.model}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.apiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              { role: 'system', content: request.system },
              ...request.messages.map((message) => ({ role: message.role, content: message.content })),
            ],
            max_tokens: request.maxOutputTokens ?? 900,
          }),
          signal: request.signal,
        },
      );
      const payload = await readProviderJson(response);
      return { text: extractCloudflareText(payload) };
    },
  };
}
