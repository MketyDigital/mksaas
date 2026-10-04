import {
  evaluatePublicAiConfigDiagnostic,
  summarizePublicAiConfig,
} from './public-ai-config-diagnostic';

describe('public AI production config diagnostic', () => {
  it('exposes only booleans and allowlisted provider identifiers', () => {
    const summary = summarizePublicAiConfig({
      providerApiKey: 'do-not-return-this',
      publicAiConfig: {
        enabled: true,
        primaryProvider: 'openai',
        fallbackProviders: ['gemini', 'openai', 'unknown-provider'],
        models: { openai: 'private-model-name' },
        apiKey: 'also-private',
      },
    });

    expect(summary).toEqual({
      configPresent: true,
      enabled: true,
      primaryProvider: 'openai',
      fallbackProviders: ['gemini'],
      hasFallbacks: true,
    });
    expect(JSON.stringify(summary)).not.toContain('do-not-return-this');
    expect(JSON.stringify(summary)).not.toContain('private-model-name');
    expect(JSON.stringify(summary)).not.toContain('also-private');
  });

  it('distinguishes a missing config without exposing malformed metadata', () => {
    expect(summarizePublicAiConfig({ publicAiConfig: 'raw-private-value' })).toEqual({
      configPresent: false,
      enabled: null,
      primaryProvider: null,
      fallbackProviders: [],
      hasFallbacks: false,
    });
  });

  it('accepts only the exact sanitized diagnostic response shape', () => {
    const body = JSON.stringify({
      configPresent: true,
      enabled: false,
      primaryProvider: 'azure-openai',
      fallbackProviders: ['gemini'],
      hasFallbacks: true,
    });

    expect(evaluatePublicAiConfigDiagnostic('200', body)).toEqual({
      ok: true,
      httpCode: 200,
      reason: null,
      configPresent: true,
      enabled: false,
      primaryProvider: 'azure-openai',
      fallbackProviders: ['gemini'],
      hasFallbacks: true,
    });
  });

  it('rejects unexpected fields, unapproved provider IDs, and non-200 responses', () => {
    expect(evaluatePublicAiConfigDiagnostic('200', JSON.stringify({
      configPresent: true,
      enabled: true,
      primaryProvider: 'openai',
      fallbackProviders: [],
      hasFallbacks: false,
      apiKey: 'must-not-pass',
    }))).toEqual({ ok: false, httpCode: 200, reason: 'invalid_response' });

    expect(evaluatePublicAiConfigDiagnostic('200', JSON.stringify({
      configPresent: true,
      enabled: true,
      primaryProvider: 'attacker-value',
      fallbackProviders: [],
      hasFallbacks: false,
    }))).toEqual({ ok: false, httpCode: 200, reason: 'invalid_response' });

    expect(evaluatePublicAiConfigDiagnostic('503', '{}')).toEqual({
      ok: false,
      httpCode: 503,
      reason: 'http_error',
    });
  });
});
