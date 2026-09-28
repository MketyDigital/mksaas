import { FakeAiProviderAdapter } from './fake';

describe('FakeAiProviderAdapter', () => {
  it('returns a normalized non-billable response', async () => {
    const adapter = new FakeAiProviderAdapter();
    const result = await adapter.complete({
      tenantId: 'tenant-a',
      projectId: 'project-a',
      apiKeyId: 'key-a',
      actorUserId: null,
      requestedModel: 'gemma-4',
      messages: [{ role: 'user', content: 'hello' }],
      idempotencyKey: 'test-1',
    }, 'fake/model');

    expect(adapter.key).toBe('fake');
    expect(result.nativeModel).toBe('fake/model');
    expect(result.text).toBe('Non-billable Mkety AI test response.');
    expect(result.usage).toEqual({ inputTokens: 1n, cachedInputTokens: 0n, outputTokens: 1n });
  });
});
