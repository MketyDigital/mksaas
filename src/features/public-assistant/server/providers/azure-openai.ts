import { extractOpenAIResponseText, readProviderJson } from './http';
import type { PublicAIProviderAdapter } from './types';

export function createAzureOpenAIPublicAdapter(input: {
  apiKey: string;
  endpoint: string;
  deployment: string;
}): PublicAIProviderAdapter {
  const base = input.endpoint.replace(/\/+$/, '');
  return {
    id: 'azure-openai',
    async generate(request) {
      const response = await fetch(`${base}/openai/v1/responses`, {
        method: 'POST',
        headers: {
          'api-key': input.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.deployment,
          instructions: request.system,
          input: request.messages.map((message) => ({ role: message.role, content: message.content })),
          max_output_tokens: request.maxOutputTokens ?? 900,
        }),
        signal: request.signal,
      });
      const payload = await readProviderJson(response);
      return {
        text: extractOpenAIResponseText(payload),
        providerRequestId: response.headers.get('x-ms-request-id') ?? undefined,
      };
    },
  };
}
