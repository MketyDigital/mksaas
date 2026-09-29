import { decryptAiProviderSecret, encryptAiProviderSecret } from './byok-secrets';

describe('BYOK secret references', () => {
  it('round-trips encrypted provider secrets without plaintext persistence', async () => {
    const key = '0123456789abcdef0123456789abcdef';
    const encrypted = await encryptAiProviderSecret(
      { apiKey: 'customer-secret-key', projectId: 'project-1' },
      key,
    );

    expect(encrypted).toMatch(/^enc:v1:/);
    expect(encrypted).not.toContain('customer-secret-key');
    await expect(decryptAiProviderSecret(encrypted, key)).resolves.toEqual({
      apiKey: 'customer-secret-key',
      projectId: 'project-1',
    });
  });

  it('fails closed with the wrong encryption key', async () => {
    const encrypted = await encryptAiProviderSecret(
      { apiKey: 'customer-secret-key' },
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    await expect(
      decryptAiProviderSecret(encrypted, 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
    ).rejects.toBeDefined();
  });
});
