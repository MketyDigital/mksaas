import type {
  PublicAIProviderAdapter,
  PublicAIProviderError,
  PublicAIProviderRequest,
  PublicAIProviderResponse,
} from './providers/types';

export const PUBLIC_AI_PROVIDER_TIMEOUT_MS = 20_000;

export interface PublicAIGatewayResult extends PublicAIProviderResponse {
  fallbackCount: number;
  providerId: PublicAIProviderAdapter['id'];
}

function isRetryableProviderError(error: unknown): boolean {
  return Boolean((error as PublicAIProviderError | undefined)?.retryable);
}

async function generateWithTimeout(
  adapter: PublicAIProviderAdapter,
  request: PublicAIProviderRequest,
): Promise<PublicAIProviderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_AI_PROVIDER_TIMEOUT_MS);

  try {
    return await adapter.generate({ ...request, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw Object.assign(new Error('Public AI provider timed out.'), { retryable: true });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runPublicAIGateway(input: {
  request: PublicAIProviderRequest;
  primary: PublicAIProviderAdapter;
  fallbacks: PublicAIProviderAdapter[];
}): Promise<PublicAIGatewayResult> {
  const adapters = [input.primary, ...input.fallbacks];
  let lastError: unknown;

  for (let index = 0; index < adapters.length; index += 1) {
    const adapter = adapters[index];
    if (!adapter) continue;

    try {
      const response = await generateWithTimeout(adapter, input.request);
      return { ...response, fallbackCount: index, providerId: adapter.id };
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || index === adapters.length - 1) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Public AI provider is unavailable.');
}
