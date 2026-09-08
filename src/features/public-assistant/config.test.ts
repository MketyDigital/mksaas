import { getPublicAssistantLaunchState } from './config';

describe('Public Mkety AI launch boundary', () => {
  it('is disabled by default and never falls back to tenant AI implicitly', () => {
    expect(getPublicAssistantLaunchState({})).toEqual({ enabled: false, reason: 'disabled' });
  });

  it('requires an explicit public flag and a supported public provider credential', () => {
    expect(getPublicAssistantLaunchState({ MKETY_PUBLIC_AI_ENABLED: 'true' })).toEqual({
      enabled: false,
      reason: 'provider-unconfigured',
    });

    expect(
      getPublicAssistantLaunchState({
        MKETY_PUBLIC_AI_ENABLED: 'true',
        MKETY_PUBLIC_AI_PROVIDER: 'openai',
        OPENAI_API_KEY: 'configured',
      }),
    ).toEqual({ enabled: true, reason: 'ready', provider: 'openai' });
  });
});
