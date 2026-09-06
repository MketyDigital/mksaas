export interface PkcePair {
  verifier: string;
  challenge: string;
}

export interface AuthorizationUrlInput {
  authorizationEndpoint: string;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  nonce: string;
  scope?: string;
}

export interface OidcJsonWebKey extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

export interface JsonWebKeySet {
  keys: OidcJsonWebKey[];
}

export interface VerifyIdTokenOptions {
  issuer: string;
  clientId: string;
  nonce: string;
  jwks: JsonWebKeySet;
  clockSkewSeconds?: number;
}

export interface OidcIdTokenClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  [claim: string]: unknown;
}

const textEncoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function decodeJson<T>(value: string): T {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value))) as T;
}

export function normalizeIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, '');
}

export async function createPkcePair(): Promise<PkcePair> {
  const verifierBytes = new Uint8Array(32);
  crypto.getRandomValues(verifierBytes);
  const verifier = toBase64Url(verifierBytes);
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(verifier));
  return {
    verifier,
    challenge: toBase64Url(new Uint8Array(digest)),
  };
}

export function buildAuthorizationUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  nonce,
  scope = 'openid profile email',
}: AuthorizationUrlInput): string {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', scope);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('nonce', nonce);
  return url.toString();
}

export async function verifyIdToken(token: string, options: VerifyIdTokenOptions): Promise<OidcIdTokenClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid ID token format');

  const header = decodeJson<{ alg?: string; kid?: string }>(parts[0]);
  if (header.alg !== 'RS256' || !header.kid) throw new Error('Unsupported ID token signing algorithm');

  const jwk = options.jwks.keys.find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (!jwk) throw new Error('ID token signing key not found');

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const signingInput = `${parts[0]}.${parts[1]}`;
  const signatureValid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    toArrayBuffer(fromBase64Url(parts[2])),
    textEncoder.encode(signingInput),
  );
  if (!signatureValid) throw new Error('Invalid ID token signature');

  const claims = decodeJson<OidcIdTokenClaims>(parts[1]);
  const now = Math.floor(Date.now() / 1000);
  const clockSkew = options.clockSkewSeconds ?? 60;
  const expectedIssuer = normalizeIssuer(options.issuer);

  if (normalizeIssuer(claims.iss) !== expectedIssuer) throw new Error('Invalid ID token issuer');
  if (!claims.sub) throw new Error('ID token subject is missing');
  if (!Array.isArray(claims.aud) && typeof claims.aud !== 'string') throw new Error('Invalid ID token audience');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.clientId)) throw new Error('Invalid ID token audience');
  if (!Number.isFinite(claims.exp) || claims.exp <= now - clockSkew) throw new Error('ID token is expired');
  if (!Number.isFinite(claims.iat) || claims.iat > now + clockSkew) throw new Error('ID token issued-at time is invalid');
  if (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now + clockSkew)) {
    throw new Error('ID token is not active yet');
  }
  if (claims.nonce !== options.nonce) throw new Error('ID token nonce mismatch');

  return claims;
}
