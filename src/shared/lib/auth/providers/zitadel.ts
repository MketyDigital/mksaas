import { buildAuthorizationUrl, normalizeIssuer, verifyIdToken } from '../oidc';
import type {
  AuthorizationCodeExchange,
  AuthorizationRequest,
  ExternalIdentity,
  IdentityProviderAdapter,
  ProviderLogoutRequest,
} from '../types';
import type { ZitadelAdapterConfig } from './types';

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  userinfo_endpoint?: string;
  end_session_endpoint?: string;
}

interface TokenResponse {
  access_token?: string;
  id_token?: string;
  token_type?: string;
}

interface UserInfo {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

async function discover(issuer: string): Promise<OidcDiscovery> {
  const response = await fetch(`${normalizeIssuer(issuer)}/.well-known/openid-configuration`, {
    headers: { accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Identity provider discovery failed');
  const metadata = (await response.json()) as OidcDiscovery;
  if (!metadata.authorization_endpoint || !metadata.token_endpoint || !metadata.jwks_uri) {
    throw new Error('Identity provider discovery metadata is incomplete');
  }
  return metadata;
}

function assertProviderUrl(url: string, issuer: string): void {
  const parsed = new URL(url);
  const expected = new URL(normalizeIssuer(issuer));
  if (parsed.origin !== expected.origin) throw new Error('Identity provider endpoint is outside the configured issuer');
}

export function createZitadelAdapter(config: ZitadelAdapterConfig): IdentityProviderAdapter {
  const issuer = normalizeIssuer(config.issuer);

  return {
    async createAuthorizationUrl(input: AuthorizationRequest): Promise<string> {
      const metadata = await discover(issuer);
      assertProviderUrl(metadata.authorization_endpoint, issuer);
      return buildAuthorizationUrl({
        authorizationEndpoint: metadata.authorization_endpoint,
        clientId: config.clientId,
        redirectUri: input.redirectUri,
        state: input.state,
        codeChallenge: input.codeChallenge,
        nonce: input.nonce,
      });
    },

    async exchangeCode(input: AuthorizationCodeExchange): Promise<ExternalIdentity> {
      const metadata = await discover(issuer);
      assertProviderUrl(metadata.token_endpoint, issuer);
      assertProviderUrl(metadata.jwks_uri, issuer);
      if (metadata.userinfo_endpoint) assertProviderUrl(metadata.userinfo_endpoint, issuer);

      const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: config.clientId,
        code_verifier: input.verifier,
      });

      const headers: HeadersInit = {
        accept: 'application/json',
        'content-type': 'application/x-www-form-urlencoded',
      };
      if (config.clientSecret) {
        headers.authorization = `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`;
      }

      const tokenResponse = await fetch(metadata.token_endpoint, {
        method: 'POST',
        headers,
        body,
      });
      if (!tokenResponse.ok) throw new Error('Identity provider token exchange failed');

      const tokens = (await tokenResponse.json()) as TokenResponse;
      if (!tokens.id_token) throw new Error('Identity provider did not return an ID token');

      const jwksResponse = await fetch(metadata.jwks_uri, { headers: { accept: 'application/json' } });
      if (!jwksResponse.ok) throw new Error('Identity provider JWKS lookup failed');
      const jwks = (await jwksResponse.json()) as { keys?: JsonWebKey[] };
      if (!Array.isArray(jwks.keys)) throw new Error('Identity provider JWKS response is invalid');

      const claims = await verifyIdToken(tokens.id_token, {
        issuer,
        clientId: config.clientId,
        nonce: input.nonce,
        jwks: { keys: jwks.keys },
      });

      let userInfo: UserInfo | null = null;
      if (tokens.access_token && metadata.userinfo_endpoint && (!claims.email || !claims.name)) {
        const response = await fetch(metadata.userinfo_endpoint, {
          headers: { accept: 'application/json', authorization: `Bearer ${tokens.access_token}` },
        });
        if (response.ok) userInfo = (await response.json()) as UserInfo;
      }

      const subject = claims.sub;
      if (!subject || (userInfo?.sub && userInfo.sub !== subject)) throw new Error('Identity provider subject mismatch');

      return {
        provider: 'zitadel',
        subject,
        email: typeof claims.email === 'string' ? claims.email : userInfo?.email ?? null,
        name: typeof claims.name === 'string' ? claims.name : userInfo?.name ?? null,
        image: typeof claims.picture === 'string' ? claims.picture : userInfo?.picture ?? null,
      };
    },

    async getLogoutUrl(input: ProviderLogoutRequest): Promise<string | null> {
      const metadata = await discover(issuer);
      if (!metadata.end_session_endpoint) return null;
      assertProviderUrl(metadata.end_session_endpoint, issuer);

      const url = new URL(metadata.end_session_endpoint);
      url.searchParams.set('client_id', config.clientId);
      url.searchParams.set('post_logout_redirect_uri', input.postLogoutRedirectUri || config.postLogoutRedirectUri);
      if (input.idTokenHint) url.searchParams.set('id_token_hint', input.idTokenHint);
      return url.toString();
    },
  };
}
