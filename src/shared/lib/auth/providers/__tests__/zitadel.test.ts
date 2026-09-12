import { createZitadelAdapter } from '../zitadel';

const discovery = {
  authorization_endpoint: 'https://example.zitadel.cloud/oauth/v2/authorize',
  token_endpoint: 'https://example.zitadel.cloud/oauth/v2/token',
  jwks_uri: 'https://example.zitadel.cloud/oauth/v2/keys',
  end_session_endpoint: 'https://example.zitadel.cloud/oidc/v1/end_session',
};

describe('ZITADEL identity provider adapter', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('creates a provider-neutral authorization URL', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(discovery),
    } as unknown as Response);

    const adapter = createZitadelAdapter({
      issuer: 'https://example.zitadel.cloud',
      clientId: 'mkety-client',
      clientSecret: 'secret',
      redirectUri: 'https://preview.example.workers.dev/api/auth/callback',
      postLogoutRedirectUri: 'https://preview.example.workers.dev/login',
    });

    const url = await adapter.createAuthorizationUrl({
      state: 'state-value',
      codeChallenge: 'challenge-value',
      redirectUri: 'https://preview.example.workers.dev/api/auth/callback',
      returnTo: '/select-tenant',
      nonce: 'nonce-value',
    });

    const parsed = new URL(url);
    expect(parsed.searchParams.get('client_id')).toBe('mkety-client');
    expect(parsed.searchParams.get('state')).toBe('state-value');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(parsed.searchParams.get('nonce')).toBe('nonce-value');
  });
});
