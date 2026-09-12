const textEncoder = new TextEncoder();

export function generateOpaqueToken(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isSafeReturnTo(value: string | null | undefined): value is string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return false;

  try {
    const parsed = new URL(value, 'https://mkety.invalid');
    return parsed.origin === 'https://mkety.invalid' && parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
