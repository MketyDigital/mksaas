import {
  fingerprintAiConnectionSecret,
  protectAiConnectionSecret,
  revealAiConnectionSecret,
} from './connection-secret-crypto';

const key = Buffer.alloc(32, 7).toString('base64url');

describe('Enterprise AI connection secret encryption', () => {
  it('round-trips authenticated ciphertext and never embeds plaintext', () => {
    const raw = 'customer-provider-secret';
    const encrypted = protectAiConnectionSecret(raw, key);
    expect(encrypted).not.toContain(raw);
    expect(revealAiConnectionSecret(encrypted, key)).toBe(raw);
    expect(fingerprintAiConnectionSecret(raw)).toHaveLength(64);
  });

  it('fails closed on tampering', () => {
    const encrypted = protectAiConnectionSecret('secret', key);
    const parts = encrypted.split('.');
    parts[3] = parts[3].slice(0, -1) + (parts[3].endsWith('A') ? 'B' : 'A');
    expect(() => revealAiConnectionSecret(parts.join('.'), key)).toThrow('could not be decrypted');
  });

  it('requires a dedicated 256-bit encryption key', () => {
    expect(() => protectAiConnectionSecret('secret', 'short')).toThrow('AI_CONNECTION_SECRET_ENCRYPTION_KEY');
  });
});
