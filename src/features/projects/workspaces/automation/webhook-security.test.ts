import { createHmac } from 'node:crypto';

import {
  deriveWebhookEventId,
  generateWebhookCredentials,
  hashWebhookPayload,
  MAX_WEBHOOK_BODY_BYTES,
  normalizeWebhookEventId,
  parseWebhookJsonObject,
  validateWebhookContentType,
  verifyWebhookSignature,
} from './webhook-security';

describe('webhook security policy', () => {
  it('generates separate high-entropy endpoint and raw secret credentials', () => {
    const first = generateWebhookCredentials();
    const second = generateWebhookCredentials();

    expect(first.endpointId).not.toBe(first.secret);
    expect(first.endpointId).not.toBe(second.endpointId);
    expect(first.secret).not.toBe(second.secret);
    expect(first.endpointId.length).toBeGreaterThanOrEqual(32);
    expect(first.secret.length).toBeGreaterThanOrEqual(32);
    expect(first).toEqual({ endpointId: expect.any(String), secret: expect.any(String) });
  });

  it('verifies only the exact lowercase sha256 HMAC over raw bytes', () => {
    const secret = 'mkety_webhook_secret_for_test';
    const rawBody = Buffer.from('{"email":"a@example.com"}', 'utf8');
    const digest = createHmac('sha256', secret).update(rawBody).digest('hex');

    expect(verifyWebhookSignature({ secret, rawBody, signatureHeader: `sha256=${digest}` })).toBe(true);
    expect(verifyWebhookSignature({ secret, rawBody, signatureHeader: null })).toBe(false);
    expect(verifyWebhookSignature({ secret, rawBody, signatureHeader: digest })).toBe(false);
    expect(verifyWebhookSignature({ secret, rawBody, signatureHeader: `sha256=${digest.toUpperCase()}` })).toBe(false);
    expect(verifyWebhookSignature({ secret, rawBody, signatureHeader: `sha256=${'0'.repeat(64)}` })).toBe(false);
  });

  it('accepts JSON content type with charset and rejects other media types', () => {
    expect(() => validateWebhookContentType('application/json')).not.toThrow();
    expect(() => validateWebhookContentType('application/json; charset=utf-8')).not.toThrow();
    expect(() => validateWebhookContentType('text/plain')).toThrow('Webhook content type must be application/json.');
    expect(() => validateWebhookContentType(null)).toThrow('Webhook content type must be application/json.');
  });

  it('parses only bounded top-level JSON objects', () => {
    expect(parseWebhookJsonObject(Buffer.from('{"customer":{"email":"a@example.com"}}'))).toEqual({ customer: { email: 'a@example.com' } });
    expect(() => parseWebhookJsonObject(Buffer.from('{bad'))).toThrow('Webhook body must be valid JSON.');
    expect(() => parseWebhookJsonObject(Buffer.from('[1,2,3]'))).toThrow('Webhook body must be a JSON object.');
    expect(() => parseWebhookJsonObject(Buffer.from('null'))).toThrow('Webhook body must be a JSON object.');
    expect(() => parseWebhookJsonObject(Buffer.alloc(MAX_WEBHOOK_BODY_BYTES + 1, 97))).toThrow(`Webhook body exceeds ${MAX_WEBHOOK_BODY_BYTES} bytes.`);
  });

  it('normalizes bounded external event IDs and rejects control characters', () => {
    expect(normalizeWebhookEventId(' evt_123 ')).toBe('evt_123');
    expect(normalizeWebhookEventId(null)).toBeNull();
    expect(() => normalizeWebhookEventId('evt\n123')).toThrow('Webhook event ID is invalid.');
    expect(() => normalizeWebhookEventId('x'.repeat(257))).toThrow('Webhook event ID is invalid.');
  });

  it('derives deterministic event and payload hashes from exact raw bytes', () => {
    const body = Buffer.from('{"a":1}');
    expect(deriveWebhookEventId('endpoint-1', body)).toBe(deriveWebhookEventId('endpoint-1', body));
    expect(deriveWebhookEventId('endpoint-1', body)).not.toBe(deriveWebhookEventId('endpoint-2', body));
    expect(hashWebhookPayload(body)).toHaveLength(64);
    expect(hashWebhookPayload(body)).not.toBe(hashWebhookPayload(Buffer.from('{"a":2}')));
  });
});
