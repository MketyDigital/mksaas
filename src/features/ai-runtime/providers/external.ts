import { extractGeminiText, extractOpenAIChatText, extractOpenAIResponseText, readCentralProviderJson } from './external-http';
import type { CentralAiProviderAdapter, CentralAiProviderId } from './external-types';
import { assertPublicHttpsUrl } from '@/shared/security/outbound-url';

export type CentralAiProviderCredentials =
  | { provider: 'openai'; apiKey: string }
  | { provider: 'azure-openai'; apiKey: string; endpoint: string; deployment: string }
  | { provider: 'gemini'; apiKey: string }
  | { provider: 'vertex'; accessToken: string; location: string; projectId: string }
  | { provider: 'cloudflare-ai'; accountId: string; apiToken: string }
  | { provider: 'bedrock'; accessKeyId: string; secretAccessKey: string; sessionToken?: string; region: string }
  | { provider: 'openai-compatible'; apiKey: string; endpoint: string };

function bytes(value: string | Uint8Array): Uint8Array<ArrayBuffer> {
  return typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value);
}

async function sha256(value: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(value)));
}

function toHex(value: Uint8Array) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hmac(key: string | Uint8Array, value: string): Promise<Uint8Array<ArrayBuffer>> {
  const imported = await crypto.subtle.importKey('raw', bytes(key), { hash: 'SHA-256', name: 'HMAC' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', imported, bytes(value)));
}

function awsTimestamp(date: Date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

async function buildBedrockHeaders(input: {
  accessKeyId: string;
  body: string;
  host: string;
  path: string;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
}) {
  const now = new Date();
  const amzDate = awsTimestamp(now);
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = toHex(await sha256(input.body));
  const headerPairs: Array<[string, string]> = [
    ['content-type', 'application/json'],
    ['host', input.host],
    ['x-amz-content-sha256', payloadHash],
    ['x-amz-date', amzDate],
  ];
  if (input.sessionToken) headerPairs.push(['x-amz-security-token', input.sessionToken]);
  headerPairs.sort(([a], [b]) => a.localeCompare(b));
  const canonicalHeaders = headerPairs.map(([name, value]) => `${name}:${value.trim()}\n`).join('');
  const signedHeaders = headerPairs.map(([name]) => name).join(';');
  const canonicalRequest = ['POST', input.path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${input.region}/bedrock/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${toHex(await sha256(canonicalRequest))}`;
  const dateKey = await hmac(`AWS4${input.secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, input.region);
  const serviceKey = await hmac(regionKey, 'bedrock');
  const signingKey = await hmac(serviceKey, 'aws4_request');
  const signature = toHex(await hmac(signingKey, stringToSign));
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    'Content-Type': 'application/json',
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
    ...(input.sessionToken ? { 'x-amz-security-token': input.sessionToken } : {}),
  };
}

function extractBedrockText(payload: Record<string, unknown>) {
  const output = payload.output;
  if (!output || typeof output !== 'object') return '';
  const message = (output as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return '';
  const content = Array.isArray((message as { content?: unknown }).content)
    ? (message as { content: unknown[] }).content
    : [];
  return content
    .map((part) =>
      part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string'
        ? (part as { text: string }).text
        : '',
    )
    .join('\n')
    .trim();
}

export function createCentralExternalProvider(credentials: CentralAiProviderCredentials): CentralAiProviderAdapter {
  switch (credentials.provider) {
    case 'openai':
      return {
        id: 'openai',
        async generate(request) {
          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: request.model,
              instructions: request.system,
              input: request.messages.map((message) => ({ role: message.role, content: message.content })),
              max_output_tokens: request.maxOutputTokens ?? 900,
              ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
            }),
            signal: request.signal,
          });
          const payload = await readCentralProviderJson(response);
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
    case 'azure-openai': {
      const base = assertPublicHttpsUrl(credentials.endpoint, {
        label: 'Azure OpenAI endpoint',
        allowedSuffixes: ['.openai.azure.com', '.services.ai.azure.com'],
      }).toString().replace(/\/+$/, '');
      return {
        id: 'azure-openai',
        async generate(request) {
          const response = await fetch(`${base}/openai/v1/responses`, {
            method: 'POST',
            headers: { 'api-key': credentials.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: credentials.deployment,
              instructions: request.system,
              input: request.messages.map((message) => ({ role: message.role, content: message.content })),
              max_output_tokens: request.maxOutputTokens ?? 900,
            }),
            signal: request.signal,
          });
          const payload = await readCentralProviderJson(response);
          return { text: extractOpenAIResponseText(payload), providerRequestId: response.headers.get('x-ms-request-id') ?? undefined };
        },
      };
    }
    case 'gemini':
      return {
        id: 'gemini',
        async generate(request) {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(credentials.apiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                systemInstruction: { parts: [{ text: request.system }] },
                contents: request.messages
                  .filter((message) => message.role !== 'system')
                  .map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
                generationConfig: {
                  maxOutputTokens: request.maxOutputTokens ?? 900,
                  ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
                },
              }),
              signal: request.signal,
            },
          );
          const payload = await readCentralProviderJson(response);
          const usage = payload.usageMetadata as { promptTokenCount?: unknown; candidatesTokenCount?: unknown; totalTokenCount?: unknown } | undefined;
          return {
            text: extractGeminiText(payload),
            usage: usage ? {
              inputTokens: Number(usage.promptTokenCount) || undefined,
              outputTokens: Number(usage.candidatesTokenCount) || undefined,
              totalTokens: Number(usage.totalTokenCount) || undefined,
            } : undefined,
          };
        },
      };
    case 'vertex':
      return {
        id: 'vertex',
        async generate(request) {
          const host = credentials.location === 'global' ? 'aiplatform.googleapis.com' : `${credentials.location}-aiplatform.googleapis.com`;
          const url = `https://${host}/v1/projects/${encodeURIComponent(credentials.projectId)}/locations/${encodeURIComponent(credentials.location)}/publishers/google/models/${encodeURIComponent(request.model)}:generateContent`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Bearer ${credentials.accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: request.system }] },
              contents: request.messages
                .filter((message) => message.role !== 'system')
                .map((message) => ({ role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] })),
              generationConfig: { maxOutputTokens: request.maxOutputTokens ?? 900 },
            }),
            signal: request.signal,
          });
          const payload = await readCentralProviderJson(response);
          return { text: extractGeminiText(payload), providerRequestId: response.headers.get('x-request-id') ?? undefined };
        },
      };
    case 'cloudflare-ai':
      return {
        id: 'cloudflare-ai',
        async generate(request) {
          const response = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(credentials.accountId)}/ai/run/${request.model}`,
            {
              method: 'POST',
              headers: { Authorization: `Bearer ${credentials.apiToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                messages: [{ role: 'system', content: request.system }, ...request.messages],
                max_tokens: request.maxOutputTokens ?? 900,
              }),
              signal: request.signal,
            },
          );
          const payload = await readCentralProviderJson(response);
          const result = payload.result;
          const text = typeof result === 'string'
            ? result.trim()
            : result && typeof result === 'object' && typeof (result as { response?: unknown }).response === 'string'
              ? String((result as { response: string }).response).trim()
              : '';
          return { text };
        },
      };
    case 'openai-compatible': {
      const base = assertPublicHttpsUrl(credentials.endpoint, {
        label: 'OpenAI-compatible endpoint',
      }).toString().replace(/\/+$/, '');
      return {
        id: 'openai-compatible',
        async generate(request) {
          const response = await fetch(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${credentials.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: request.model,
              messages: [
                ...(request.system.trim() ? [{ role: 'system', content: request.system }] : []),
                ...request.messages,
              ],
              max_tokens: request.maxOutputTokens ?? 900,
              ...(typeof request.temperature === 'number' ? { temperature: request.temperature } : {}),
            }),
            signal: request.signal,
          });
          const payload = await readCentralProviderJson(response);
          const usage = payload.usage as { prompt_tokens?: unknown; completion_tokens?: unknown; total_tokens?: unknown } | undefined;
          return {
            text: extractOpenAIChatText(payload),
            providerRequestId: response.headers.get('x-request-id') ?? undefined,
            usage: usage ? {
              inputTokens: Number(usage.prompt_tokens) || undefined,
              outputTokens: Number(usage.completion_tokens) || undefined,
              totalTokens: Number(usage.total_tokens) || undefined,
            } : undefined,
          };
        },
      };
    }
    case 'bedrock':
      return {
        id: 'bedrock',
        async generate(request) {
          const host = `bedrock-runtime.${credentials.region}.amazonaws.com`;
          const path = `/model/${encodeURIComponent(request.model)}/converse`;
          const body = JSON.stringify({
            system: [{ text: request.system }],
            messages: request.messages
              .filter((message) => message.role !== 'system')
              .map((message) => ({ role: message.role === 'assistant' ? 'assistant' : 'user', content: [{ text: message.content }] })),
            inferenceConfig: { maxTokens: request.maxOutputTokens ?? 900 },
          });
          const headers = await buildBedrockHeaders({
            accessKeyId: credentials.accessKeyId,
            body,
            host,
            path,
            region: credentials.region,
            secretAccessKey: credentials.secretAccessKey,
            sessionToken: credentials.sessionToken,
          });
          const response = await fetch(`https://${host}${path}`, { method: 'POST', headers, body, signal: request.signal });
          const payload = await readCentralProviderJson(response);
          const usage = payload.usage as { inputTokens?: unknown; outputTokens?: unknown; totalTokens?: unknown } | undefined;
          return {
            text: extractBedrockText(payload),
            usage: usage ? {
              inputTokens: Number(usage.inputTokens) || undefined,
              outputTokens: Number(usage.outputTokens) || undefined,
              totalTokens: Number(usage.totalTokens) || undefined,
            } : undefined,
          };
        },
      };
  }
}

export function isCentralAiProviderId(value: string): value is CentralAiProviderId {
  return ['openai', 'azure-openai', 'gemini', 'vertex', 'cloudflare-ai', 'bedrock', 'openai-compatible'].includes(value);
}
