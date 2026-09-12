import { extractGeminiText } from './gemini';
import { readProviderJson } from './http';
import type { PublicAIProviderAdapter } from './types';

export function createVertexPublicAdapter(input: {
  accessToken: string;
  location: string;
  projectId: string;
}): PublicAIProviderAdapter {
  return {
    id: 'vertex',
    async generate(request) {
      const host =
        input.location === 'global' ? 'aiplatform.googleapis.com' : `${input.location}-aiplatform.googleapis.com`;
      const url = `https://${host}/v1/projects/${encodeURIComponent(input.projectId)}/locations/${encodeURIComponent(input.location)}/publishers/google/models/${encodeURIComponent(request.model)}:generateContent`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: request.messages
            .filter((message) => message.role !== 'system')
            .map((message) => ({
              role: message.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: message.content }],
            })),
          generationConfig: { maxOutputTokens: request.maxOutputTokens ?? 900 },
        }),
        signal: request.signal,
      });
      const payload = await readProviderJson(response);
      return { text: extractGeminiText(payload) };
    },
  };
}
