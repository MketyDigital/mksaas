export const PUBLIC_AI_VISITOR_COOKIE = 'mkety_public_ai_visitor';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error('MKETY_PUBLIC_AI_VISITOR_SECRET must be at least 32 characters.');
  }

  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { hash: 'SHA-256', name: 'HMAC' },
    false,
    ['sign', 'verify'],
  );
}

export async function createPublicVisitorToken(visitorId: string, secret: string): Promise<string> {
  if (!UUID_PATTERN.test(visitorId)) throw new Error('Public AI visitor id must be a UUID.');

  const key = await importSigningKey(secret);
  const payload = new TextEncoder().encode(visitorId);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return `${visitorId}.${toBase64Url(signature)}`;
}

export async function parsePublicVisitorToken(
  token: string | undefined,
  secret: string,
): Promise<string | null> {
  if (!token) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;

  const visitorId = token.slice(0, separator);
  const encodedSignature = token.slice(separator + 1);
  if (!UUID_PATTERN.test(visitorId)) return null;

  const signature = fromBase64Url(encodedSignature);
  if (!signature) return null;

  const key = await importSigningKey(secret);
  const signatureBuffer = new Uint8Array(signature).buffer;
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    signatureBuffer,
    new TextEncoder().encode(visitorId),
  );

  return valid ? visitorId : null;
}
