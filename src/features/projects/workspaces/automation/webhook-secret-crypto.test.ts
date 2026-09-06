import { decryptWebhookSecret, encryptWebhookSecret, fingerprintWebhookSecret } from './webhook-secret-crypto';

const key = Buffer.alloc(32, 7).toString('base64url');

describe('webhook secret encryption', () => {
  it('encrypts authenticated ciphertext and decrypts only with the configured key', () => {
    const secret = 'mkety_webhook_secret_example';
    const ciphertext = encryptWebhookSecret(secret, key);

    expect(ciphertext).not.toContain(secret);
    expect(ciphertext).toMatch(/^v1\./);
    expect(decryptWebhookSecret(ciphertext, key)).toBe(secret);
    expect(() => decryptWebhookSecret(ciphertext, Buffer.alloc(32, 8).toString('base64url'))).toThrow('Webhook secret could not be decrypted.');
  });

  it('detects ciphertext tampering and produces a non-secret fingerprint', () => {
    const secret = 'mkety_webhook_secret_example';
    const ciphertext = encryptWebhookSecret(secret, key);
    const parts = ciphertext.split('.');
    parts[3] = `${parts[3]?.slice(0, -1)}${parts[3]?.endsWith('A') ? 'B' : 'A'}`;

    expect(() => decryptWebhookSecret(parts.join('.'), key)).toThrow('Webhook secret could not be decrypted.');
    expect(fingerprintWebhookSecret(secret)).toHaveLength(64);
    expect(fingerprintWebhookSecret(secret)).not.toContain(secret);
  });

  it('rejects missing or malformed encryption keys', () => {
    expect(() => encryptWebhookSecret('secret', '')).toThrow('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
    expect(() => encryptWebhookSecret('secret', 'too-short')).toThrow('WEBHOOK_SECRET_ENCRYPTION_KEY must decode to exactly 32 bytes.');
  });
});
