import { FakeAiProviderAdapter } from './fake';

describe('FakeAiProviderAdapter', () => {
  it('returns a deterministic non-billable-shaped normalized response', async () => {
    const adapter = new FakeAiProviderAdapter();
    const result = await adapter.generate({
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyId: 'key-a',
      requestedModel: 'mkety-gemma',
      messages: [{ role: 'user', content: 'hello' }],
      idempotencyKey: 'test-1',
    }, { nativeModel: 'fake/model' });

    expect(adapter.providerKey).toBe('fake');
    expect(result.model).toBe('fake/model');
    expect(result.content).toBe('Non-billable Mkety AI test response.');
    expect(result.usage).toEqual({ inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 });
  });
});
