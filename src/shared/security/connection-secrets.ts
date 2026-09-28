const PREFIX = 'enc:v1:';

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveKey(secret: string) {
  if (secret.length < 32) throw new Error('Mkety connection encryption key must be at least 32 characters.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export function getConnectionEncryptionKey(environment: NodeJS.ProcessEnv = process.env) {
  const key = environment.MKETY_CONNECTION_SECRET_ENCRYPTION_KEY?.trim()
    || environment.MKETY_AI_BYOK_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error('Mkety connection encryption key is not configured.');
  return key;
}

export async function encryptConnectionSecret(
  payload: Record<string, string>,
  encryptionKey = getConnectionEncryptionKey(),
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(encryptionKey);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return `${PREFIX}${toBase64Url(iv)}.${toBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptConnectionSecret(
  secretRef: string,
  encryptionKey = getConnectionEncryptionKey(),
) {
  if (!secretRef.startsWith(PREFIX)) throw new Error('Unsupported connection secret reference.');
  const [ivPart, encryptedPart] = secretRef.slice(PREFIX.length).split('.');
  if (!ivPart || !encryptedPart) throw new Error('Malformed connection secret reference.');
  const key = await deriveKey(encryptionKey);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(encryptedPart),
  );
  const value = JSON.parse(new TextDecoder().decode(decrypted)) as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Connection secret payload is invalid.');
  }
  return value as Record<string, string>;
}
