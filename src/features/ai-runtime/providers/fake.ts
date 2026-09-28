import type { AiProviderAdapter, AiRuntimeRequest, AiRuntimeResult } from './contracts';

export class FakeAiProviderAdapter implements AiProviderAdapter {
  readonly providerKey = 'fake';

  async generate(input: AiRuntimeRequest, route: { nativeModel: string }): Promise<AiRuntimeResult> {
    return {
      requestId: crypto.randomUUID(),
      model: route.nativeModel,
      content: 'Non-billable Mkety AI test response.',
      finishReason: 'stop',
      usage: { inputTokens: 1, cachedInputTokens: 0, outputTokens: 1 },
    };
  }
}
