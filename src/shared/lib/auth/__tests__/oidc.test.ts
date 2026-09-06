import { buildAuthorizationUrl, createPkcePair, normalizeIssuer } from '../oidc';

describe('Mkety Auth OIDC primitives', () => {
  it('normalizes an issuer without changing its origin or path', () => {
    expect(normalizeIssuer('https://example.zitadel.cloud/')).toBe('https://example.zitadel.cloud');
    expect(normalizeIssuer('https://example.zitadel.cloud/custom/')).toBe('https://example.zitadel.cloud/custom');
  });

  it('creates a PKCE verifier and S256 challenge', async () => {
    const pair = await createPkcePair();

    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(pair.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pair.challenge.length).toBeGreaterThanOrEqual(43);
  });

  it('builds an authorization URL with provider-neutral OIDC parameters', () => {
    const url = buildAuthorizationUrl({
      authorizationEndpoint: 'https://example.zitadel.cloud/oauth/v2/authorize',
      clientId: 'mkety-client',
      redirectUri: 'https://preview.example.workers.dev/api/auth/callback',
      state: 'state-value',
      codeChallenge: 'challenge-value',
      scope: 'openid profile email',
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://example.zitadel.cloud');
    expect(parsed.pathname).toBe('/oauth/v2/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('mkety-client');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://preview.example.workers.dev/api/auth/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('scope')).toBe('openid profile email');
    expect(parsed.searchParams.get('state')).toBe('state-value');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
  });
});
