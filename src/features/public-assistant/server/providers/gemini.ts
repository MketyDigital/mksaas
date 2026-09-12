import { readProviderJson } from './http';
import type { PublicAIProviderAdapter } from './types';

function extractGeminiText(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const first = candidates[0];
  if (!first || typeof first !== 'object') return '';
  const content = (first as { content?: unknown }).content;
  if (!content || typeof content !== 'object') return '';
  const parts = Array.isArray((content as { parts?: unknown }).parts) ? (content as { parts: unknown[] }).parts : [];
  return parts
    .map((part) =>
      part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : '',
    )
    .join('\n')
    .trim();
}

export function createGeminiPublicAdapter(apiKey: string): PublicAIProviderAdapter {
  return {
    id: 'gemini',
    async generate(request) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: request.system }] },
            contents: request.messages
              .filter((message) => message.role !== 'system')
              .map((message) => ({
                role: message.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: message.content }],
              })),
            generationConfig: {
              maxOutputTokens: request.maxOutputTokens ?? 900,
              ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
            },
          }),
          signal: request.signal,
        },
      );
      const payload = await readProviderJson(response);
      const usage = payload.usageMetadata as
        | { promptTokenCount?: unknown; candidatesTokenCount?: unknown; totalTokenCount?: unknown }
        | undefined;
      return {
        text: extractGeminiText(payload),
        usage: usage
          ? {
              inputTokens: Number(usage.promptTokenCount) || undefined,
              outputTokens: Number(usage.candidatesTokenCount) || undefined,
              totalTokens: Number(usage.totalTokenCount) || undefined,
            }
          : undefined,
      };
    },
  };
}

export { extractGeminiText };
