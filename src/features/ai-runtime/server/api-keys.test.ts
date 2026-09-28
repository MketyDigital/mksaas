import { AI_API_SCOPES, normalizeAiApiScopes } from './api-keys';

describe('AI API key scopes', () => {
  it('defaults to the complete supported API scope set', () => {
    expect(normalizeAiApiScopes()).toEqual(AI_API_SCOPES);
  });

  it('deduplicates supported scopes', () => {
    expect(normalizeAiApiScopes(['ai:chat', 'ai:chat'])).toEqual(['ai:chat']);
  });

  it('rejects empty and unknown scopes', () => {
    expect(() => normalizeAiApiScopes([])).toThrow('at least one scope');
    expect(() => normalizeAiApiScopes(['ai:admin'])).toThrow('unsupported scope');
  });
});
