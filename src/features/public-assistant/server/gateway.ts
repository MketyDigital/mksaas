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

export interface PublicAIProviderTarget {
  adapter: PublicAIProviderAdapter;
  model: string;
}

export type PublicAIGatewayRequest = Omit<PublicAIProviderRequest, 'model' | 'signal'>;

function isRetryableProviderError(error: unknown): boolean {
  return Boolean((error as PublicAIProviderError | undefined)?.retryable);
}

async function generateWithTimeout(
  target: PublicAIProviderTarget,
  request: PublicAIGatewayRequest,
): Promise<PublicAIProviderResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_AI_PROVIDER_TIMEOUT_MS);

  try {
    return await target.adapter.generate({
      ...request,
      model: target.model,
      signal: controller.signal,
    });
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
  request: PublicAIGatewayRequest;
  primary: PublicAIProviderTarget;
  fallbacks: PublicAIProviderTarget[];
}): Promise<PublicAIGatewayResult> {
  const targets = [input.primary, ...input.fallbacks];
  let lastError: unknown;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (!target) continue;

    try {
      const response = await generateWithTimeout(target, input.request);
      return {
        ...response,
        fallbackCount: index,
        providerId: target.adapter.id,
      };
    } catch (error) {
      lastError = error;
      if (!isRetryableProviderError(error) || index === targets.length - 1) throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Public AI provider is unavailable.');
}
