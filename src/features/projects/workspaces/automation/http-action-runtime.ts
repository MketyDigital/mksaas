import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

const HTTP_TIMEOUT_MS = 10_000;
const MAX_RESPONSE_BYTES = 262_144;
const MAX_PREVIEW_CHARS = 4_096;
const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export type AutomationHttpExecutionInput = {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  url: string;
  body?: string;
};

export type AutomationHttpExecutionResult = {
  method: AutomationHttpExecutionInput['method'];
  status: number;
  durationMs: number;
  responseType: 'json' | 'text' | 'empty';
  responsePreview: unknown;
  data: unknown;
};

type ResolvedAddress = { address: string; family: number };
type TransportInput = AutomationHttpExecutionInput & { resolvedAddress: string; family: number };
type TransportResult = { status: number; body: Buffer };
export type AutomationHttpRuntimeDependencies = {
  resolve: (hostname: string) => Promise<ResolvedAddress[]>;
  request: (input: TransportInput) => Promise<TransportResult>;
};

function parseIpv4(address: string) {
  const parts = address.split('.').map(Number);
  return parts.length === 4 && parts.every((part) => Number.isInteger(part) && part >= 0 && part <= 255) ? parts : null;
}

function isPublicIpv4(address: string) {
  const parts = parseIpv4(address);
  if (!parts) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') return false;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  if (normalized.startsWith('ff')) return false;
  if (normalized.startsWith('2001:db8:')) return false;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPublicIpv4(mapped[1]);
  return true;
}

export function isPublicAutomationHttpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

async function defaultResolve(hostname: string): Promise<ResolvedAddress[]> {
  const literal = hostname.replace(/^\[|\]$/g, '');
  const family = isIP(literal);
  if (family) return [{ address: literal, family }];
  return dnsLookup(hostname, { all: true, verbatim: true });
}

function defaultRequest(input: TransportInput): Promise<TransportResult> {
  return new Promise((resolve, reject) => {
    const target = new URL(input.url);
    const bodyBuffer = input.body === undefined ? undefined : Buffer.from(input.body, 'utf8');
    const headers: Record<string, string | number> = { accept: 'application/json, text/plain;q=0.9' };
    if (bodyBuffer) {
      headers['content-type'] = 'application/json';
      headers['content-length'] = bodyBuffer.byteLength;
    }

    const req = httpsRequest(target, {
      headers,
      method: input.method,
      rejectUnauthorized: true,
      servername: target.hostname.replace(/^\[|\]$/g, ''),
      lookup: (_hostname, _options, callback) => callback(null, input.resolvedAddress, input.family as 4 | 6),
    }, (res) => {
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.byteLength;
        if (total > MAX_RESPONSE_BYTES) {
          res.destroy(new Error(`HTTP action response exceeded ${MAX_RESPONSE_BYTES} bytes.`));
          return;
        }
        chunks.push(buffer);
      });
      res.on('end', () => resolve({ body: Buffer.concat(chunks), status: res.statusCode ?? 0 }));
      res.on('error', reject);
    });

    req.setTimeout(HTTP_TIMEOUT_MS, () => req.destroy(new Error(`HTTP action timed out after ${HTTP_TIMEOUT_MS}ms.`)));
    req.on('error', reject);
    if (bodyBuffer) req.write(bodyBuffer);
    req.end();
  });
}

const defaultDependencies: AutomationHttpRuntimeDependencies = { resolve: defaultResolve, request: defaultRequest };

function previewValue(value: unknown) {
  if (typeof value === 'string') return value.slice(0, MAX_PREVIEW_CHARS);
  const serialized = JSON.stringify(value);
  return serialized.length <= MAX_PREVIEW_CHARS ? value : serialized.slice(0, MAX_PREVIEW_CHARS);
}

function boundedErrorPreview(body: Buffer) {
  return body.toString('utf8').replace(/\s+/g, ' ').trim().slice(0, MAX_PREVIEW_CHARS);
}

export async function executeAutomationHttpAction(input: AutomationHttpExecutionInput, dependencies: AutomationHttpRuntimeDependencies = defaultDependencies): Promise<AutomationHttpExecutionResult> {
  const method = input.method.toUpperCase() as AutomationHttpExecutionInput['method'];
  if (!HTTP_METHODS.has(method)) throw new Error('HTTP action method is not supported.');

  let url: URL;
  try { url = new URL(input.url); } catch { throw new Error('HTTP action requires an HTTPS URL.'); }
  if (url.protocol !== 'https:') throw new Error('HTTP action requires an HTTPS URL.');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) throw new Error('HTTP action destination is not publicly routable.');

  const addresses = await dependencies.resolve(hostname);
  if (!addresses.length || addresses.some(({ address }) => !isPublicAutomationHttpAddress(address))) throw new Error('HTTP action destination is not publicly routable.');
  const selected = addresses[0];
  const started = Date.now();
  const result = await dependencies.request({ method, url: url.toString(), ...(input.body === undefined ? {} : { body: input.body }), resolvedAddress: selected.address, family: selected.family });
  const durationMs = Math.max(0, Date.now() - started);

  if (result.status >= 300 && result.status < 400) throw new Error('HTTP action redirects are not enabled.');
  if (result.status < 200 || result.status >= 300) throw new Error(`HTTP action failed with status ${result.status}: ${boundedErrorPreview(result.body)}`.trim());

  if (!result.body.length) return { data: null, durationMs, method, responsePreview: null, responseType: 'empty', status: result.status };
  const text = result.body.toString('utf8');
  try {
    const data: unknown = JSON.parse(text);
    return { data, durationMs, method, responsePreview: previewValue(data), responseType: 'json', status: result.status };
  } catch {
    return { data: text, durationMs, method, responsePreview: previewValue(text), responseType: 'text', status: result.status };
  }
}
