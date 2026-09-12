import { decryptWebhookSecret, encryptWebhookSecret, fingerprintWebhookSecret } from './webhook-secret-crypto';

const key = Buffer.alloc(32, 7).toString('base64url');

function mutateEncodedBytes(value: string, segmentIndex: number) {
  const parts = value.split('.');
  const bytes = Buffer.from(parts[segmentIndex]!, 'base64url');
  bytes[0] ^= 0x01;
  parts[segmentIndex] = bytes.toString('base64url');
  return parts.join('.');
}

describe('webhook secret encryption', () => {
  it('encrypts authenticated ciphertext and decrypts only with the configured key', () => {
    const secret = 'mkety_webhook_secret_example';
    const ciphertext = encryptWebhookSecret(secret, key);

    expect(ciphertext).not.toContain(secret);
    expect(ciphertext).toMatch(/^v1\./);
    expect(decryptWebhookSecret(ciphertext, key)).toBe(secret);
    expect(() => decryptWebhookSecret(ciphertext, Buffer.alloc(32, 8).toString('base64url'))).toThrow('Webhook secret could not be decrypted.');
  });

  it('rejects non-canonical ciphertext text and produces a non-secret fingerprint', () => {
    const secret = 'mkety_webhook_secret_example';
    const ciphertext = encryptWebhookSecret(secret, key);
    const parts = ciphertext.split('.');
    parts[3] = `${parts[3]?.slice(0, -1)}${parts[3]?.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptWebhookSecret(parts.join('.'), key)).toThrow('Webhook secret could not be decrypted.');
    expect(fingerprintWebhookSecret(secret)).toHaveLength(64);
    expect(fingerprintWebhookSecret(secret)).not.toContain(secret);
  });

  it.each([
    ['IV', 1],
    ['authentication tag', 2],
    ['ciphertext', 3],
  ])('rejects byte-level %s tampering', (_label, segmentIndex) => {
    const ciphertext = encryptWebhookSecret('mkety_webhook_secret_example', key);
    expect(() => decryptWebhookSecret(mutateEncodedBytes(ciphertext, segmentIndex), key)).toThrow('Webhook secret could not be decrypted.');
  });

  it('rejects malformed ciphertext encoding', () => {
    const ciphertext = encryptWebhookSecret('mkety_webhook_secret_example', key);
    const parts = ciphertext.split('.');
    parts[3] = `${parts[3]}=`;
    expect(() => decryptWebhookSecret(parts.join('.'), key)).toThrow('Webhook secret could not be decrypted.');
  });

  it('rejects missing or malformed encryption keys', () => {
    expect(() => encryptWebhookSecret('secret', '')).toThrow('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    expect(() => encryptWebhookSecret('secret', 'too-short')).toThrow('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  });
});
