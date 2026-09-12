import { readProviderJson } from './http';
import type { PublicAIProviderAdapter } from './types';

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
  const authorization = `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return {
    Authorization: authorization,
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

export function createBedrockPublicAdapter(input: {
  accessKeyId: string;
  region: string;
  secretAccessKey: string;
  sessionToken?: string;
}): PublicAIProviderAdapter {
  return {
    id: 'bedrock',
    async generate(request) {
      const host = `bedrock-runtime.${input.region}.amazonaws.com`;
      const path = `/model/${encodeURIComponent(request.model)}/converse`;
      const body = JSON.stringify({
        system: [{ text: request.system }],
        messages: request.messages
          .filter((message) => message.role !== 'system')
          .map((message) => ({
            role: message.role === 'assistant' ? 'assistant' : 'user',
            content: [{ text: message.content }],
          })),
        inferenceConfig: { maxTokens: request.maxOutputTokens ?? 900 },
      });
      const headers = await buildBedrockHeaders({
        accessKeyId: input.accessKeyId,
        body,
        host,
        path,
        region: input.region,
        secretAccessKey: input.secretAccessKey,
        sessionToken: input.sessionToken,
      });
      const response = await fetch(`https://${host}${path}`, {
        method: 'POST',
        headers,
        body,
        signal: request.signal,
      });
      const payload = await readProviderJson(response);
      const usage = payload.usage as
        | { inputTokens?: unknown; outputTokens?: unknown; totalTokens?: unknown }
        | undefined;
      return {
        text: extractBedrockText(payload),
        usage: usage
          ? {
              inputTokens: Number(usage.inputTokens) || undefined,
              outputTokens: Number(usage.outputTokens) || undefined,
              totalTokens: Number(usage.totalTokens) || undefined,
            }
          : undefined,
      };
    },
  };
}
