import { buildAuthorizationUrl, createPkcePair, normalizeIssuer, verifyIdToken } from '../oidc';

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
      nonce: 'nonce-value',
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
    expect(parsed.searchParams.get('nonce')).toBe('nonce-value');
  });

  it('verifies an RS256 ID token against a trusted JWK and claims', async () => {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify'],
    );
    const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const header = { alg: 'RS256', kid: 'test-key', typ: 'JWT' };
    const payload = {
      iss: 'https://example.zitadel.cloud',
      sub: 'zitadel-user-1',
      aud: 'mkety-client',
      exp: Math.floor(Date.now() / 1000) + 300,
      iat: Math.floor(Date.now() / 1000),
      nonce: 'nonce-value',
      email: 'user@example.com',
      name: 'Example User',
    };

    const encode = (value: unknown) => {
      const bytes = new TextEncoder().encode(JSON.stringify(value));
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    };

    const signingInput = `${encode(header)}.${encode(payload)}`;
    const signature = await crypto.subtle.sign(
      'RSASSA-PKCS1-v1_5',
      keyPair.privateKey,
      new TextEncoder().encode(signingInput),
    );
    const signatureBase64 = (() => {
      const bytes = new Uint8Array(signature);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
    })();

    const token = `${signingInput}.${signatureBase64}`;
    const verified = await verifyIdToken(token, {
      issuer: payload.iss,
      clientId: payload.aud,
      nonce: payload.nonce,
      jwks: { keys: [{ ...publicJwk, kid: 'test-key', alg: 'RS256', use: 'sig' }] },
    });

    expect(verified.sub).toBe(payload.sub);
    expect(verified.email).toBe(payload.email);
    expect(verified.name).toBe(payload.name);
  });
});
