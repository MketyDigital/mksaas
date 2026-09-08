export type PublicAssistantProvider = 'openai';

export type PublicAssistantLaunchState =
  | { enabled: false; reason: 'disabled' | 'provider-unconfigured' }
  | { enabled: true; reason: 'ready'; provider: PublicAssistantProvider };

interface PublicAssistantEnvironment {
  MKETY_PUBLIC_AI_ENABLED?: string;
  MKETY_PUBLIC_AI_PROVIDER?: string;
  OPENAI_API_KEY?: string;
}

export function getPublicAssistantLaunchState(
  environment: PublicAssistantEnvironment,
): PublicAssistantLaunchState {
  if (environment.MKETY_PUBLIC_AI_ENABLED !== 'true') {
    return { enabled: false, reason: 'disabled' };
  }

  const provider = environment.MKETY_PUBLIC_AI_PROVIDER ?? 'openai';
  if (provider !== 'openai' || !environment.OPENAI_API_KEY) {
    return { enabled: false, reason: 'provider-unconfigured' };
  }

  return { enabled: true, reason: 'ready', provider: 'openai' };
}
