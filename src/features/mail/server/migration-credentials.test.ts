/** @jest-environment node */
import { decryptImapCredential, encryptImapCredential, normalizeImapEndpoint } from './migration-credentials';

describe('IMAP migration credentials', () => {
  const previous = process.env.MKETY_CONNECTION_SECRET_ENCRYPTION_KEY;
  beforeAll(() => {
    process.env.MKETY_CONNECTION_SECRET_ENCRYPTION_KEY = 'test-encryption-key-with-at-least-32-characters';
  });
  afterAll(() => {
    if (previous === undefined) delete process.env.MKETY_CONNECTION_SECRET_ENCRYPTION_KEY;
    else process.env.MKETY_CONNECTION_SECRET_ENCRYPTION_KEY = previous;
  });

  test('encrypts source credentials and can decrypt only with the configured key', async () => {
    const encrypted = await encryptImapCredential('hello@example.net', 'secret-app-password');
    expect(encrypted).not.toContain('secret-app-password');
    expect(await decryptImapCredential(encrypted)).toEqual({
      username: 'hello@example.net',
      password: 'secret-app-password',
    });
  });

  test('requires a valid public hostname and implicit TLS port', () => {
    expect(normalizeImapEndpoint('imap.zoho.com', 993)).toBe('imap.zoho.com');
    expect(() => normalizeImapEndpoint('localhost', 993)).toThrow('imap_endpoint_disallowed');
    expect(() => normalizeImapEndpoint('169.254.169.254', 993)).toThrow('imap_endpoint_disallowed');
    expect(() => normalizeImapEndpoint('mail.example.com', 143)).toThrow('imap_endpoint_invalid');
  });

  test('rejects credentials containing control characters', async () => {
    await expect(encryptImapCredential('user@example.net', 'pass\nword')).rejects.toThrow('imap_credential_invalid');
  });
});
