import { assertCurrentPublicAIModel, getDefaultPublicAIModel, type PublicAIProviderId } from './models';

export type PublicAssistantProvider = PublicAIProviderId;

export type PublicAssistantLaunchState =
  | { enabled: false; reason: 'disabled' | 'provider-unconfigured' }
  | { enabled: true; reason: 'ready'; provider: PublicAssistantProvider; model: string };

export interface PublicAssistantEnvironment {
  [key: string]: string | undefined;
  MKETY_PUBLIC_AI_ENABLED?: string;
  MKETY_PUBLIC_AI_PRIMARY_PROVIDER?: string;
  MKETY_PUBLIC_AI_PROVIDER?: string;
  MKETY_PUBLIC_AI_FALLBACK_PROVIDERS?: string;
  MKETY_PUBLIC_AI_MODEL?: string;
  MKETY_PUBLIC_OPENAI_API_KEY?: string;
  MKETY_PUBLIC_AZURE_OPENAI_API_KEY?: string;
  MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT?: string;
  MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT?: string;
  MKETY_PUBLIC_AZURE_OPENAI_MODEL?: string;
  // Foundry-friendly aliases used by deployment environments. Keep both spellings
  // so existing Azure OpenAI configuration remains backward compatible.
  MKETY_PUBLIC_AZURE_OPEN_AI_API_KEY?: string;
  MKETY_PUBLIC_AZURE_OPEN_AI_KEY?: string;
  MKETY_PUBLIC_AZURE_OPENAI_KEY?: string;
  MKETY_PUBLIC_AZURE_API_KEY?: string;
  MKETY_PUBLIC_AZURE_KEY?: string;
  AZURE_OPENAI_API_KEY?: string;
  AZURE_AI_API_KEY?: string;
  MKETY_PUBLIC_AZURE_OPEN_AI_ENDPOINT?: string;
  MKETY_PUBLIC_AZURE_OPEN_AI_DEPLOYMENT?: string;
  MKETY_PUBLIC_AZURE_OPEN_AI_MODEL?: string;
  MKETY_PUBLIC_GEMINI_API_KEY?: string;
  MKETY_PUBLIC_VERTEX_PROJECT_ID?: string;
  MKETY_PUBLIC_VERTEX_LOCATION?: string;
  MKETY_PUBLIC_VERTEX_ACCESS_TOKEN?: string;
  MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID?: string;
  MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN?: string;
  MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID?: string;
  MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY?: string;
  MKETY_PUBLIC_BEDROCK_SESSION_TOKEN?: string;
  MKETY_PUBLIC_BEDROCK_REGION?: string;
  // Backward-compatible launch-only alias. Public runtime code should prefer the
  // public-specific credential above and must never inherit tenant provider config.
  OPENAI_API_KEY?: string;
}

export interface PublicAIProviderConfig {
  enabled: boolean;
  primaryProvider: PublicAIProviderId;
  fallbackProviders: PublicAIProviderId[];
  model: string;
}

const PUBLIC_AI_PROVIDER_IDS: readonly PublicAIProviderId[] = [
  'workers-ai',
  'openai',
  'azure-openai',
  'gemini',
  'vertex',
  'cloudflare-ai',
  'bedrock',
];

function isPublicAIProviderId(value: string): value is PublicAIProviderId {
  return PUBLIC_AI_PROVIDER_IDS.includes(value as PublicAIProviderId);
}

function parseProvider(value: string | undefined, fallback: PublicAIProviderId): PublicAIProviderId {
  if (!value) return fallback;
  if (!isPublicAIProviderId(value)) throw new Error(`Unsupported public AI provider: ${value}`);
  return value;
}

export function parsePublicAIProviderConfig(environment: PublicAssistantEnvironment): PublicAIProviderConfig {
  const primaryProvider = parseProvider(
    environment.MKETY_PUBLIC_AI_PRIMARY_PROVIDER ?? environment.MKETY_PUBLIC_AI_PROVIDER,
    'openai',
  );
  const model = environment.MKETY_PUBLIC_AI_MODEL ?? getDefaultPublicAIModel(primaryProvider);
  assertCurrentPublicAIModel(primaryProvider, model);

  const fallbackProviders = (environment.MKETY_PUBLIC_AI_FALLBACK_PROVIDERS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
    .map((provider) => parseProvider(provider, primaryProvider))
    .filter((provider, index, providers) => provider !== primaryProvider && providers.indexOf(provider) === index);

  return {
    enabled: environment.MKETY_PUBLIC_AI_ENABLED === 'true',
    primaryProvider,
    fallbackProviders,
    model,
  };
}

export function resolvePublicAzureOpenAIConfig(environment: PublicAssistantEnvironment) {
  const apiKey =
    environment.MKETY_PUBLIC_AZURE_OPEN_AI_API_KEY ??
    environment.MKETY_PUBLIC_AZURE_OPENAI_API_KEY ??
    environment.MKETY_PUBLIC_AZURE_OPEN_AI_KEY ??
    environment.MKETY_PUBLIC_AZURE_OPENAI_KEY ??
    environment.MKETY_PUBLIC_AZURE_API_KEY ??
    environment.MKETY_PUBLIC_AZURE_KEY ??
    environment.AZURE_OPENAI_API_KEY ??
    environment.AZURE_AI_API_KEY;
  const endpoint = environment.MKETY_PUBLIC_AZURE_OPEN_AI_ENDPOINT ?? environment.MKETY_PUBLIC_AZURE_OPENAI_ENDPOINT;
  const deployment =
    environment.MKETY_PUBLIC_AZURE_OPEN_AI_MODEL ??
    environment.MKETY_PUBLIC_AZURE_OPENAI_MODEL ??
    environment.MKETY_PUBLIC_AZURE_OPEN_AI_DEPLOYMENT ??
    environment.MKETY_PUBLIC_AZURE_OPENAI_DEPLOYMENT;
  return apiKey && endpoint && deployment ? { apiKey, endpoint, deployment } : null;
}

function hasProviderCredential(provider: PublicAIProviderId, environment: PublicAssistantEnvironment): boolean {
  switch (provider) {
    case 'workers-ai':
      return true;
    case 'openai':
      return Boolean(environment.MKETY_PUBLIC_OPENAI_API_KEY ?? environment.OPENAI_API_KEY);
    case 'azure-openai':
      return Boolean(resolvePublicAzureOpenAIConfig(environment));
    case 'gemini':
      return Boolean(environment.MKETY_PUBLIC_GEMINI_API_KEY);
    case 'vertex':
      return Boolean(
        environment.MKETY_PUBLIC_VERTEX_PROJECT_ID &&
        environment.MKETY_PUBLIC_VERTEX_LOCATION &&
        environment.MKETY_PUBLIC_VERTEX_ACCESS_TOKEN,
      );
    case 'cloudflare-ai':
      return Boolean(
        environment.MKETY_PUBLIC_CLOUDFLARE_ACCOUNT_ID && environment.MKETY_PUBLIC_CLOUDFLARE_AI_API_TOKEN,
      );
    case 'bedrock':
      return Boolean(
        environment.MKETY_PUBLIC_BEDROCK_ACCESS_KEY_ID && environment.MKETY_PUBLIC_BEDROCK_SECRET_ACCESS_KEY,
      );
  }
}

export function getPublicAssistantLaunchState(environment: PublicAssistantEnvironment): PublicAssistantLaunchState {
  if (environment.MKETY_PUBLIC_AI_ENABLED !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  const config = parsePublicAIProviderConfig(environment);
  if (!hasProviderCredential(config.primaryProvider, environment)) {
    return { enabled: false, reason: 'provider-unconfigured' };
  }

  return {
    enabled: true,
    reason: 'ready',
    provider: config.primaryProvider,
    model: config.model,
  };
}
