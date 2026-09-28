import { type CentralAiProviderCredentials, createCentralExternalProvider } from '@/features/ai-runtime/providers/external';

import type { PublicAIProviderAdapter } from './types';
import type { PublicAssistantEnvironment } from '../../config';
import type { PublicAIProviderId } from '../../models';

function credentialsFor(
  providerId: PublicAIProviderId,
  environment: PublicAssistantEnvironment,
): CentralAiProviderCredentials | null {
  switch (providerId) {
    case 'openai':
      return environment.MKETY_PUBLIC_OPENAI_API_KEY
        ? { provider: 'openai', apiKey: environment.MKETY_PUBLIC_OPENAI_API_KEY }
        : null;
    case 'azure-openai':
      return (
        environment.MKETY_PUBLIC_AZURE_OPENAI_API_KEY &&
        environment.MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT &&
        environment.MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT
      )
        ? {
            provider: 'azure-openai',
            apiKey: environment.MKETY_PUBLIC_AZURE_OPENAI_API_KEY,
            endpoint: environment.MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT,
            deployment: environment.MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT,
          }
        : null;
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
    const credentials = credentialsFor(providerId, environment);
    if (!credentials) return [];
    const central = createCentralExternalProvider(credentials);
    return [central as PublicAIProviderAdapter];
  });
}
