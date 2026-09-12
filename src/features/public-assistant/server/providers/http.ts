import { createPublicAIProviderError } from './types';

export async function readProviderJson(response: Response): Promise<Record<string, unknown>> {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await response.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const retryable =
      response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500;
    throw createPublicAIProviderError(`Public AI provider request failed (${response.status}).`, {
      retryable,
      status: response.status,
    });
  }

  return payload;
}

export function extractOpenAIResponseText(payload: Record<string, unknown>): string {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) return payload.output_text.trim();
  const output = Array.isArray(payload.output) ? payload.output : [];
  const parts: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') continue;
    const content = Array.isArray((item as { content?: unknown }).content)
      ? (item as { content: unknown[] }).content
      : [];
    for (const part of content) {
      if (!part || typeof part !== 'object') continue;
      const text = (part as { text?: unknown }).text;
      if (typeof text === 'string') parts.push(text);
    }
  }
  return parts.join('\n').trim();
}
