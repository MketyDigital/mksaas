import { createHmac, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 3000);
const sharedSecret = String(process.env.MKETY_DOMAIN_RELAY_SECRET || '').trim();
if (sharedSecret.length < 32) throw new Error('MKETY_DOMAIN_RELAY_SECRET must be at least 32 characters.');

const LIVE_BASE = 'https://api.domainresellerapi.com';
const OTE_BASE = 'https://ote.domainresellerapi.com';
const seenNonces = new Map();

function rejectReplay(nonce) {
  if (!/^[0-9a-f-]{36}$/i.test(nonce)) return true;
  const now = Date.now();
  for (const [key, expiresAt] of seenNonces) {
    if (expiresAt <= now) seenNonces.delete(key);
  }
  if (seenNonces.has(nonce)) return true;
  seenNonces.set(nonce, now + 60_000);
  return false;
}

const ALLOWED = new Map([
  ['quote', { method: 'POST', path: '/v1/domain/check' }],
  ['register', { method: 'POST', path: '/v1/domain/register' }],
  ['renew', { method: 'POST', path: '/v1/domain/renew' }],
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
    if (rejectReplay(String(input.nonce || ''))) {
      return json(res, 409, { error: 'replayed_or_invalid_nonce' });
    }
    const operation = ALLOWED.get(String(input.operation || ''));
    if (!operation) return json(res, 400, { error: 'unsupported_operation' });
    if (input.environment !== 'production' && input.environment !== 'ote') {
      return json(res, 400, { error: 'invalid_environment' });
    }
    if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
      return json(res, 400, { error: 'invalid_payload' });
    }

    const base = input.environment === 'production' ? LIVE_BASE : OTE_BASE;
    const upstream = await fetch(base + operation.path, {
      method: operation.method,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(input.payload),
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
});
