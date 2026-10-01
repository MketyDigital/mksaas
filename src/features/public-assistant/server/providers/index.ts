import { type CentralAiProviderCredentials, createCentralExternalProvider } from '@/features/ai-runtime/providers/external';
import { getManagedWorkersAiProvider } from '@/features/ai-runtime/providers/runtime.cloudflare';

import type { PublicAIProviderAdapter } from './types';
import { resolvePublicAzureOpenAIConfig, type PublicAssistantEnvironment } from '../../config';
import type { PublicAIProviderId } from '../../models';

function credentialsFor(
  providerId: PublicAIProviderId,
  environment: PublicAssistantEnvironment,
): CentralAiProviderCredentials | null {
  switch (providerId) {
    case 'workers-ai':
      return null;
    case 'openai':
      return environment.MKETY_PUBLIC_OPENAI_API_KEY
        ? { provider: 'openai', apiKey: environment.MKETY_PUBLIC_OPENAI_API_KEY }
        : null;
    case 'azure-openai': {
      const azure = resolvePublicAzureOpenAIConfig(environment);
      return azure ? { provider: 'azure-openai', ...azure } : null;
    }
    case 'gemini':
      return environment.MKETY_PUBLIC_GEMINI_API_KEY
        ? { provider: 'gemini', apiKey: environment.MKETY_PUBLIC_GEMINI_API_KEY }
        : null;
    case 'vertex':
      return (
        environment.MKETY_PUBLIC_VERTEX_ACCESS_TOKEN &&
        environment.MKETY_PUBLIC_VERTEX_LOCATION &&
        environment.MKETY_PUBLIC_VERTEX_PROJECT_ID
      )
        ? {
            provider: 'vertex',
            accessToken: environment.MKETY_PUBLIC_VERTEX_ACCESS_TOKEN,
            location: environment.MKETY_PUBLIC_VERTEX_LOCATION,
            projectId: environment.MKETY_PUBLIC_VERTEX_PROJECT_ID,
          }
        : null;
    case 'cloudflare-ai':
      return environment.MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID && environment.MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN
        ? {
            provider: 'cloudflare-ai',
            accountId: environment.MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID,
            apiToken: environment.MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN,
          }
        : null;
    case 'bedrock':
      return environment.MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID && environment.MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY
        ? {
            provider: 'bedrock',
            accessKeyId: environment.MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID,
            secretAccessKey: environment.MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY,
            ...(environment.MKETY_PUBLIC_BEDROCK_SESSION_TOKEN
              ? { sessionToken: environment.MKETY_PUBLIC_BEDROCK_SESSION_TOKEN }
              : {}),
            region: environment.MKETY_PUBLIC_BEDROCK_REGION ?? 'us-east-1',
          }
        : null;
  }
}

export function createPublicAIProviderAdapters(
  providerIds: PublicAIProviderId[],
  environment: PublicAssistantEnvironment,
): PublicAIProviderAdapter[] {
  return providerIds.flatMap((providerId) => {
    if (providerId === 'workers-ai') {
      const adapter: PublicAIProviderAdapter = {
        id: 'workers-ai',
        async generate(request) {
          const result = await getManagedWorkersAiProvider().complete({
            tenantId: 'public-mkety-ai',
            projectId: null,
            apiKeyId: null,
            actorUserId: null,
            requestedModel: 'public-ai',
            messages: [
              { role: 'system', content: request.system },
              ...request.messages,
            ],
            maxOutputTokens: request.maxOutputTokens,
            idempotencyKey: `public-ai-${crypto.randomUUID()}`,
          }, request.model);

          return {
            text: result.text ?? '',
            providerRequestId: result.providerRequestId,
            usage: {
              inputTokens: Number(result.usage.inputTokens),
              outputTokens: Number(result.usage.outputTokens),
              totalTokens: Number(result.usage.inputTokens + result.usage.outputTokens),
            },
          };
        },
      };
      return [adapter];
    }

    const credentials = credentialsFor(providerId, environment);
    if (!credentials) return [];
    const central = createCentralExternalProvider(credentials);
    return [central as PublicAIProviderAdapter];
  });
}
