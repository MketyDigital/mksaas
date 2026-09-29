import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3000);
const sharedSecret = String(process.env.MKETY_DOMAIN_RELAY_SECRET || '').trim();
if (sharedSecret.length < 32) throw new Error('MKETY_DOMAIN_RELAY_SECRET must be at least 32 characters.');

const LIVE_BASE = 'https://api.domainresellerapi.com/api/v1';
const OTE_BASE = 'https://ote.domainresellerapi.com/api/v1';
const seenNonces = new Map();
const ALLOWED = new Map([
  ['quote', { method: 'POST', path: '/domains/bulk-search' }],
  ['pricing', { method: 'GET', path: '/products/tlds' }],
  ['register', { method: 'POST', path: '/domains/register-with-contacts' }],
  ['renew', { method: 'POST', path: '/domains/renew' }],
  ['nameservers', { method: 'PUT', path: '/domains/dns/name-server' }],
]);

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > 64 * 1024) throw new Error('body_too_large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function verifySignature(rawBody, timestamp, signature) {
  if (!/^\d{13}$/.test(timestamp)) return false;
  const age = Math.abs(Date.now() - Number(timestamp));
  if (!Number.isFinite(age) || age > 60_000) return false;
  if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', sharedSecret).update(timestamp + '.' + rawBody).digest('hex');
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://relay.local');
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, { ok: true, service: 'mkety-domainnameapi-relay' });
    }
    if (req.method !== 'POST' || url.pathname !== '/v1/domainnameapi') {
      return json(res, 404, { error: 'not_found' });
    }

    const rawBody = await readBody(req);
    const timestamp = String(req.headers['x-mkety-timestamp'] || '');
    const signature = String(req.headers['x-mkety-signature'] || '');
    if (!verifySignature(rawBody, timestamp, signature)) {
      return json(res, 401, { error: 'invalid_relay_signature' });
    }

    const input = JSON.parse(rawBody);
    const nonce = String(input.nonce || '');
    if (!/^[0-9a-f-]{36}$/i.test(nonce)) return json(res, 400, { error: 'replayed_or_invalid_nonce' });
    const now = Date.now();
    for (const [value, expiresAt] of seenNonces) {
      if (expiresAt <= now) seenNonces.delete(value);
    }
    if (seenNonces.has(nonce)) return json(res, 409, { error: 'replayed_or_invalid_nonce' });
    seenNonces.set(nonce, now + 60_000);

    const operation = ALLOWED.get(String(input.operation || ''));
    if (!operation) return json(res, 400, { error: 'unsupported_operation' });
    if (input.environment !== 'production' && input.environment !== 'ote') {
      return json(res, 400, { error: 'invalid_environment' });
    }
    if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
      return json(res, 400, { error: 'invalid_payload' });
    }

    const resellerId = String(input.payload.resellerId || '').trim();
    const apiKey = String(input.payload.apiKey || '').trim();
    if (!resellerId || !apiKey) return json(res, 400, { error: 'missing_provider_credentials' });

    const { resellerId: _resellerId, apiKey: _apiKey, ...providerPayload } = input.payload;
    const body = input.operation === 'quote'
      ? JSON.stringify([{ domainName: String(providerPayload.domainName || '') }])
      : input.operation === 'pricing'
        ? undefined
        : JSON.stringify(providerPayload);
    const path = input.operation === 'pricing'
      ? operation.path + '?' + new URLSearchParams({
          MaxResultCount: String(providerPayload.maxResultCount || 500),
          SkipCount: '0',
        }).toString()
      : operation.path;

    const base = input.environment === 'production' ? LIVE_BASE : OTE_BASE;
    const upstream = await fetch(base + path, {
      method: operation.method,
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'X-API-KEY': apiKey,
        '__reseller': resellerId,
      },
      ...(body === undefined ? {} : { body }),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      'content-type': upstream.headers.get('content-type') || 'application/json',
      'cache-control': 'no-store',
    });
    res.end(text);
  } catch (error) {
    const code = error instanceof Error && error.message === 'body_too_large' ? 413 : 502;
    json(res, code, { error: code === 413 ? 'body_too_large' : 'relay_upstream_failure' });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log('mkety-domainnameapi-relay listening on port ' + port);
  void fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(10_000) })
    .then((response) => response.ok ? response.json() : Promise.reject(new Error('egress lookup failed')))
    .then((payload) => {
      const ip = typeof payload?.ip === 'string' ? payload.ip.trim() : '';
      if (/^[0-9a-f:.]+$/i.test(ip)) console.log('MKETY_RELAY_OUTBOUND_IP=' + ip);
    })
    .catch(() => console.log('MKETY_RELAY_OUTBOUND_IP=unavailable'));
});
