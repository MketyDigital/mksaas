import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;
const MAX_EVENT_ID_LENGTH = 256;
const SIGNATURE_PREFIX = 'sha256=';
const SIGNATURE_HEX_LENGTH = 64;

function ensureBodyLimit(rawBody: Uint8Array) {
  if (rawBody.byteLength > MAX_WEBHOOK_BODY_BYTES) {
    throw new Error(`Webhook body exceeds ${MAX_WEBHOOK_BODY_BYTES} bytes.`);
  }
}

export function generateWebhookCredentials() {
  return {
    endpointId: randomBytes(24).toString('hex'),
    secret: randomBytes(32).toString('base64url'),
  };
}

export function verifyWebhookSignature({ secret, rawBody, signatureHeader }: { secret: string; rawBody: Uint8Array; signatureHeader: string | null }) {
  if (!signatureHeader?.startsWith(SIGNATURE_PREFIX)) return false;
  const digest = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (!new RegExp(`^[0-9a-f]{${SIGNATURE_HEX_LENGTH}}$`).test(digest)) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest();
  const received = Buffer.from(digest, 'hex');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function validateWebhookContentType(contentType: string | null) {
  const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase();
  if (mediaType !== 'application/json') throw new Error('Webhook content type must be application/json.');
}

export function parseWebhookJsonObject(rawBody: Uint8Array): Record<string, unknown> {
  ensureBodyLimit(rawBody);
  let value: unknown;
  try {
    value = JSON.parse(Buffer.from(rawBody).toString('utf8'));
  } catch {
    throw new Error('Webhook body must be valid JSON.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Webhook body must be a JSON object.');
  return value as Record<string, unknown>;
}

export function normalizeWebhookEventId(value: string | null) {
  if (value === null) return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > MAX_EVENT_ID_LENGTH || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error('Webhook event ID is invalid.');
  }
  return normalized;
}

export function deriveWebhookEventId(endpointId: string, rawBody: Uint8Array) {
  return createHash('sha256').update(endpointId, 'utf8').update(Buffer.from([0])).update(rawBody).digest('hex');
}

export function hashWebhookPayload(rawBody: Uint8Array) {
  return createHash('sha256').update(rawBody).digest('hex');
}
