import { createZitadelAdapter, resolveBrandedLoginFirstHop } from '../zitadel';

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
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(discovery),
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 200,
        headers: new Headers(),
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

  it('resolves a branded Login V2 first hop when ZITADEL returns auth.mkety.com', async () => {
    const fetcher = jest.fn(async () => ({
      status: 302,
      headers: new Headers({
        location: 'https://auth.mkety.com/ui/v2/login/loginname?requestId=oidc_12345',
      }),
    })) as unknown as typeof fetch;

    await expect(
      resolveBrandedLoginFirstHop(
        'https://example.zitadel.cloud/oauth/v2/authorize?client_id=mkety-client',
        'https://example.zitadel.cloud',
        fetcher,
      ),
    ).resolves.toBe('https://auth.mkety.com/ui/v2/login/loginname?requestId=oidc_12345');
  });

  it('returns null from the branded first-hop resolver when upstream resolution fails', async () => {
    const fetcher = jest.fn(async () => {
      throw new Error('temporary upstream failure');
    }) as unknown as typeof fetch;

    await expect(
      resolveBrandedLoginFirstHop(
        'https://example.zitadel.cloud/oauth/v2/authorize?client_id=mkety-client',
        'https://example.zitadel.cloud',
        fetcher,
      ),
    ).resolves.toBeNull();
  });

});
