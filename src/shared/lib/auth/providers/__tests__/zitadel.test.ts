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
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(discovery),
      } as unknown as Response)
      .mockResolvedValueOnce({
        status: 302,
        headers: new Headers({
          location: 'https://auth.mkety.com/ui/v2/login/loginname?requestId=oidc_12345',
        }),
      } as unknown as Response);

    const adapter = createZitadelAdapter({
      issuer: 'https://example.zitadel.cloud',
      clientId: 'mkety-client',
      redirectUri: 'https://mkety.com/api/auth/callback',
      postLogoutRedirectUri: 'https://mkety.com/login',
    });

    await expect(
      adapter.createAuthorizationUrl({
        state: 'state-value',
        codeChallenge: 'challenge-value',
        redirectUri: 'https://mkety.com/api/auth/callback',
        returnTo: '/select-tenant',
        nonce: 'nonce-value',
        prompt: 'login',
      }),
    ).resolves.toBe('https://auth.mkety.com/ui/v2/login/loginname?requestId=oidc_12345');
  });

  it('falls back to the issuer authorization URL when branded first-hop resolution fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue(discovery),
      } as unknown as Response)
      .mockRejectedValueOnce(new Error('temporary upstream failure'));

    const adapter = createZitadelAdapter({
      issuer: 'https://example.zitadel.cloud',
      clientId: 'mkety-client',
      redirectUri: 'https://mkety.com/api/auth/callback',
      postLogoutRedirectUri: 'https://mkety.com/login',
    });

    const url = await adapter.createAuthorizationUrl({
      state: 'state-value',
      codeChallenge: 'challenge-value',
      redirectUri: 'https://mkety.com/api/auth/callback',
      returnTo: '/select-tenant',
      nonce: 'nonce-value',
      prompt: 'login',
    });

    expect(new URL(url).origin).toBe('https://example.zitadel.cloud');
    expect(new URL(url).pathname).toBe('/oauth/v2/authorize');
  });
});
