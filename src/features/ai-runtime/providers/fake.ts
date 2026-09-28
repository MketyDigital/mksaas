import type { AiRuntimeProviderAdapter, AiRuntimeRequest, AiRuntimeResult } from '../runtime/types';

export class FakeAiProviderAdapter implements AiRuntimeProviderAdapter {
  readonly key = 'fake';

  async complete(_request: AiRuntimeRequest, nativeModel: string): Promise<AiRuntimeResult> {
    return {
      requestId: crypto.randomUUID(),
      provider: this.key,
      nativeModel,
      text: 'Non-billable Mkety AI test response.',
      finishReason: 'stop',
      usage: { inputTokens: 1n, cachedInputTokens: 0n, outputTokens: 1n },
    };
  }
}
