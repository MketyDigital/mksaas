import type { PublicAssistantEnvironment } from '../../config';
import type { PublicAIProviderId } from '../../models';
import { createAzureOpenAIPublicAdapter } from './azure-openai';
import { createBedrockPublicAdapter } from './bedrock';
import { createCloudflareAIPublicAdapter } from './cloudflare-ai';
import { createGeminiPublicAdapter } from './gemini';
import { createOpenAIPublicAdapter } from './openai';
import type { PublicAIProviderAdapter } from './types';
import { createVertexPublicAdapter } from './vertex';

export function createPublicAIProviderAdapters(
  providerIds: PublicAIProviderId[],
  environment: PublicAssistantEnvironment,
): PublicAIProviderAdapter[] {
  const adapters: PublicAIProviderAdapter[] = [];

  for (const providerId of providerIds) {
    switch (providerId) {
      case 'openai':
        if (environment.MKETY_PUBLIC_OPENAI_API_KEY) {
          adapters.push(createOpenAIPublicAdapter(environment.MKETY_PUBLIC_OPENAI_API_KEY));
        }
        break;
      case 'azure-openai':
        if (
          environment.MKETY_PUBLIC_AZURE_OPENAI_API_KEY &&
          environment.MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT &&
          environment.MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT
        ) {
          adapters.push(
            createAzureOpenAIPublicAdapter({
              apiKey: environment.MKETY_PUBLIC_AZURE_OPENAI_API_KEY,
              endpoint: environment.MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT,
              deployment: environment.MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT,
            }),
          );
        }
        break;
      case 'gemini':
        if (environment.MKETY_PUBLIC_GEMINI_API_KEY) {
          adapters.push(createGeminiPublicAdapter(environment.MKETY_PUBLIC_GEMINI_API_KEY));
        }
        break;
      case 'vertex':
        if (
          environment.MKETY_PUBLIC_VERTEX_ACCESS_TOKEN &&
          environment.MKETY_PUBLIC_VERTEX_LOCATION &&
          environment.MKETY_PUBLIC_VERTEX_PROJECT_ID
        ) {
          adapters.push(
            createVertexPublicAdapter({
              accessToken: environment.MKETY_PUBLIC_VERTEX_ACCESS_TOKEN,
              location: environment.MKETY_PUBLIC_VERTEX_LOCATION,
              projectId: environment.MKETY_PUBLIC_VERTEX_PROJECT_ID,
            }),
          );
        }
        break;
      case 'cloudflare-ai':
        if (
          environment.MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID &&
          environment.MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN
        ) {
          adapters.push(
            createCloudflareAIPublicAdapter({
              accountId: environment.MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID,
              apiToken: environment.MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN,
            }),
          );
        }
        break;
      case 'bedrock':
        if (
          environment.MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID &&
          environment.MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY
        ) {
          adapters.push(
            createBedrockPublicAdapter({
              accessKeyId: environment.MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID,
              region: environment.MKETY_PUBLIC_BEDROCK_REGION ?? 'us-east-1',
              secretAccessKey: environment.MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY,
              sessionToken: environment.MKETY_PUBLIC_BEDROCK_SESSION_TOKEN,
            }),
          );
        }
        break;
    }
  }

  return adapters;
}
